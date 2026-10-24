/**
 * AI Plan Generation API Route
 * Server-side only - keeps API keys secure.
 * Includes rate limiting, input validation, timeouts, and structured output validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { aiPlanRequestSchema, aiPlanSchema } from '@/lib/schemas/validation';
import { buildPlanPrompt } from '@/lib/ai/prompts';
import { generateDemoPlan } from '@/lib/ai/demo-fallback';

// Simple in-memory rate limiter (suitable for single-instance deployment)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

const MAX_REQUEST_SIZE = 50_000; // 50KB max request body

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    // Check request size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const validationResult = aiPlanRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 10),
        },
        { status: 400 }
      );
    }

    const { basicInfo, budgetInfo, preferences } = validationResult.data;

    const apiKey = process.env.GEMINI_API_KEY;
    const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const candidateModels = Array.from(new Set([preferredModel, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']));

    if (!apiKey) {
      // Return demo plan
      const demoPlan = generateDemoPlan(basicInfo, budgetInfo, preferences);
      return NextResponse.json({
        plan: demoPlan,
        source: 'demo',
        message: 'AI provider not configured. This plan was generated locally using demo logic.',
      });
    }

    // Generate with real AI
    const prompt = buildPlanPrompt(basicInfo, budgetInfo, preferences);
    const ai = new GoogleGenAI({ apiKey });

    // Set timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

    let responseText = '';
    let lastError: unknown = null;
    let successfulModel = '';

    try {
      for (const m of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              maxOutputTokens: 4096,
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          });
          const text = response.text?.trim();
          if (text) {
            responseText = text;
            successfulModel = m;
            break;
          }
        } catch (mErr) {
          console.warn(`[Celebrio AI] Model ${m} attempt failed:`, mErr instanceof Error ? mErr.message : mErr);
          lastError = mErr;
        }
      }

      clearTimeout(timeoutId);

      if (!responseText) {
        const demoPlan = generateDemoPlan(basicInfo, budgetInfo, preferences);
        return NextResponse.json({
          plan: demoPlan,
          source: 'demo',
          message: 'Gemini request could not be completed. A demo plan has been generated instead.',
        });
      }

      // Parse AI response
      let parsedPlan: unknown;
      try {
        // Try to extract JSON from the response (handle markdown code fences)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        parsedPlan = JSON.parse(jsonStr);
      } catch {
        // Attempt one more parse by trying to find JSON object
        try {
          const startIdx = responseText.indexOf('{');
          const endIdx = responseText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx > startIdx) {
            parsedPlan = JSON.parse(responseText.substring(startIdx, endIdx + 1));
          }
        } catch {
          const demoPlan = generateDemoPlan(basicInfo, budgetInfo, preferences);
          return NextResponse.json({
            plan: demoPlan,
            source: 'demo',
            message: 'AI returned invalid JSON. A demo plan has been generated instead.',
          });
        }
      }

      // Validate the parsed plan
      const planValidation = aiPlanSchema.safeParse(parsedPlan);
      if (!planValidation.success) {
        // Try to repair common issues
        const repaired = attemptRepair(parsedPlan);
        const repairedValidation = aiPlanSchema.safeParse(repaired);

        if (!repairedValidation.success) {
          const demoPlan = generateDemoPlan(basicInfo, budgetInfo, preferences);
          return NextResponse.json({
            plan: demoPlan,
            source: 'demo',
            message: 'AI plan did not pass validation. A demo plan has been generated instead.',
          });
        }

        return NextResponse.json({
          plan: repairedValidation.data,
          source: 'ai',
          message: 'Event plan generated successfully by AI (with minor corrections).',
        });
      }

      // Validate budget total doesn't exceed user's total budget
      const budgetSum = planValidation.data.budget.reduce((sum, item) => sum + item.estimatedAmount, 0);
      if (budgetSum > budgetInfo.totalBudget * 1.1) {
        // Scale down if significantly over budget
        const scaleFactor = budgetInfo.totalBudget / budgetSum;
        planValidation.data.budget = planValidation.data.budget.map((item) => ({
          ...item,
          estimatedAmount: Math.round(item.estimatedAmount * scaleFactor),
        }));
      }

      return NextResponse.json({
        plan: planValidation.data,
        source: 'ai',
        message: 'Event plan generated successfully by AI.',
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const demoPlan = generateDemoPlan(basicInfo, budgetInfo, preferences);
        return NextResponse.json({
          plan: demoPlan,
          source: 'demo',
          message: 'AI request timed out. A demo plan has been generated instead.',
        });
      }

      // Don't expose provider internals
      const demoPlan = generateDemoPlan(basicInfo, budgetInfo, preferences);
      return NextResponse.json({
        plan: demoPlan,
        source: 'demo',
        message: 'AI service encountered an error. A demo plan has been generated instead.',
      });
    }
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating the plan.' },
      { status: 500 }
    );
  }
}

/**
 * Attempt to repair common AI output issues.
 */
function attemptRepair(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  const obj = data as Record<string, unknown>;

  // Ensure arrays exist
  if (!Array.isArray(obj.budget)) obj.budget = [];
  if (!Array.isArray(obj.timeline)) obj.timeline = [];
  if (!Array.isArray(obj.vendorChecklist)) obj.vendorChecklist = [];
  if (!Array.isArray(obj.ideas)) obj.ideas = [];
  if (!Array.isArray(obj.contingencies)) obj.contingencies = [];

  // Fix color palette
  if (obj.concept && typeof obj.concept === 'object') {
    const concept = obj.concept as Record<string, unknown>;
    const palette = concept.colorPalette;
    if (Array.isArray(palette)) {
      const fixed = palette
        .filter((c): c is string => typeof c === 'string')
        .map((c) => {
          if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
          if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c}`;
          return '#666666';
        });
      concept.colorPalette = fixed.length > 0 ? fixed : ['#4A3728', '#D4A574', '#F5E6D3'];
    }
  }

  return obj;
}
