'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import type { CelebrioEvent, EventBasicInfo, EventBudgetInfo, EventPreferences } from '@/types/event';
import { EVENT_TYPES, EVENT_TYPE_LABELS, VENUE_TYPES, CURRENCIES, BUDGET_FLEXIBILITY, SPENDING_PRIORITIES, CURRENCY_SYMBOLS } from '@/types/event';
import { eventBasicInfoSchema, eventBudgetInfoSchema, eventPreferencesSchema } from '@/lib/schemas/validation';
import { storageService } from '@/lib/storage/storage-service';
import { toMinorUnits } from '@/lib/calculations/budget';
import { ArrowLeft, ArrowRight, Save, Sparkles, Check, PartyPopper, Calendar, MapPin, Users, Wallet, Heart, ClipboardCheck } from 'lucide-react';
import type { ZodError } from 'zod';

const DRAFT_KEY = 'celebrio_wizard_draft';

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Basic Info', 'Budget', 'Preferences', 'Review'] as const;

function getFieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function saveDraft(data: { basic: Partial<EventBasicInfo>; budget: Partial<EventBudgetInfo>; prefs: Partial<EventPreferences> }) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

function loadDraft(): { basic: Partial<EventBasicInfo>; budget: Partial<EventBudgetInfo>; prefs: Partial<EventPreferences> } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export default function NewEventPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form state
  const [basic, setBasic] = useState<Partial<EventBasicInfo>>({
    name: '',
    type: 'birthday',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    venueType: 'indoor',
    guestCount: 50,
  });

  const [budget, setBudget] = useState<Partial<EventBudgetInfo>>({
    totalBudget: 0,
    currency: 'INR',
    flexibility: 'moderate',
    priorities: [],
    includesAllExpenses: true,
  });

  const [prefs, setPrefs] = useState<Partial<EventPreferences>>({
    theme: '',
    colorPalette: '',
    style: '',
    foodPreferences: '',
    dietaryRequirements: '',
    culturalConsiderations: '',
    accessibilityNeeds: '',
    weatherBackup: '',
    specialRequests: '',
  });

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (draft.basic) setBasic((prev) => ({ ...prev, ...draft.basic }));
      if (draft.budget) setBudget((prev) => ({ ...prev, ...draft.budget }));
      if (draft.prefs) setPrefs((prev) => ({ ...prev, ...draft.prefs }));
    }
  }, []);

  // Auto-save draft on change
  useEffect(() => {
    const timer = setTimeout(() => saveDraft({ basic, budget, prefs }), 500);
    return () => clearTimeout(timer);
  }, [basic, budget, prefs]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const validateStep = useCallback((stepNum: WizardStep): boolean => {
    setErrors({});
    if (stepNum === 1) {
      const result = eventBasicInfoSchema.safeParse(basic);
      if (!result.success) { setErrors(getFieldErrors(result.error)); return false; }
    }
    if (stepNum === 2) {
      const budgetData = { ...budget, totalBudget: toMinorUnits(budget.totalBudget || 0) };
      const result = eventBudgetInfoSchema.safeParse(budgetData);
      if (!result.success) { setErrors(getFieldErrors(result.error)); return false; }
    }
    if (stepNum === 3) {
      const result = eventPreferencesSchema.safeParse(prefs);
      if (!result.success) { setErrors(getFieldErrors(result.error)); return false; }
    }
    return true;
  }, [basic, budget, prefs]);

  const goNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 4) as WizardStep);
    }
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1) as WizardStep);
  };

  const buildEvent = (): CelebrioEvent => {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      basicInfo: basic as EventBasicInfo,
      budgetInfo: {
        ...budget as EventBudgetInfo,
        totalBudget: toMinorUnits(budget.totalBudget || 0),
      },
      preferences: prefs as EventPreferences,
      budgetItems: [],
      tasks: [],
      vendors: [],
      ideas: [],
      wizardCompleted: true,
    };
  };

  const handleSaveOnly = () => {
    if (!validateStep(1) || !validateStep(2)) {
      setStep(1);
      setToast({ message: 'Please fill in required fields', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    const event = buildEvent();
    const success = storageService.createEvent(event);
    if (success) {
      clearDraft();
      router.push(`/events/${event.id}`);
    } else {
      setToast({ message: 'Failed to save event', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!validateStep(1) || !validateStep(2)) {
      setStep(1);
      setToast({ message: 'Please fill in required fields', type: 'error' });
      return;
    }
    setIsGenerating(true);
    const event = buildEvent();

    try {
      const response = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basicInfo: event.basicInfo,
          budgetInfo: event.budgetInfo,
          preferences: event.preferences,
        }),
        signal: AbortSignal.timeout(70_000),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'AI generation failed');
      }

      const data = await response.json();

      // Apply AI plan to event
      event.aiPlan = data.plan;
      event.aiPlanGeneratedAt = new Date().toISOString();
      event.aiPlanSource = data.source;

      // Create budget items from AI plan
      if (data.plan.budget) {
        event.budgetItems = data.plan.budget.map((b: { category: string; estimatedAmount: number; reason: string }) => ({
          id: uuidv4(),
          category: b.category,
          description: b.reason,
          plannedAmount: b.estimatedAmount,
          actualAmount: 0,
          paymentStatus: 'unpaid' as const,
          notes: '',
        }));
      }

      // Create tasks from AI timeline
      if (data.plan.timeline) {
        event.tasks = data.plan.timeline.map((t: { title: string; description: string; dueDate: string; priority: string; category: string }) => ({
          id: uuidv4(),
          title: t.title,
          description: t.description,
          dueDate: t.dueDate,
          priority: t.priority,
          category: t.category,
          completed: false,
          notes: '',
        }));
      }

      // Create vendor items from AI vendor checklist
      if (data.plan.vendorChecklist) {
        event.vendors = data.plan.vendorChecklist.map((v: { category: string; title: string; description: string }) => ({
          id: uuidv4(),
          name: v.title,
          category: v.category,
          status: 'to-research' as const,
          notes: v.description,
        }));
      }

      // Create ideas from AI
      if (data.plan.ideas) {
        event.ideas = data.plan.ideas.map((idea: { title: string; description: string; estimatedCost?: number; category: string }) => ({
          id: uuidv4(),
          title: idea.title,
          description: idea.description,
          estimatedCost: idea.estimatedCost,
          category: idea.category,
          saved: false,
        }));
      }

      const success = storageService.createEvent(event);
      if (success) {
        clearDraft();
        setToast({ message: data.source === 'ai' ? 'AI plan generated!' : 'Demo plan generated (AI not configured)', type: data.source === 'ai' ? 'success' : 'info' });
        // Short delay so toast is visible
        setTimeout(() => router.push(`/events/${event.id}`), 800);
      } else {
        setToast({ message: 'Failed to save event', type: 'error' });
        setIsGenerating(false);
      }
    } catch (error) {
      // Save event without AI plan so data isn't lost
      const saved = storageService.createEvent(event);
      if (saved) {
        clearDraft();
        setToast({ message: 'Event saved, but AI plan could not be generated. You can retry from the event page.', type: 'info' });
        setTimeout(() => router.push(`/events/${event.id}`), 1500);
      } else {
        setToast({
          message: error instanceof Error ? error.message : 'Failed to generate plan',
          type: 'error',
        });
        setIsGenerating(false);
      }
    }
  };

  const updateBasic = (field: keyof EventBasicInfo, value: string | number) => {
    setBasic((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const copy = { ...prev }; delete copy[field]; return copy; });
  };

  const updateBudget = (field: keyof EventBudgetInfo, value: unknown) => {
    setBudget((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const copy = { ...prev }; delete copy[field]; return copy; });
  };

  const togglePriority = (p: string) => {
    setBudget((prev) => {
      const current = prev.priorities || [];
      const next = current.includes(p as never)
        ? current.filter((x) => x !== p)
        : [...current, p as never];
      return { ...prev, priorities: next };
    });
  };

  const updatePrefs = (field: keyof EventPreferences, value: string) => {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  };

  const currencySymbol = CURRENCY_SYMBOLS[(budget.currency as keyof typeof CURRENCY_SYMBOLS) || 'INR'] || '₹';

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-300 no-print">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn btn-ghost btn-icon" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-display font-bold text-gray-900">Create New Event</h1>
              <p className="text-xs text-gray-500">Step {step} of 4: {STEP_LABELS[step - 1]}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Wizard Steps Indicator */}
        <nav aria-label="Wizard progress" className="wizard-steps mb-8">
          {STEP_LABELS.map((label, i) => {
            const stepNum = (i + 1) as WizardStep;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;
            return (
              <div key={label} className="flex items-center">
                {i > 0 && <div className={`wizard-step-connector ${isCompleted ? 'completed' : ''}`} />}
                <button
                  onClick={() => { if (isCompleted || isActive) setStep(stepNum); }}
                  className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${stepNum}: ${label}${isCompleted ? ' (completed)' : ''}`}
                >
                  <span className="wizard-step-number">
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="card card-body">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <PartyPopper className="w-5 h-5 text-primary-600" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tell us about your event</h2>
                <p className="text-sm text-gray-500">Basic details to get started</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="form-group">
                <label htmlFor="event-name" className="form-label form-label-required">Event Name</label>
                <input id="event-name" type="text" className={`form-input ${errors.name ? 'error' : ''}`} value={basic.name || ''} onChange={(e) => updateBasic('name', e.target.value)} placeholder="e.g., Sarah's Wedding, 30th Birthday" maxLength={200} />
                {errors.name && <p className="form-error" role="alert">{errors.name}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="event-type" className="form-label form-label-required">Event Type</label>
                <select id="event-type" className={`form-input ${errors.type ? 'error' : ''}`} value={basic.type || 'birthday'} onChange={(e) => updateBasic('type', e.target.value)}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                {errors.type && <p className="form-error" role="alert">{errors.type}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="event-date" className="form-label form-label-required">
                    <Calendar className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    Event Date
                  </label>
                  <input id="event-date" type="date" className={`form-input ${errors.date ? 'error' : ''}`} value={basic.date || ''} onChange={(e) => updateBasic('date', e.target.value)} />
                  {errors.date && <p className="form-error" role="alert">{errors.date}</p>}
                </div>

                <div className="form-group">
                  <label htmlFor="event-location" className="form-label form-label-required">
                    <MapPin className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    Location / City
                  </label>
                  <input id="event-location" type="text" className={`form-input ${errors.location ? 'error' : ''}`} value={basic.location || ''} onChange={(e) => updateBasic('location', e.target.value)} placeholder="e.g., Mumbai, Delhi" maxLength={200} />
                  {errors.location && <p className="form-error" role="alert">{errors.location}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="start-time" className="form-label">Start Time</label>
                  <input id="start-time" type="time" className="form-input" value={basic.startTime || ''} onChange={(e) => updateBasic('startTime', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="end-time" className="form-label">End Time</label>
                  <input id="end-time" type="time" className="form-input" value={basic.endTime || ''} onChange={(e) => updateBasic('endTime', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="venue-type" className="form-label form-label-required">Venue Type</label>
                <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label="Venue type">
                  {VENUE_TYPES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={basic.venueType === v}
                      onClick={() => updateBasic('venueType', v)}
                      className={`btn btn-sm ${basic.venueType === v ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="guest-count" className="form-label form-label-required">
                  <Users className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Expected Guests
                </label>
                <input id="guest-count" type="number" className={`form-input ${errors.guestCount ? 'error' : ''}`} value={basic.guestCount || ''} onChange={(e) => updateBasic('guestCount', parseInt(e.target.value) || 0)} min={1} max={100000} />
                {errors.guestCount && <p className="form-error" role="alert">{errors.guestCount}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Budget */}
        {step === 2 && (
          <div className="card card-body">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-accent-600" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Budget & Priorities</h2>
                <p className="text-sm text-gray-500">Set your financial plan</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="total-budget" className="form-label form-label-required">Total Budget ({currencySymbol})</label>
                  <input id="total-budget" type="number" className={`form-input ${errors.totalBudget ? 'error' : ''}`} value={budget.totalBudget || ''} onChange={(e) => updateBudget('totalBudget', parseFloat(e.target.value) || 0)} min={1} step={100} placeholder="e.g., 500000" />
                  {errors.totalBudget && <p className="form-error" role="alert">{errors.totalBudget}</p>}
                  <p className="form-hint">Enter amount in {budget.currency || 'INR'} (e.g., 500000 for {currencySymbol}5,00,000)</p>
                </div>

                <div className="form-group">
                  <label htmlFor="currency" className="form-label form-label-required">Currency</label>
                  <select id="currency" className="form-input" value={budget.currency || 'INR'} onChange={(e) => updateBudget('currency', e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="flexibility" className="form-label">Budget Flexibility</label>
                <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label="Budget flexibility">
                  {BUDGET_FLEXIBILITY.map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={budget.flexibility === f}
                      onClick={() => updateBudget('flexibility', f)}
                      className={`btn btn-sm ${budget.flexibility === f ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Spending Priorities</label>
                <p className="form-hint mb-2">Select areas you want to prioritize</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Spending priorities">
                  {SPENDING_PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={budget.priorities?.includes(p) || false}
                      onClick={() => togglePriority(p)}
                      className={`btn btn-sm ${budget.priorities?.includes(p) ? 'btn-accent' : 'btn-secondary'}`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={budget.includesAllExpenses ?? true} onChange={(e) => updateBudget('includesAllExpenses', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">This budget includes all event expenses</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <div className="card card-body">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-500" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Your Preferences</h2>
                <p className="text-sm text-gray-500">Optional details for better AI suggestions</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="pref-theme" className="form-label">Theme / Atmosphere</label>
                  <input id="pref-theme" type="text" className="form-input" value={prefs.theme || ''} onChange={(e) => updatePrefs('theme', e.target.value)} placeholder="e.g., Rustic Garden, Modern Minimalist" maxLength={500} />
                </div>
                <div className="form-group">
                  <label htmlFor="pref-style" className="form-label">Style</label>
                  <input id="pref-style" type="text" className="form-input" value={prefs.style || ''} onChange={(e) => updatePrefs('style', e.target.value)} placeholder="e.g., Formal, Casual, Traditional" maxLength={200} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="pref-colors" className="form-label">Color Palette</label>
                <input id="pref-colors" type="text" className="form-input" value={prefs.colorPalette || ''} onChange={(e) => updatePrefs('colorPalette', e.target.value)} placeholder="e.g., Blush pink, gold, ivory or #FFB6C1, #FFD700" maxLength={200} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="pref-food" className="form-label">Food Preferences</label>
                  <textarea id="pref-food" className="form-input" value={prefs.foodPreferences || ''} onChange={(e) => updatePrefs('foodPreferences', e.target.value)} placeholder="e.g., Indian vegetarian, multi-cuisine" maxLength={500} />
                </div>
                <div className="form-group">
                  <label htmlFor="pref-diet" className="form-label">Dietary Requirements</label>
                  <textarea id="pref-diet" className="form-input" value={prefs.dietaryRequirements || ''} onChange={(e) => updatePrefs('dietaryRequirements', e.target.value)} placeholder="e.g., Vegan options, nut-free" maxLength={500} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="pref-cultural" className="form-label">Cultural Considerations</label>
                <textarea id="pref-cultural" className="form-input" value={prefs.culturalConsiderations || ''} onChange={(e) => updatePrefs('culturalConsiderations', e.target.value)} placeholder="e.g., Traditional Hindu ceremony, Mehndi function" maxLength={500} />
              </div>

              <div className="form-group">
                <label htmlFor="pref-accessibility" className="form-label">Accessibility Needs</label>
                <textarea id="pref-accessibility" className="form-input" value={prefs.accessibilityNeeds || ''} onChange={(e) => updatePrefs('accessibilityNeeds', e.target.value)} placeholder="e.g., Wheelchair access, hearing loop, quiet area" maxLength={500} />
              </div>

              <div className="form-group">
                <label htmlFor="pref-weather" className="form-label">Weather / Indoor Backup</label>
                <textarea id="pref-weather" className="form-input" value={prefs.weatherBackup || ''} onChange={(e) => updatePrefs('weatherBackup', e.target.value)} placeholder="e.g., Need indoor backup if rain" maxLength={500} />
              </div>

              <div className="form-group">
                <label htmlFor="pref-special" className="form-label">Special Requests</label>
                <textarea id="pref-special" className="form-input" value={prefs.specialRequests || ''} onChange={(e) => updatePrefs('specialRequests', e.target.value)} placeholder="Any additional details or special requests" maxLength={2000} rows={3} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="card card-body">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-success-500" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Review Your Event</h2>
                  <p className="text-sm text-gray-500">Confirm details before creating</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Basic Info Review */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">Basic Information</h3>
                    <button onClick={() => setStep(1)} className="btn btn-ghost btn-sm text-primary-600">Edit</button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-gray-500">Event Name</dt>
                    <dd className="text-gray-900 font-medium">{basic.name}</dd>
                    <dt className="text-gray-500">Type</dt>
                    <dd className="text-gray-900">{EVENT_TYPE_LABELS[basic.type as keyof typeof EVENT_TYPE_LABELS] || basic.type}</dd>
                    <dt className="text-gray-500">Date</dt>
                    <dd className="text-gray-900">{basic.date}</dd>
                    <dt className="text-gray-500">Location</dt>
                    <dd className="text-gray-900">{basic.location}</dd>
                    <dt className="text-gray-500">Venue</dt>
                    <dd className="text-gray-900 capitalize">{basic.venueType}</dd>
                    <dt className="text-gray-500">Guests</dt>
                    <dd className="text-gray-900">{basic.guestCount}</dd>
                    {basic.startTime && <>
                      <dt className="text-gray-500">Time</dt>
                      <dd className="text-gray-900">{basic.startTime}{basic.endTime ? ` – ${basic.endTime}` : ''}</dd>
                    </>}
                  </dl>
                </div>

                <hr className="border-surface-200" />

                {/* Budget Review */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">Budget</h3>
                    <button onClick={() => setStep(2)} className="btn btn-ghost btn-sm text-primary-600">Edit</button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-gray-500">Total Budget</dt>
                    <dd className="text-gray-900 font-medium">{currencySymbol}{(budget.totalBudget || 0).toLocaleString()}</dd>
                    <dt className="text-gray-500">Currency</dt>
                    <dd className="text-gray-900">{budget.currency}</dd>
                    <dt className="text-gray-500">Flexibility</dt>
                    <dd className="text-gray-900 capitalize">{budget.flexibility}</dd>
                    {budget.priorities && budget.priorities.length > 0 && <>
                      <dt className="text-gray-500">Priorities</dt>
                      <dd className="text-gray-900 capitalize">{budget.priorities.join(', ')}</dd>
                    </>}
                  </dl>
                </div>

                <hr className="border-surface-200" />

                {/* Preferences Review */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">Preferences</h3>
                    <button onClick={() => setStep(3)} className="btn btn-ghost btn-sm text-primary-600">Edit</button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {prefs.theme && <><dt className="text-gray-500">Theme</dt><dd className="text-gray-900">{prefs.theme}</dd></>}
                    {prefs.style && <><dt className="text-gray-500">Style</dt><dd className="text-gray-900">{prefs.style}</dd></>}
                    {prefs.foodPreferences && <><dt className="text-gray-500">Food</dt><dd className="text-gray-900">{prefs.foodPreferences}</dd></>}
                    {prefs.accessibilityNeeds && <><dt className="text-gray-500">Accessibility</dt><dd className="text-gray-900">{prefs.accessibilityNeeds}</dd></>}
                    {!prefs.theme && !prefs.style && !prefs.foodPreferences && !prefs.accessibilityNeeds && (
                      <dd className="text-gray-400 col-span-2">No preferences specified</dd>
                    )}
                  </dl>
                </div>
              </div>
            </div>

            {/* AI Notice */}
            <div className="p-4 rounded-lg bg-info-100 border border-blue-200 text-sm text-blue-800">
              <p className="font-medium mb-1">About AI Plan Generation</p>
              <p>When you choose &ldquo;Generate AI Plan&rdquo;, your event details will be sent to the configured AI provider to create a personalized plan. If no AI provider is configured, a local demo plan will be generated instead.</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 gap-4">
          <button onClick={step === 1 ? () => router.push('/') : goBack} className="btn btn-secondary">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 4 ? (
            <button onClick={goNext} className="btn btn-primary">
              Next
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <div className="flex gap-3 flex-wrap justify-end">
              <button onClick={handleSaveOnly} disabled={isSubmitting || isGenerating} className="btn btn-secondary">
                <Save className="w-4 h-4" aria-hidden="true" />
                {isSubmitting ? 'Saving...' : 'Save Without AI'}
              </button>
              <button onClick={handleGenerateAI} disabled={isSubmitting || isGenerating} className="btn btn-primary">
                {isGenerating ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    Generate AI Plan
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Generating Overlay */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" role="alert" aria-live="assertive">
            <div className="bg-white rounded-xl p-8 max-w-sm text-center shadow-2xl">
              <div className="spinner mx-auto mb-4" style={{ width: '2.5rem', height: '2.5rem' }} aria-hidden="true"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Creating your event plan</h3>
              <p className="text-sm text-gray-500">This may take up to a minute. Your event data is safe.</p>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
