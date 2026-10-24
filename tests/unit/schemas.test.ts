/**
 * Unit tests for Zod validation schemas.
 * Tests edge cases: invalid types, missing fields, length limits, and AI response validation.
 */

import { describe, it, expect } from 'vitest';
import {
  eventBasicInfoSchema,
  eventBudgetInfoSchema,
  eventPreferencesSchema,
  budgetItemSchema,
  eventTaskSchema,
  vendorSchema,
  aiPlanSchema,
  importEventSchema,
} from '@/lib/schemas/validation';

describe('eventBasicInfoSchema', () => {
  const validData = {
    name: 'My Wedding',
    type: 'wedding',
    date: '2026-12-25',
    location: 'Mumbai',
    venueType: 'indoor',
    guestCount: 100,
  };

  it('accepts valid basic info', () => {
    expect(eventBasicInfoSchema.safeParse(validData).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, name: '' }).success).toBe(false);
  });

  it('rejects invalid event type', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, type: 'invalid-type' }).success).toBe(false);
  });

  it('rejects invalid date format', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, date: '25-12-2026' }).success).toBe(false);
    expect(eventBasicInfoSchema.safeParse({ ...validData, date: '2026/12/25' }).success).toBe(false);
  });

  it('rejects zero guest count', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, guestCount: 0 }).success).toBe(false);
  });

  it('rejects negative guest count', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, guestCount: -5 }).success).toBe(false);
  });

  it('rejects guest count exceeding max', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, guestCount: 200000 }).success).toBe(false);
  });

  it('accepts optional time fields', () => {
    const result = eventBasicInfoSchema.safeParse({ ...validData, startTime: '10:00', endTime: '22:00' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid time format', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, startTime: '10am' }).success).toBe(false);
  });

  it('accepts empty string for optional time', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, startTime: '' }).success).toBe(true);
  });

  it('rejects name exceeding max length', () => {
    expect(eventBasicInfoSchema.safeParse({ ...validData, name: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe('eventBudgetInfoSchema', () => {
  const validBudget = {
    totalBudget: 500_000_00,
    currency: 'INR',
    flexibility: 'moderate',
    priorities: ['venue', 'catering'],
    includesAllExpenses: true,
  };

  it('accepts valid budget info', () => {
    expect(eventBudgetInfoSchema.safeParse(validBudget).success).toBe(true);
  });

  it('rejects zero budget', () => {
    expect(eventBudgetInfoSchema.safeParse({ ...validBudget, totalBudget: 0 }).success).toBe(false);
  });

  it('rejects negative budget', () => {
    expect(eventBudgetInfoSchema.safeParse({ ...validBudget, totalBudget: -100 }).success).toBe(false);
  });

  it('rejects invalid currency', () => {
    expect(eventBudgetInfoSchema.safeParse({ ...validBudget, currency: 'BTC' }).success).toBe(false);
  });

  it('rejects invalid flexibility', () => {
    expect(eventBudgetInfoSchema.safeParse({ ...validBudget, flexibility: 'unlimited' }).success).toBe(false);
  });

  it('accepts empty priorities', () => {
    expect(eventBudgetInfoSchema.safeParse({ ...validBudget, priorities: [] }).success).toBe(true);
  });
});

describe('eventPreferencesSchema', () => {
  it('accepts empty preferences', () => {
    expect(eventPreferencesSchema.safeParse({}).success).toBe(true);
  });

  it('accepts all optional fields', () => {
    expect(eventPreferencesSchema.safeParse({
      theme: 'Rustic',
      colorPalette: '#FFD700, #8B4513',
      style: 'Casual',
      foodPreferences: 'Vegetarian',
      dietaryRequirements: 'Gluten-free',
      culturalConsiderations: 'Hindu ceremony',
      accessibilityNeeds: 'Wheelchair access',
      weatherBackup: 'Indoor tent',
      specialRequests: 'Live band',
    }).success).toBe(true);
  });

  it('rejects text exceeding max length', () => {
    expect(eventPreferencesSchema.safeParse({
      specialRequests: 'a'.repeat(2001),
    }).success).toBe(false);
  });
});

describe('vendorSchema', () => {
  const validVendor = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'ABC Caterers',
    category: 'caterer',
    status: 'to-research',
  };

  it('accepts valid vendor', () => {
    expect(vendorSchema.safeParse(validVendor).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(vendorSchema.safeParse({ ...validVendor, name: '' }).success).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(vendorSchema.safeParse({ ...validVendor, category: 'invalid' }).success).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(vendorSchema.safeParse({ ...validVendor, status: 'pending' }).success).toBe(false);
  });

  it('rejects unsafe URL schemes', () => {
    expect(vendorSchema.safeParse({ ...validVendor, website: 'javascript:alert(1)' }).success).toBe(false);
    expect(vendorSchema.safeParse({ ...validVendor, website: 'ftp://evil.com' }).success).toBe(false);
  });

  it('accepts valid https URL', () => {
    expect(vendorSchema.safeParse({ ...validVendor, website: 'https://example.com' }).success).toBe(true);
  });

  it('accepts empty string for optional website', () => {
    expect(vendorSchema.safeParse({ ...validVendor, website: '' }).success).toBe(true);
  });
});

describe('budgetItemSchema', () => {
  const validItem = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    category: 'Venue',
    description: 'Main venue booking',
    plannedAmount: 100_000_00,
    actualAmount: 0,
    paymentStatus: 'unpaid',
  };

  it('accepts valid budget item', () => {
    expect(budgetItemSchema.safeParse(validItem).success).toBe(true);
  });

  it('rejects negative planned amount', () => {
    expect(budgetItemSchema.safeParse({ ...validItem, plannedAmount: -100 }).success).toBe(false);
  });

  it('rejects negative actual amount', () => {
    expect(budgetItemSchema.safeParse({ ...validItem, actualAmount: -100 }).success).toBe(false);
  });

  it('rejects invalid payment status', () => {
    expect(budgetItemSchema.safeParse({ ...validItem, paymentStatus: 'pending' }).success).toBe(false);
  });

  it('accepts all payment statuses', () => {
    for (const status of ['unpaid', 'partially-paid', 'paid']) {
      expect(budgetItemSchema.safeParse({ ...validItem, paymentStatus: status }).success).toBe(true);
    }
  });
});

describe('eventTaskSchema', () => {
  const validTask = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Book venue',
    dueDate: '2026-06-15',
    priority: 'high',
    category: 'venue',
    completed: false,
  };

  it('accepts valid task', () => {
    expect(eventTaskSchema.safeParse(validTask).success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(eventTaskSchema.safeParse({ ...validTask, title: '' }).success).toBe(false);
  });

  it('rejects invalid priority', () => {
    expect(eventTaskSchema.safeParse({ ...validTask, priority: 'urgent' }).success).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(eventTaskSchema.safeParse({ ...validTask, category: 'invalid' }).success).toBe(false);
  });
});

describe('aiPlanSchema', () => {
  const validPlan = {
    eventSummary: 'A beautiful wedding plan',
    concept: {
      name: 'Elegant Garden',
      description: 'An outdoor garden wedding',
      colorPalette: ['#FFD700', '#FFFFFF', '#006400'],
      rationale: 'Matches the outdoor venue',
    },
    budget: [
      { category: 'Venue', estimatedAmount: 200_000_00, reason: 'Garden venue rental' },
    ],
    timeline: [
      { title: 'Book venue', description: 'Finalize venue', dueDate: '2026-06-01', priority: 'high', category: 'venue' },
    ],
    vendorChecklist: [],
    ideas: [
      { title: 'Flower arch', description: 'A beautiful flower arch at the entrance', category: 'decoration' },
    ],
    contingencies: [],
  };

  it('accepts valid AI plan', () => {
    expect(aiPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it('rejects empty event summary', () => {
    expect(aiPlanSchema.safeParse({ ...validPlan, eventSummary: '' }).success).toBe(false);
  });

  it('rejects invalid hex colors', () => {
    const invalidPlan = {
      ...validPlan,
      concept: { ...validPlan.concept, colorPalette: ['not-a-color'] },
    };
    expect(aiPlanSchema.safeParse(invalidPlan).success).toBe(false);
  });

  it('rejects 3-digit hex colors', () => {
    const invalidPlan = {
      ...validPlan,
      concept: { ...validPlan.concept, colorPalette: ['#FFF'] },
    };
    expect(aiPlanSchema.safeParse(invalidPlan).success).toBe(false);
  });

  it('accepts full valid hex colors', () => {
    const plan = {
      ...validPlan,
      concept: { ...validPlan.concept, colorPalette: ['#abcdef', '#123456'] },
    };
    expect(aiPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('rejects empty budget array', () => {
    expect(aiPlanSchema.safeParse({ ...validPlan, budget: [] }).success).toBe(false);
  });

  it('rejects empty timeline array', () => {
    expect(aiPlanSchema.safeParse({ ...validPlan, timeline: [] }).success).toBe(false);
  });

  it('rejects invalid priority in timeline', () => {
    const plan = {
      ...validPlan,
      timeline: [{ title: 'T', description: 'D', dueDate: '2026-01-01', priority: 'urgent', category: 'venue' }],
    };
    expect(aiPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('rejects negative estimated amounts', () => {
    const plan = {
      ...validPlan,
      budget: [{ category: 'Venue', estimatedAmount: -100, reason: 'Test' }],
    };
    expect(aiPlanSchema.safeParse(plan).success).toBe(false);
  });
});

describe('importEventSchema', () => {
  it('rejects data without required fields', () => {
    expect(importEventSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-UUID id', () => {
    expect(importEventSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});
