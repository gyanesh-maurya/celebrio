/**
 * Server-side AI prompt builder.
 * Constructs structured prompts from user event data.
 * Treats all user-provided text as event preference data, not system instructions.
 */

import type { EventBasicInfo, EventBudgetInfo, EventPreferences, Currency } from '@/types/event';
import { EVENT_TYPE_LABELS, CURRENCY_SYMBOLS } from '@/types/event';

function formatBudgetForPrompt(amountMinor: number, currency: Currency): string {
  const major = amountMinor / 100;
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${major.toLocaleString()}`;
}

export function buildPlanPrompt(
  basicInfo: EventBasicInfo,
  budgetInfo: EventBudgetInfo,
  preferences: EventPreferences
): string {
  const eventTypeLabel = EVENT_TYPE_LABELS[basicInfo.type] || basicInfo.type;
  const budgetDisplay = formatBudgetForPrompt(budgetInfo.totalBudget, budgetInfo.currency);

  return `You are a professional event planning assistant. Generate a detailed, actionable event plan based on the following event details. Your response must be a valid JSON object matching the specified schema exactly.

EVENT DETAILS:
- Event Type: ${eventTypeLabel}
- Event Name: "${sanitizeForPrompt(basicInfo.name)}"
- Event Date: ${basicInfo.date}
- Location: ${sanitizeForPrompt(basicInfo.location)}
- Venue Type: ${basicInfo.venueType}
- Expected Guests: ${basicInfo.guestCount}
${basicInfo.startTime ? `- Start Time: ${basicInfo.startTime}` : ''}
${basicInfo.endTime ? `- End Time: ${basicInfo.endTime}` : ''}

BUDGET:
- Total Budget: ${budgetDisplay} (${budgetInfo.currency})
- Budget Flexibility: ${budgetInfo.flexibility}
- Includes All Expenses: ${budgetInfo.includesAllExpenses ? 'Yes' : 'No'}
- Spending Priorities: ${budgetInfo.priorities.length > 0 ? budgetInfo.priorities.join(', ') : 'No specific priorities'}

PREFERENCES:
${preferences.theme ? `- Theme/Atmosphere: ${sanitizeForPrompt(preferences.theme)}` : ''}
${preferences.colorPalette ? `- Color Palette: ${sanitizeForPrompt(preferences.colorPalette)}` : ''}
${preferences.style ? `- Style: ${sanitizeForPrompt(preferences.style)}` : ''}
${preferences.foodPreferences ? `- Food Preferences: ${sanitizeForPrompt(preferences.foodPreferences)}` : ''}
${preferences.dietaryRequirements ? `- Dietary Requirements: ${sanitizeForPrompt(preferences.dietaryRequirements)}` : ''}
${preferences.culturalConsiderations ? `- Cultural Considerations: ${sanitizeForPrompt(preferences.culturalConsiderations)}` : ''}
${preferences.accessibilityNeeds ? `- Accessibility Needs: ${sanitizeForPrompt(preferences.accessibilityNeeds)}` : ''}
${preferences.weatherBackup ? `- Weather/Backup Plans: ${sanitizeForPrompt(preferences.weatherBackup)}` : ''}
${preferences.specialRequests ? `- Special Requests: ${sanitizeForPrompt(preferences.specialRequests)}` : ''}

IMPORTANT INSTRUCTIONS:
1. All budget amounts in the response must be in minor currency units (multiply the major unit by 100). For example, if the currency is INR and you want to suggest ₹50,000, output 5000000.
2. The total of all budget category "estimatedAmount" values MUST NOT exceed ${budgetInfo.totalBudget} (the total budget in minor units).
3. Reserve approximately 5-10% of the budget for contingency unless the budget is very tight.
4. Generate preparation timeline tasks with dates counting backward from the event date (${basicInfo.date}).
5. Make recommendations specific to the event type (${eventTypeLabel}), guest count (${basicInfo.guestCount}), and budget.
6. All dates must be in YYYY-MM-DD format.
7. All colors in colorPalette must be valid 6-digit hex colors starting with #.
8. Priority must be one of: "low", "medium", "high", "critical".
9. Task category must be one of: "venue", "catering", "decoration", "photography", "entertainment", "logistics", "invitations", "attire", "transportation", "accessibility", "coordination", "other".
10. Vendor category must be one of: "venue", "caterer", "photographer", "decorator", "music-entertainment", "transportation", "equipment-rental", "cake-bakery", "invitations-printing", "security-logistics", "other".
11. All amounts are ESTIMATES for planning purposes, not verified market prices.
12. Do NOT invent real vendor names, real availability, confirmed bookings, or verified reviews.

Respond with ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "eventSummary": "A concise 2-3 sentence overview of the event plan",
  "concept": {
    "name": "Theme/concept name",
    "description": "Description of the concept",
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "rationale": "Why this concept suits the event"
  },
  "budget": [
    {
      "category": "Category name",
      "estimatedAmount": 0,
      "reason": "Why this allocation"
    }
  ],
  "timeline": [
    {
      "title": "Task title",
      "description": "What to do",
      "dueDate": "YYYY-MM-DD",
      "priority": "high",
      "category": "venue"
    }
  ],
  "vendorChecklist": [
    {
      "category": "caterer",
      "title": "Task title",
      "description": "What to do",
      "suggestedLeadTimeDays": 30
    }
  ],
  "ideas": [
    {
      "title": "Idea title",
      "description": "Detailed description",
      "estimatedCost": 0,
      "category": "decoration"
    }
  ],
  "contingencies": [
    {
      "risk": "Risk description",
      "mitigation": "How to mitigate"
    }
  ]
}`;
}

/**
 * Sanitize user-provided text for prompt inclusion.
 * Prevents prompt injection by removing control characters and limiting length.
 */
function sanitizeForPrompt(text: string): string {
  return text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '') // Remove control chars except \n, \r, \t
    .substring(0, 500) // Limit length
    .trim();
}

export function buildIdeasPrompt(
  basicInfo: EventBasicInfo,
  budgetInfo: EventBudgetInfo,
  preferences: EventPreferences,
  userPrompt: string
): string {
  const eventTypeLabel = EVENT_TYPE_LABELS[basicInfo.type] || basicInfo.type;
  const budgetDisplay = formatBudgetForPrompt(budgetInfo.totalBudget, budgetInfo.currency);

  return `You are a creative event planning assistant. Generate personalized, practical ideas based on the user's request.

EVENT CONTEXT:
- Type: ${eventTypeLabel}
- Guests: ${basicInfo.guestCount}
- Budget: ${budgetDisplay}
- Venue: ${basicInfo.venueType}
- Location: ${sanitizeForPrompt(basicInfo.location)}
${preferences.theme ? `- Theme: ${sanitizeForPrompt(preferences.theme)}` : ''}

USER REQUEST: ${sanitizeForPrompt(userPrompt)}

Generate 5-8 creative, practical ideas. All cost estimates in minor currency units (multiply by 100).
All amounts are ESTIMATES for planning, not verified prices.

Respond with ONLY valid JSON (no markdown):
{
  "ideas": [
    {
      "title": "Idea title",
      "description": "Detailed description",
      "estimatedCost": 0,
      "category": "relevant-category"
    }
  ]
}`;
}
