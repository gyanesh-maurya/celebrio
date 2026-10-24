import { z } from 'zod';
import {
  EVENT_TYPES,
  VENUE_TYPES,
  CURRENCIES,
  BUDGET_FLEXIBILITY,
  SPENDING_PRIORITIES,
  TASK_PRIORITIES,
  TASK_CATEGORIES,
  PAYMENT_STATUSES,
  VENDOR_STATUSES,
  VENDOR_CATEGORIES,
} from '@/types/event';

// --- Max lengths for text fields ---
const MAX_SHORT_TEXT = 200;
const MAX_MEDIUM_TEXT = 500;
const MAX_LONG_TEXT = 2000;
const MAX_GUEST_COUNT = 100000;
const MAX_BUDGET = 1_000_000_000_00; // 1 billion in minor units (paise/cents)

// --- Basic Info Schema ---
export const eventBasicInfoSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(MAX_SHORT_TEXT, `Max ${MAX_SHORT_TEXT} characters`),
  type: z.enum(EVENT_TYPES, { message: 'Select a valid event type' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm format').optional().or(z.literal('')),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm format').optional().or(z.literal('')),
  location: z.string().min(1, 'Location is required').max(MAX_SHORT_TEXT, `Max ${MAX_SHORT_TEXT} characters`),
  venueType: z.enum(VENUE_TYPES, { message: 'Select a venue type' }),
  guestCount: z.number().int().min(1, 'At least 1 guest required').max(MAX_GUEST_COUNT, `Max ${MAX_GUEST_COUNT} guests`),
});

// --- Budget Info Schema ---
export const eventBudgetInfoSchema = z.object({
  totalBudget: z.number().int().min(100, 'Budget must be at least ₹1 / $1').max(MAX_BUDGET, 'Budget exceeds maximum'),
  currency: z.enum(CURRENCIES, { message: 'Select a valid currency' }),
  flexibility: z.enum(BUDGET_FLEXIBILITY, { message: 'Select budget flexibility' }),
  priorities: z.array(z.enum(SPENDING_PRIORITIES)).min(0).max(10),
  includesAllExpenses: z.boolean(),
});

// --- Preferences Schema ---
export const eventPreferencesSchema = z.object({
  theme: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  colorPalette: z.string().max(MAX_SHORT_TEXT).optional().or(z.literal('')),
  style: z.string().max(MAX_SHORT_TEXT).optional().or(z.literal('')),
  foodPreferences: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  dietaryRequirements: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  culturalConsiderations: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  accessibilityNeeds: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  weatherBackup: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  specialRequests: z.string().max(MAX_LONG_TEXT).optional().or(z.literal('')),
});

// --- Budget Item Schema ---
export const budgetItemSchema = z.object({
  id: z.string().uuid(),
  category: z.string().min(1).max(MAX_SHORT_TEXT),
  description: z.string().min(1, 'Description is required').max(MAX_MEDIUM_TEXT),
  plannedAmount: z.number().int().min(0, 'Amount cannot be negative').max(MAX_BUDGET),
  actualAmount: z.number().int().min(0, 'Amount cannot be negative').max(MAX_BUDGET),
  vendorId: z.string().uuid().optional().or(z.literal('')),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  notes: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
});

// --- Task Schema ---
export const eventTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Task title is required').max(MAX_SHORT_TEXT),
  description: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  priority: z.enum(TASK_PRIORITIES),
  category: z.enum(TASK_CATEGORIES),
  completed: z.boolean(),
  notes: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  vendorId: z.string().uuid().optional().or(z.literal('')),
});

// --- Vendor Schema ---
const safeUrlSchema = z.string().max(MAX_MEDIUM_TEXT).refine(
  (val) => {
    if (!val) return true;
    try {
      const url = new URL(val);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  },
  { message: 'URL must use http or https protocol' }
).optional().or(z.literal(''));

export const vendorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Vendor name is required').max(MAX_SHORT_TEXT),
  category: z.enum(VENDOR_CATEGORIES),
  contactInfo: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  website: safeUrlSchema,
  estimatedQuotation: z.number().int().min(0).max(MAX_BUDGET).optional(),
  confirmedQuotation: z.number().int().min(0).max(MAX_BUDGET).optional(),
  status: z.enum(VENDOR_STATUSES),
  paymentNotes: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  notes: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
});

