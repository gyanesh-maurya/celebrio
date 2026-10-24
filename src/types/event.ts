/**
 * Core domain types for the Celebrio event planning application.
 * These types define the data model shared across UI, storage, calculations, and AI integration.
 */

// --- Enums and Constants ---

export const EVENT_TYPES = [
  'wedding',
  'engagement',
  'birthday',
  'anniversary',
  'community',
  'college-festival',
  'meetup',
  'cultural-gathering',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: 'Wedding',
  engagement: 'Engagement Celebration',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  community: 'Community Event',
  'college-festival': 'College Festival',
  meetup: 'Meetup',
  'cultural-gathering': 'Cultural Gathering',
  other: 'Other',
};

export const VENUE_TYPES = ['indoor', 'outdoor', 'mixed'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const BUDGET_FLEXIBILITY = ['strict', 'moderate', 'flexible'] as const;
export type BudgetFlexibility = (typeof BUDGET_FLEXIBILITY)[number];

export const SPENDING_PRIORITIES = [
  'venue',
  'catering',
  'photography',
  'decorations',
  'entertainment',
  'logistics',
  'accessibility',
  'invitations',
  'attire',
  'transportation',
] as const;
export type SpendingPriority = (typeof SPENDING_PRIORITIES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_CATEGORIES = [
  'venue',
  'catering',
  'decoration',
  'photography',
  'entertainment',
  'logistics',
  'invitations',
  'attire',
  'transportation',
  'accessibility',
  'coordination',
  'other',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'partially-paid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const VENDOR_STATUSES = [
  'to-research',
  'shortlisted',
  'contacted',
  'quotation-received',
  'selected',
  'booked',
  'cancelled',
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  'to-research': 'To Research',
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  'quotation-received': 'Quotation Received',
  selected: 'Selected',
  booked: 'Booked',
  cancelled: 'Cancelled',
};

export const VENDOR_CATEGORIES = [
  'venue',
  'caterer',
  'photographer',
  'decorator',
  'music-entertainment',
  'transportation',
  'equipment-rental',
  'cake-bakery',
  'invitations-printing',
  'security-logistics',
  'other',
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue: 'Venue',
  caterer: 'Caterer',
  photographer: 'Photographer',
  decorator: 'Decorator',
  'music-entertainment': 'Music & Entertainment',
  transportation: 'Transportation',
  'equipment-rental': 'Equipment Rental',
  'cake-bakery': 'Cake & Bakery',
  'invitations-printing': 'Invitations & Printing',
  'security-logistics': 'Security & Logistics',
  other: 'Other',
};

// --- Core Data Structures ---

export interface EventBasicInfo {
  name: string;
  type: EventType;
  date: string; // ISO date string YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  location: string;
  venueType: VenueType;
  guestCount: number;
}

export interface EventBudgetInfo {
  /** Total budget in minor currency units (e.g., paise for INR) */
  totalBudget: number;
  currency: Currency;
  flexibility: BudgetFlexibility;
  priorities: SpendingPriority[];
  includesAllExpenses: boolean;
}

export interface EventPreferences {
  theme?: string;
  colorPalette?: string;
  style?: string;
  foodPreferences?: string;
  dietaryRequirements?: string;
  culturalConsiderations?: string;
  accessibilityNeeds?: string;
  weatherBackup?: string;
  specialRequests?: string;
}

export interface BudgetItem {
  id: string;
  category: string;
  description: string;
  /** Planned amount in minor currency units */
  plannedAmount: number;
  /** Actual spent amount in minor currency units */
  actualAmount: number;
  vendorId?: string;
  paymentStatus: PaymentStatus;
  notes?: string;
}

export interface EventTask {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // ISO date string YYYY-MM-DD
  priority: TaskPriority;
  category: TaskCategory;
  completed: boolean;
  notes?: string;
  vendorId?: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactInfo?: string;
  website?: string;
  /** Estimated quotation in minor currency units */
  estimatedQuotation?: number;
  /** Confirmed quoted amount in minor currency units */
  confirmedQuotation?: number;
  status: VendorStatus;
  paymentNotes?: string;
  notes?: string;
}

export interface EventIdea {
  id: string;
  title: string;
  description: string;
  rationale?: string;
  /** Estimated cost in minor currency units */
  estimatedCost?: number;
  category: string;
  preparationNotes?: string;
  saved: boolean;
}

// --- AI Plan Types ---

export interface AIPlanConcept {
  name: string;
  description: string;
  colorPalette: string[];
  rationale: string;
}

export interface AIPlanBudgetItem {
  category: string;
  /** Estimated amount in minor currency units */
  estimatedAmount: number;
  reason: string;
}

export interface AIPlanTimelineItem {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  category: TaskCategory;
}

export interface AIPlanVendorItem {
  category: VendorCategory;
  title: string;
  description: string;
  suggestedLeadTimeDays: number;
}

export interface AIPlanIdea {
  title: string;
  description: string;
  /** Estimated cost in minor currency units */
  estimatedCost?: number;
  category: string;
}

export interface AIPlanContingency {
  risk: string;
  mitigation: string;
}

export interface AIPlan {
  eventSummary: string;
  concept: AIPlanConcept;
  budget: AIPlanBudgetItem[];
  timeline: AIPlanTimelineItem[];
  vendorChecklist: AIPlanVendorItem[];
  ideas: AIPlanIdea[];
  contingencies: AIPlanContingency[];
}

// --- Event Document ---

export interface CelebrioEvent {
  id: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  basicInfo: EventBasicInfo;
  budgetInfo: EventBudgetInfo;
  preferences: EventPreferences;
  budgetItems: BudgetItem[];
  tasks: EventTask[];
  vendors: Vendor[];
  ideas: EventIdea[];
  aiPlan?: AIPlan;
  aiPlanGeneratedAt?: string;
  aiPlanSource?: 'ai' | 'demo';
  wizardCompleted: boolean;
}

// --- Storage ---

export const STORAGE_VERSION = 1;

export interface StorageData {
  version: number;
  events: CelebrioEvent[];
}
