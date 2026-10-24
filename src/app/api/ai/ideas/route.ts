/**
 * AI Ideas Generation API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { aiPlanRequestSchema, aiPlanIdeaSchema } from '@/lib/schemas/validation';
import { buildIdeasPrompt } from '@/lib/ai/prompts';
import { generateDemoIdeas } from '@/lib/ai/demo-fallback';

const ideasRequestSchema = aiPlanRequestSchema.extend({
  prompt: z.string().min(1).max(500),
});

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = ideasRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const { basicInfo, budgetInfo, preferences, prompt: userPrompt } = validation.data;
    const apiKey = process.env.GEMINI_API_KEY;
    const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const candidateModels = Array.from(new Set([preferredModel, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']));

    if (!apiKey) {
      const ideas = generateDemoIdeas(basicInfo, budgetInfo, preferences, userPrompt);
      return NextResponse.json({ ideas, source: 'demo' });
    }

    const prompt = buildIdeasPrompt(basicInfo, budgetInfo, preferences, userPrompt);
    const ai = new GoogleGenAI({ apiKey });

    let text = '';
    try {
      for (const m of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              maxOutputTokens: 2048,
              temperature: 0.8,
              responseMimeType: 'application/json',
            },
          });
          const res = response.text?.trim();
          if (res) {
            text = res;
            break;
          }
        } catch (mErr) {
          console.warn(`[Celebrio AI] Ideas model ${m} attempt failed:`, mErr instanceof Error ? mErr.message : mErr);
        }
      }

      if (!text) {
        const ideas = generateDemoIdeas(basicInfo, budgetInfo, preferences, userPrompt);
        return NextResponse.json({ ideas, source: 'demo' });
      }

      let parsed: unknown;
      try {
        let jsonStr = text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        const ideas = generateDemoIdeas(basicInfo, budgetInfo, preferences, userPrompt);
        return NextResponse.json({ ideas, source: 'demo' });
      }

      const ideasArray = (parsed as { ideas?: unknown[] })?.ideas;
      if (!Array.isArray(ideasArray)) {
        const ideas = generateDemoIdeas(basicInfo, budgetInfo, preferences, userPrompt);
        return NextResponse.json({ ideas, source: 'demo' });
      }

      const validIdeas = ideasArray
        .map((idea) => aiPlanIdeaSchema.safeParse(idea))
        .filter((r) => r.success)
        .map((r) => r.data)
        .slice(0, 10);

      if (validIdeas.length === 0) {
        const ideas = generateDemoIdeas(basicInfo, budgetInfo, preferences, userPrompt);
        return NextResponse.json({ ideas, source: 'demo' });
      }

      return NextResponse.json({ ideas: validIdeas, source: 'ai' });
    } catch {
      const ideas = generateDemoIdeas(basicInfo, budgetInfo, preferences, userPrompt);
      return NextResponse.json({ ideas, source: 'demo' });
    }
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