// --- Idea Schema ---
export const eventIdeaSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(MAX_SHORT_TEXT),
  description: z.string().min(1).max(MAX_LONG_TEXT),
  rationale: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  estimatedCost: z.number().int().min(0).max(MAX_BUDGET).optional(),
  category: z.string().min(1).max(MAX_SHORT_TEXT),
  preparationNotes: z.string().max(MAX_MEDIUM_TEXT).optional().or(z.literal('')),
  saved: z.boolean(),
});

// --- AI Plan Schema ---
export const aiPlanConceptSchema = z.object({
  name: z.string().min(1).max(MAX_SHORT_TEXT),
  description: z.string().min(1).max(MAX_LONG_TEXT),
  colorPalette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')).min(1).max(10),
  rationale: z.string().min(1).max(MAX_LONG_TEXT),
});

export const aiPlanBudgetItemSchema = z.object({
  category: z.string().min(1).max(MAX_SHORT_TEXT),
  estimatedAmount: z.number().int().min(0).max(MAX_BUDGET),
  reason: z.string().min(1).max(MAX_MEDIUM_TEXT),
});

export const aiPlanTimelineItemSchema = z.object({
  title: z.string().min(1).max(MAX_SHORT_TEXT),
  description: z.string().min(1).max(MAX_MEDIUM_TEXT),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  priority: z.enum(TASK_PRIORITIES),
  category: z.enum(TASK_CATEGORIES),
});

export const aiPlanVendorItemSchema = z.object({
  category: z.enum(VENDOR_CATEGORIES),
  title: z.string().min(1).max(MAX_SHORT_TEXT),
  description: z.string().min(1).max(MAX_MEDIUM_TEXT),
  suggestedLeadTimeDays: z.number().int().min(0).max(365),
});

export const aiPlanIdeaSchema = z.object({
  title: z.string().min(1).max(MAX_SHORT_TEXT),
  description: z.string().min(1).max(MAX_LONG_TEXT),
  estimatedCost: z.number().int().min(0).max(MAX_BUDGET).optional(),
  category: z.string().min(1).max(MAX_SHORT_TEXT),
});

export const aiPlanContingencySchema = z.object({
  risk: z.string().min(1).max(MAX_SHORT_TEXT),
  mitigation: z.string().min(1).max(MAX_MEDIUM_TEXT),
});

export const aiPlanSchema = z.object({
  eventSummary: z.string().min(1).max(MAX_LONG_TEXT),
  concept: aiPlanConceptSchema,
  budget: z.array(aiPlanBudgetItemSchema).min(1).max(20),
  timeline: z.array(aiPlanTimelineItemSchema).min(1).max(50),
  vendorChecklist: z.array(aiPlanVendorItemSchema).min(0).max(20),
  ideas: z.array(aiPlanIdeaSchema).min(1).max(30),
  contingencies: z.array(aiPlanContingencySchema).min(0).max(10),
});

// --- AI Request Schema (for API route validation) ---
export const aiPlanRequestSchema = z.object({
  basicInfo: eventBasicInfoSchema,
  budgetInfo: eventBudgetInfoSchema,
  preferences: eventPreferencesSchema,
});

// --- Import Schema ---
export const importEventSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  basicInfo: eventBasicInfoSchema,
  budgetInfo: eventBudgetInfoSchema,
  preferences: eventPreferencesSchema,
  budgetItems: z.array(budgetItemSchema).max(200),
  tasks: z.array(eventTaskSchema).max(200),
  vendors: z.array(vendorSchema).max(100),
  ideas: z.array(eventIdeaSchema).max(100),
  aiPlan: aiPlanSchema.optional(),
  aiPlanGeneratedAt: z.string().datetime().optional(),
  aiPlanSource: z.enum(['ai', 'demo']).optional(),
  wizardCompleted: z.boolean(),
});
