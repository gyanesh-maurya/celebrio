/**
 * Budget calculation utilities for Celebrio.
 * All monetary values are in minor currency units (paise for INR, cents for USD).
 * This avoids floating-point precision issues with currency arithmetic.
 */

import type { BudgetItem, CelebrioEvent, Currency } from '@/types/event';
import { CURRENCY_SYMBOLS } from '@/types/event';

/**
 * Calculate the sum of planned amounts across all budget items.
 */
export function calculateTotalPlanned(items: BudgetItem[]): number {
  return items.reduce((sum, item) => sum + item.plannedAmount, 0);
}

/**
 * Calculate the sum of actual spent amounts across all budget items.
 */
export function calculateTotalActual(items: BudgetItem[]): number {
  return items.reduce((sum, item) => sum + item.actualAmount, 0);
}

/**
 * Calculate remaining budget = total budget - total planned.
 */
export function calculateRemainingBudget(totalBudget: number, items: BudgetItem[]): number {
  return totalBudget - calculateTotalPlanned(items);
}

/**
 * Calculate available funds = total budget - total actual spent.
 */
export function calculateAvailableFunds(totalBudget: number, items: BudgetItem[]): number {
  return totalBudget - calculateTotalActual(items);
}

/**
 * Check if the budget is over-planned.
 */
export function isBudgetOverPlanned(totalBudget: number, items: BudgetItem[]): boolean {
  return calculateTotalPlanned(items) > totalBudget;
}

/**
 * Check if actual spending exceeds the budget.
 */
export function isBudgetOverSpent(totalBudget: number, items: BudgetItem[]): boolean {
  return calculateTotalActual(items) > totalBudget;
}

/**
 * Calculate budget utilization as a percentage (0-100+).
 * Based on actual spending vs total budget.
 */
export function calculateBudgetUtilization(totalBudget: number, items: BudgetItem[]): number {
  if (totalBudget <= 0) return 0;
  const actual = calculateTotalActual(items);
  return Math.round((actual / totalBudget) * 100);
}

/**
 * Calculate planned utilization as a percentage (0-100+).
 */
export function calculatePlannedUtilization(totalBudget: number, items: BudgetItem[]): number {
  if (totalBudget <= 0) return 0;
  const planned = calculateTotalPlanned(items);
  return Math.round((planned / totalBudget) * 100);
}

/**
 * Group budget items by category and sum their planned amounts.
 */
export function getBudgetByCategory(items: BudgetItem[]): Record<string, { planned: number; actual: number; count: number }> {
  const result: Record<string, { planned: number; actual: number; count: number }> = {};
  for (const item of items) {
    const cat = item.category || 'Uncategorized';
    if (!result[cat]) {
      result[cat] = { planned: 0, actual: 0, count: 0 };
    }
    result[cat].planned += item.plannedAmount;
    result[cat].actual += item.actualAmount;
    result[cat].count += 1;
  }
  return result;
}

/**
 * Format an amount from minor units to display string.
 * E.g., 150000 paise -> "₹1,500.00"
 */
export function formatCurrency(amountMinor: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  const major = amountMinor / 100;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(major));
  const sign = major < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

/**
 * Format amount without decimals for compact display.
 */
export function formatCurrencyCompact(amountMinor: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  const major = amountMinor / 100;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(major));
  const sign = major < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

/**
 * Convert a major currency amount to minor units (e.g., ₹1500 -> 150000 paise).
 */
export function toMinorUnits(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}

/**
 * Convert minor currency units to major (e.g., 150000 paise -> 1500.00).
 */
export function toMajorUnits(minorAmount: number): number {
  return minorAmount / 100;
}

/**
 * Calculate the overall event planning progress based on real data.
 */
export function calculateEventProgress(event: CelebrioEvent): number {
  const weights = {
    hasBasicInfo: 15,
    hasBudget: 10,
    hasBudgetItems: 15,
    hasTimeline: 20,
    hasVendors: 15,
    hasIdeas: 10,
    hasAIPlan: 15,
  };

  let progress = 0;

  // Basic info is always set if event exists
  if (event.basicInfo.name && event.basicInfo.date) {
    progress += weights.hasBasicInfo;
  }

  // Budget set
  if (event.budgetInfo.totalBudget > 0) {
    progress += weights.hasBudget;
  }

  // Budget items added
  if (event.budgetItems.length > 0) {
    const completedItems = event.budgetItems.filter((b) => b.paymentStatus !== 'unpaid').length;
    const ratio = event.budgetItems.length > 0 ? completedItems / event.budgetItems.length : 0;
    progress += Math.round(weights.hasBudgetItems * Math.max(0.3, ratio));
  }

  // Tasks created and progress
  if (event.tasks.length > 0) {
    const completedTasks = event.tasks.filter((t) => t.completed).length;
    const ratio = completedTasks / event.tasks.length;
    progress += Math.round(weights.hasTimeline * Math.max(0.2, ratio));
  }

  // Vendors added
  if (event.vendors.length > 0) {
    const bookedVendors = event.vendors.filter((v) => v.status === 'booked' || v.status === 'selected').length;
    const ratio = event.vendors.length > 0 ? bookedVendors / event.vendors.length : 0;
    progress += Math.round(weights.hasVendors * Math.max(0.2, ratio));
  }

  // Ideas saved
  if (event.ideas.filter((i) => i.saved).length > 0) {
    progress += weights.hasIdeas;
  }

  // AI Plan generated
  if (event.aiPlan) {
    progress += weights.hasAIPlan;
  }

  return Math.min(100, progress);
}

/**
 * Calculate days remaining until an event.
 * Returns negative for past events.
 */
export function calculateDaysRemaining(eventDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate + 'T00:00:00');
  const diff = event.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get upcoming tasks sorted by due date.
 */
export function getUpcomingTasks(event: CelebrioEvent, limit: number = 5) {
  const today = new Date().toISOString().split('T')[0];
  return event.tasks
    .filter((t) => !t.completed && t.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, limit);
}

/**
 * Get overdue tasks.
 */
export function getOverdueTasks(event: CelebrioEvent) {
  const today = new Date().toISOString().split('T')[0];
  return event.tasks.filter((t) => !t.completed && t.dueDate < today);
}

/**
 * Escape a CSV value to prevent formula injection and handle special characters.
 */
export function escapeCsvValue(value: string): string {
  // Neutralize formula injection
  const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
  let escaped = value;
  if (formulaChars.some((c) => escaped.startsWith(c))) {
    escaped = `'${escaped}`;
  }
  // Wrap in quotes if contains comma, quote, or newline
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    escaped = `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

/**
 * Export budget items as CSV.
 */
export function exportBudgetCsv(items: BudgetItem[], currency: Currency): string {
  const headers = ['Category', 'Description', 'Planned Amount', 'Actual Amount', 'Payment Status', 'Notes'];
  const rows = items.map((item) => [
    escapeCsvValue(item.category),
    escapeCsvValue(item.description),
    toMajorUnits(item.plannedAmount).toFixed(2),
    toMajorUnits(item.actualAmount).toFixed(2),
    item.paymentStatus,
    escapeCsvValue(item.notes || ''),
  ]);

  const headerComment = `# Budget Export - Currency: ${currency}`;
  return [headerComment, headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
