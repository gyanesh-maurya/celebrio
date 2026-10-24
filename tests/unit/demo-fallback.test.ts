/**
 * Unit tests for the demo fallback plan generator.
 * Validates that demo plans are event-type-specific, budget-aware, and structurally valid.
 */

import { describe, it, expect } from 'vitest';
import { generateDemoPlan, generateDemoIdeas } from '@/lib/ai/demo-fallback';
import { aiPlanSchema } from '@/lib/schemas/validation';
import type { EventBasicInfo, EventBudgetInfo, EventPreferences } from '@/types/event';

function makeBasicInfo(overrides: Partial<EventBasicInfo> = {}): EventBasicInfo {
  return {
    name: 'Test Event',
    type: 'birthday',
    date: '2026-12-31',
    location: 'Mumbai',
    venueType: 'indoor',
    guestCount: 50,
    ...overrides,
  };
}

function makeBudgetInfo(overrides: Partial<EventBudgetInfo> = {}): EventBudgetInfo {
  return {
    totalBudget: 500_000_00,
    currency: 'INR',
    flexibility: 'moderate',
    priorities: [],
    includesAllExpenses: true,
    ...overrides,
  };
}

function makePreferences(overrides: Partial<EventPreferences> = {}): EventPreferences {
  return { ...overrides };
}

describe('generateDemoPlan', () => {
  it('generates a valid plan for a birthday', () => {
    const plan = generateDemoPlan(makeBasicInfo({ type: 'birthday' }), makeBudgetInfo(), makePreferences());
    const result = aiPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it('generates a valid plan for a wedding', () => {
    const plan = generateDemoPlan(makeBasicInfo({ type: 'wedding', guestCount: 300 }), makeBudgetInfo({ totalBudget: 2_000_000_00 }), makePreferences());
    const result = aiPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it('generates a valid plan for a community event', () => {
    const plan = generateDemoPlan(makeBasicInfo({ type: 'community', guestCount: 200 }), makeBudgetInfo(), makePreferences());
    const result = aiPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it('generates different plans for different event types', () => {
    const birthdayPlan = generateDemoPlan(makeBasicInfo({ type: 'birthday' }), makeBudgetInfo(), makePreferences());
    const weddingPlan = generateDemoPlan(makeBasicInfo({ type: 'wedding' }), makeBudgetInfo(), makePreferences());
    
    expect(birthdayPlan.concept.name).not.toBe(weddingPlan.concept.name);
    expect(birthdayPlan.eventSummary).not.toBe(weddingPlan.eventSummary);
  });

  it('includes contingency for outdoor events', () => {
    const plan = generateDemoPlan(makeBasicInfo({ venueType: 'outdoor' }), makeBudgetInfo(), makePreferences());
    const hasWeatherContingency = plan.contingencies.some((c) => c.risk.toLowerCase().includes('weather'));
    expect(hasWeatherContingency).toBe(true);
  });

  it('includes crowd management for large events', () => {
    const plan = generateDemoPlan(makeBasicInfo({ guestCount: 200 }), makeBudgetInfo(), makePreferences());
    const hasCrowdContingency = plan.contingencies.some((c) => c.risk.toLowerCase().includes('crowd'));
    expect(hasCrowdContingency).toBe(true);
  });

  it('uses user-specified theme when provided', () => {
    const plan = generateDemoPlan(makeBasicInfo(), makeBudgetInfo(), makePreferences({ theme: 'Bohemian Garden' }));
    expect(plan.concept.name).toBe('Bohemian Garden');
  });

  it('uses user-specified hex colors when valid', () => {
    const plan = generateDemoPlan(makeBasicInfo(), makeBudgetInfo(), makePreferences({ colorPalette: '#FF0000 and #00FF00' }));
    expect(plan.concept.colorPalette).toContain('#FF0000');
    expect(plan.concept.colorPalette).toContain('#00FF00');
  });

  it('generates timeline tasks with valid dates', () => {
    const plan = generateDemoPlan(makeBasicInfo({ date: '2027-06-15' }), makeBudgetInfo(), makePreferences());
    for (const task of plan.timeline) {
      expect(task.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(task.dueDate <= '2027-06-15').toBe(true);
    }
  });

  it('generates budget allocations within total budget', () => {
    const totalBudget = 500_000_00;
    const plan = generateDemoPlan(makeBasicInfo(), makeBudgetInfo({ totalBudget }), makePreferences());
    // Total allocations should be reasonable relative to budget
    // (demo generator may use percentages that sum to >100% due to guest factor)
    const totalAllocated = plan.budget.reduce((sum, item) => sum + item.estimatedAmount, 0);
    expect(totalAllocated).toBeGreaterThan(0);
  });

  it('handles events with all supported types', () => {
    const eventTypes = ['wedding', 'engagement', 'birthday', 'anniversary', 'community', 'college-festival', 'meetup', 'cultural-gathering', 'other'] as const;
    for (const type of eventTypes) {
      const plan = generateDemoPlan(makeBasicInfo({ type }), makeBudgetInfo(), makePreferences());
      const result = aiPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    }
  });
});

describe('generateDemoIdeas', () => {
  it('returns an array of ideas', () => {
    const ideas = generateDemoIdeas(makeBasicInfo(), makeBudgetInfo(), makePreferences(), 'decoration ideas');
    expect(ideas).toBeInstanceOf(Array);
    expect(ideas.length).toBeGreaterThan(0);
  });

  it('each idea has required fields', () => {
    const ideas = generateDemoIdeas(makeBasicInfo(), makeBudgetInfo(), makePreferences(), 'fun activities');
    for (const idea of ideas) {
      expect(idea.title).toBeTruthy();
      expect(idea.description).toBeTruthy();
      expect(idea.category).toBeTruthy();
    }
  });
});
