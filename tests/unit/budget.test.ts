/**
 * Unit tests for budget calculation utilities.
 * Tests edge cases including zero, negative, large amounts, and empty lists.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTotalPlanned,
  calculateTotalActual,
  calculateRemainingBudget,
  calculateAvailableFunds,
  isBudgetOverPlanned,
  isBudgetOverSpent,
  calculateBudgetUtilization,
  calculatePlannedUtilization,
  formatCurrency,
  formatCurrencyCompact,
  toMinorUnits,
  toMajorUnits,
  calculateEventProgress,
  calculateDaysRemaining,
  getUpcomingTasks,
  getOverdueTasks,
  escapeCsvValue,
  exportBudgetCsv,
  getBudgetByCategory,
} from '@/lib/calculations/budget';
import type { BudgetItem, CelebrioEvent } from '@/types/event';

// Helper to create a budget item
function makeBudgetItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    category: 'Venue',
    description: 'Test item',
    plannedAmount: 100_00, // ₹100
    actualAmount: 0,
    paymentStatus: 'unpaid',
    notes: '',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CelebrioEvent> = {}): CelebrioEvent {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    basicInfo: {
      name: 'Test Event',
      type: 'birthday',
      date: '2026-12-31',
      location: 'Mumbai',
      venueType: 'indoor',
      guestCount: 50,
    },
    budgetInfo: {
      totalBudget: 500_000_00, // ₹5,00,000
      currency: 'INR',
      flexibility: 'moderate',
      priorities: [],
      includesAllExpenses: true,
    },
    preferences: {},
    budgetItems: [],
    tasks: [],
    vendors: [],
    ideas: [],
    wizardCompleted: true,
    ...overrides,
  };
}

describe('calculateTotalPlanned', () => {
  it('returns 0 for empty list', () => {
    expect(calculateTotalPlanned([])).toBe(0);
  });

  it('sums planned amounts correctly', () => {
    const items = [
      makeBudgetItem({ plannedAmount: 100_00 }),
      makeBudgetItem({ plannedAmount: 200_00, id: '00000000-0000-0000-0000-000000000002' }),
      makeBudgetItem({ plannedAmount: 350_00, id: '00000000-0000-0000-0000-000000000003' }),
    ];
    expect(calculateTotalPlanned(items)).toBe(650_00);
  });

  it('handles zero amounts', () => {
    const items = [makeBudgetItem({ plannedAmount: 0 })];
    expect(calculateTotalPlanned(items)).toBe(0);
  });

  it('handles very large amounts', () => {
    const items = [
      makeBudgetItem({ plannedAmount: 1_000_000_00 }),
      makeBudgetItem({ plannedAmount: 2_000_000_00, id: '00000000-0000-0000-0000-000000000002' }),
    ];
    expect(calculateTotalPlanned(items)).toBe(3_000_000_00);
  });
});

describe('calculateTotalActual', () => {
  it('returns 0 for empty list', () => {
    expect(calculateTotalActual([])).toBe(0);
  });

  it('sums actual amounts correctly', () => {
    const items = [
      makeBudgetItem({ actualAmount: 50_00 }),
      makeBudgetItem({ actualAmount: 75_00, id: '00000000-0000-0000-0000-000000000002' }),
    ];
    expect(calculateTotalActual(items)).toBe(125_00);
  });
});

describe('calculateRemainingBudget', () => {
  it('returns total when no items', () => {
    expect(calculateRemainingBudget(500_00, [])).toBe(500_00);
  });

  it('subtracts planned from total', () => {
    const items = [makeBudgetItem({ plannedAmount: 200_00 })];
    expect(calculateRemainingBudget(500_00, items)).toBe(300_00);
  });

  it('returns negative when over-planned', () => {
    const items = [makeBudgetItem({ plannedAmount: 600_00 })];
    expect(calculateRemainingBudget(500_00, items)).toBe(-100_00);
  });
});

describe('calculateAvailableFunds', () => {
  it('returns total when nothing spent', () => {
    expect(calculateAvailableFunds(500_00, [])).toBe(500_00);
  });

  it('subtracts actual from total', () => {
    const items = [makeBudgetItem({ actualAmount: 200_00 })];
    expect(calculateAvailableFunds(500_00, items)).toBe(300_00);
  });
});

describe('isBudgetOverPlanned', () => {
  it('returns false when under budget', () => {
    const items = [makeBudgetItem({ plannedAmount: 400_00 })];
    expect(isBudgetOverPlanned(500_00, items)).toBe(false);
  });

  it('returns false when exactly at budget', () => {
    const items = [makeBudgetItem({ plannedAmount: 500_00 })];
    expect(isBudgetOverPlanned(500_00, items)).toBe(false);
  });

  it('returns true when over budget', () => {
    const items = [makeBudgetItem({ plannedAmount: 600_00 })];
    expect(isBudgetOverPlanned(500_00, items)).toBe(true);
  });
});

describe('isBudgetOverSpent', () => {
  it('returns false when under budget', () => {
    expect(isBudgetOverSpent(500_00, [makeBudgetItem({ actualAmount: 400_00 })])).toBe(false);
  });

  it('returns true when over budget', () => {
    expect(isBudgetOverSpent(500_00, [makeBudgetItem({ actualAmount: 600_00 })])).toBe(true);
  });
});

describe('calculateBudgetUtilization', () => {
  it('returns 0 for zero budget', () => {
    expect(calculateBudgetUtilization(0, [])).toBe(0);
  });

  it('calculates percentage correctly', () => {
    const items = [makeBudgetItem({ actualAmount: 250_00 })];
    expect(calculateBudgetUtilization(500_00, items)).toBe(50);
  });

  it('can exceed 100%', () => {
    const items = [makeBudgetItem({ actualAmount: 750_00 })];
    expect(calculateBudgetUtilization(500_00, items)).toBe(150);
  });
});

describe('calculatePlannedUtilization', () => {
  it('returns 0 for zero budget', () => {
    expect(calculatePlannedUtilization(0, [])).toBe(0);
  });

  it('calculates percentage from planned amounts', () => {
    const items = [makeBudgetItem({ plannedAmount: 250_00 })];
    expect(calculatePlannedUtilization(500_00, items)).toBe(50);
  });
});

describe('formatCurrency', () => {
  it('formats INR correctly', () => {
    const result = formatCurrency(150_000_00, 'INR');
    expect(result).toContain('₹');
    expect(result).toContain('1,50,000.00');
  });

  it('formats USD correctly', () => {
    const result = formatCurrency(100_00, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('100.00');
  });

  it('handles zero', () => {
    const result = formatCurrency(0, 'INR');
    expect(result).toContain('₹');
    expect(result).toContain('0.00');
  });

  it('handles negative amounts', () => {
    const result = formatCurrency(-500_00, 'INR');
    expect(result).toContain('-');
    expect(result).toContain('₹');
  });
});

describe('formatCurrencyCompact', () => {
  it('formats without decimals', () => {
    const result = formatCurrencyCompact(150_000_00, 'INR');
    expect(result).toContain('₹');
    expect(result).not.toContain('.');
  });
});

describe('toMinorUnits / toMajorUnits', () => {
  it('converts major to minor units', () => {
    expect(toMinorUnits(1500)).toBe(150_000);
    expect(toMinorUnits(0)).toBe(0);
    expect(toMinorUnits(0.50)).toBe(50);
  });

  it('converts minor to major units', () => {
    expect(toMajorUnits(150_000)).toBe(1500);
    expect(toMajorUnits(0)).toBe(0);
    expect(toMajorUnits(50)).toBe(0.5);
  });

  it('round-trips correctly', () => {
    expect(toMajorUnits(toMinorUnits(1234.56))).toBeCloseTo(1234.56);
  });
});

describe('getBudgetByCategory', () => {
  it('returns empty object for no items', () => {
    expect(getBudgetByCategory([])).toEqual({});
  });

  it('groups items by category', () => {
    const items = [
      makeBudgetItem({ category: 'Venue', plannedAmount: 100_00, actualAmount: 50_00 }),
      makeBudgetItem({ category: 'Venue', plannedAmount: 200_00, actualAmount: 100_00, id: '00000000-0000-0000-0000-000000000002' }),
      makeBudgetItem({ category: 'Catering', plannedAmount: 300_00, actualAmount: 0, id: '00000000-0000-0000-0000-000000000003' }),
    ];
    const result = getBudgetByCategory(items);
    expect(result.Venue).toEqual({ planned: 300_00, actual: 150_00, count: 2 });
    expect(result.Catering).toEqual({ planned: 300_00, actual: 0, count: 1 });
  });
});

describe('calculateEventProgress', () => {
  it('returns non-zero for event with basic info', () => {
    const event = makeEvent();
    const progress = calculateEventProgress(event);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThanOrEqual(100);
  });

  it('returns higher progress with more data', () => {
    const baseEvent = makeEvent();
    const enrichedEvent = makeEvent({
      budgetItems: [makeBudgetItem({ paymentStatus: 'paid' })],
      tasks: [
        { id: '1', title: 'Task 1', description: '', dueDate: '2026-12-01', priority: 'high', category: 'venue', completed: true, notes: '' },
      ],
      vendors: [
        { id: '1', name: 'Vendor', category: 'venue', status: 'booked' },
      ],
      ideas: [
        { id: '1', title: 'Idea', description: 'Desc', category: 'dec', saved: true },
      ],
      aiPlan: {
        eventSummary: 'Test',
        concept: { name: 'Theme', description: 'Desc', colorPalette: ['#000000'], rationale: 'Reason' },
        budget: [],
        timeline: [],
        vendorChecklist: [],
        ideas: [],
        contingencies: [],
      },
    });

    expect(calculateEventProgress(enrichedEvent)).toBeGreaterThan(calculateEventProgress(baseEvent));
  });

  it('never exceeds 100', () => {
    const fullEvent = makeEvent({
      budgetItems: [makeBudgetItem({ paymentStatus: 'paid' })],
      tasks: [{ id: '1', title: 'Task', description: '', dueDate: '2026-12-01', priority: 'high', category: 'venue', completed: true }],
      vendors: [{ id: '1', name: 'V', category: 'venue', status: 'booked' }],
      ideas: [{ id: '1', title: 'I', description: 'D', category: 'c', saved: true }],
      aiPlan: { eventSummary: 'S', concept: { name: 'N', description: 'D', colorPalette: ['#000000'], rationale: 'R' }, budget: [], timeline: [], vendorChecklist: [], ideas: [], contingencies: [] },
    });
    expect(calculateEventProgress(fullEvent)).toBeLessThanOrEqual(100);
  });
});

describe('calculateDaysRemaining', () => {
  it('returns positive for future dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = futureDate.toISOString().split('T')[0];
    expect(calculateDaysRemaining(dateStr)).toBe(10);
  });

  it('returns negative for past dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const dateStr = pastDate.toISOString().split('T')[0];
    expect(calculateDaysRemaining(dateStr)).toBe(-5);
  });

  it('returns 0 for today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(calculateDaysRemaining(today)).toBe(0);
  });
});

describe('getUpcomingTasks', () => {
  it('returns empty array for event with no tasks', () => {
    expect(getUpcomingTasks(makeEvent())).toEqual([]);
  });

  it('filters completed tasks', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const event = makeEvent({
      tasks: [
        { id: '1', title: 'Incomplete', description: '', dueDate: dateStr, priority: 'high', category: 'venue', completed: false },
        { id: '2', title: 'Complete', description: '', dueDate: dateStr, priority: 'low', category: 'venue', completed: true },
      ],
    });

    const upcoming = getUpcomingTasks(event);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].title).toBe('Incomplete');
  });

  it('respects limit', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const event = makeEvent({
      tasks: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        title: `Task ${i}`,
        description: '',
        dueDate: dateStr,
        priority: 'medium' as const,
        category: 'other' as const,
        completed: false,
      })),
    });

    expect(getUpcomingTasks(event, 3)).toHaveLength(3);
  });
});

describe('getOverdueTasks', () => {
  it('identifies overdue tasks', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const event = makeEvent({
      tasks: [
        { id: '1', title: 'Overdue', description: '', dueDate: dateStr, priority: 'high', category: 'venue', completed: false },
        { id: '2', title: 'Done', description: '', dueDate: dateStr, priority: 'low', category: 'venue', completed: true },
      ],
    });

    const overdue = getOverdueTasks(event);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe('Overdue');
  });
});

describe('escapeCsvValue', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsvValue('hello')).toBe('hello');
  });

  it('escapes values with commas', () => {
    expect(escapeCsvValue('hello, world')).toBe('"hello, world"');
  });

  it('escapes values with quotes', () => {
    expect(escapeCsvValue('say "hello"')).toBe('"say ""hello"""');
  });

  it('neutralizes formula injection with =', () => {
    expect(escapeCsvValue('=cmd|...')).toBe("'=cmd|...");
  });

  it('neutralizes formula injection with +', () => {
    expect(escapeCsvValue('+1234')).toBe("'+1234");
  });

  it('neutralizes formula injection with -', () => {
    expect(escapeCsvValue('-1234')).toBe("'-1234");
  });

  it('neutralizes formula injection with @', () => {
    expect(escapeCsvValue('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});

describe('exportBudgetCsv', () => {
  it('generates valid CSV with headers', () => {
    const items = [makeBudgetItem({ description: 'Venue booking', plannedAmount: 100_000_00, actualAmount: 50_000_00 })];
    const csv = exportBudgetCsv(items, 'INR');
    expect(csv).toContain('Category,Description,Planned Amount,Actual Amount,Payment Status,Notes');
    expect(csv).toContain('Venue');
    expect(csv).toContain('100000.00');
    expect(csv).toContain('50000.00');
  });

  it('handles empty items', () => {
    const csv = exportBudgetCsv([], 'INR');
    expect(csv).toContain('Category');
    expect(csv.split('\n').length).toBe(2); // comment + header
  });
});
