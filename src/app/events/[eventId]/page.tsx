'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import type { CelebrioEvent, BudgetItem, EventTask, Vendor, EventIdea, VendorCategory, VendorStatus, TaskPriority, TaskCategory, PaymentStatus } from '@/types/event';
import { EVENT_TYPE_LABELS, VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS, VENDOR_STATUSES, VENDOR_STATUS_LABELS, TASK_PRIORITIES, TASK_CATEGORIES, PAYMENT_STATUSES, CURRENCY_SYMBOLS } from '@/types/event';
import { storageService } from '@/lib/storage/storage-service';
import {
  calculateEventProgress, calculateDaysRemaining, calculateTotalPlanned,
  calculateTotalActual, calculateRemainingBudget, calculateAvailableFunds,
  isBudgetOverPlanned, formatCurrency, formatCurrencyCompact, toMajorUnits,
  toMinorUnits, getUpcomingTasks, getOverdueTasks, getBudgetByCategory,
  exportBudgetCsv, calculateBudgetUtilization, calculatePlannedUtilization,
} from '@/lib/calculations/budget';
import {
  ArrowLeft, Calendar, Users, MapPin, TrendingUp, Wallet,
  Plus, Trash2, Edit2, Check, X, CheckCircle2, Circle, Clock,
  AlertTriangle, Download, ChevronDown, ChevronUp, ExternalLink,
  Sparkles, Save, Lightbulb, Settings, LayoutDashboard, ListTodo,
  Store, Filter, Printer, FileText, Star, StarOff,
} from 'lucide-react';

type Tab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas' | 'settings';

export default function EventWorkspacePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<CelebrioEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadEvent = useCallback(() => {
    const e = storageService.getEvent(eventId);
    setEvent(e);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const saveEvent = useCallback((updated: CelebrioEvent) => {
    const success = storageService.updateEvent(updated);
    if (success) {
      setEvent(updated);
    } else {
      setToast({ message: 'Failed to save changes', type: 'error' });
    }
    return success;
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: '2.5rem', height: '2.5rem' }}></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Event not found</h2>
          <p className="text-gray-500 mb-4">This event may have been deleted.</p>
          <Link href="/" className="btn btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const currency = event.budgetInfo.currency;
  const currencySymbol = CURRENCY_SYMBOLS[currency] || '₹';
  const progress = calculateEventProgress(event);
  const daysLeft = calculateDaysRemaining(event.basicInfo.date);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'budget', label: 'Budget', icon: <Wallet className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <ListTodo className="w-4 h-4" /> },
    { id: 'vendors', label: 'Vendors', icon: <Store className="w-4 h-4" /> },
    { id: 'ideas', label: 'Ideas', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-300 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="btn btn-ghost btn-icon flex-shrink-0" aria-label="Back to dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg font-display font-bold text-gray-900 truncate">{event.basicInfo.name}</h1>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{EVENT_TYPE_LABELS[event.basicInfo.type]}</span>
                  <span>·</span>
                  <span>{daysLeft >= 0 ? `${daysLeft} days left` : 'Past event'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {event.aiPlan && (
                <span className={`badge ${event.aiPlanSource === 'ai' ? 'badge-primary' : 'badge-info'} hidden sm:inline-flex`}>
                  {event.aiPlanSource === 'ai' ? 'AI Plan' : 'Demo Plan'}
                </span>
              )}
              <button onClick={() => window.print()} className="btn btn-ghost btn-sm btn-icon no-print" aria-label="Print event summary">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="tabs no-print" aria-label="Event sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                <span className="flex items-center gap-1.5">
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab event={event} currency={currency} progress={progress} daysLeft={daysLeft} saveEvent={saveEvent} showToast={showToast} />}
        {activeTab === 'budget' && <BudgetTab event={event} currency={currency} currencySymbol={currencySymbol} saveEvent={saveEvent} showToast={showToast} />}
        {activeTab === 'timeline' && <TimelineTab event={event} saveEvent={saveEvent} showToast={showToast} />}
        {activeTab === 'vendors' && <VendorsTab event={event} currency={currency} currencySymbol={currencySymbol} saveEvent={saveEvent} showToast={showToast} />}
        {activeTab === 'ideas' && <IdeasTab event={event} currency={currency} saveEvent={saveEvent} showToast={showToast} />}
        {activeTab === 'settings' && <SettingsTab event={event} saveEvent={saveEvent} showToast={showToast} onDelete={() => { storageService.deleteEvent(eventId); router.push('/'); }} />}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ===== OVERVIEW TAB =====
function OverviewTab({
  event,
  currency,
  progress,
  daysLeft,
  saveEvent,
  showToast,
}: {
  event: CelebrioEvent;
  currency: typeof CURRENCY_SYMBOLS extends Record<infer K, string> ? K : never;
  progress: number;
  daysLeft: number;
  saveEvent: (e: CelebrioEvent) => boolean;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const totalPlanned = calculateTotalPlanned(event.budgetItems);
  const totalActual = calculateTotalActual(event.budgetItems);
  const completedTasks = event.tasks.filter((t) => t.completed).length;
  const overdue = getOverdueTasks(event);
  const upcoming = getUpcomingTasks(event, 5);
  const bookedVendors = event.vendors.filter((v) => v.status === 'booked').length;

  const handleGeneratePlan = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basicInfo: event.basicInfo,
          budgetInfo: event.budgetInfo,
          preferences: event.preferences,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'AI generation failed');
      }

      const data = await response.json();
      const plan = data.plan;

      const newBudgetItems: BudgetItem[] = plan.budget
        ? plan.budget.map((b: { category: string; estimatedAmount: number; reason: string }) => ({
            id: uuidv4(),
            category: b.category,
            description: b.reason,
            plannedAmount: b.estimatedAmount,
            actualAmount: 0,
            paymentStatus: 'unpaid' as const,
            notes: '',
          }))
        : event.budgetItems;

      const newTasks: EventTask[] = plan.timeline
        ? plan.timeline.map((t: { title: string; description: string; dueDate: string; priority: string; category: string }) => ({
            id: uuidv4(),
            title: t.title,
            description: t.description,
            dueDate: t.dueDate,
            priority: t.priority as any,
            category: t.category as any,
            completed: false,
            notes: '',
          }))
        : event.tasks;

      const newVendors: Vendor[] = plan.vendorChecklist
        ? plan.vendorChecklist.map((v: { category: string; title: string; description: string }) => ({
            id: uuidv4(),
            name: v.title,
            category: v.category as any,
            status: 'to-research' as const,
            notes: v.description,
          }))
        : event.vendors;

      const newIdeas: EventIdea[] = plan.ideas
        ? plan.ideas.map((idea: { title: string; description: string; estimatedCost?: number; category: string }) => ({
            id: uuidv4(),
            title: idea.title,
            description: idea.description,
            estimatedCost: idea.estimatedCost,
            category: idea.category,
            saved: false,
          }))
        : event.ideas;

      const updated: CelebrioEvent = {
        ...event,
        aiPlan: plan,
        aiPlanGeneratedAt: new Date().toISOString(),
        aiPlanSource: data.source,
        budgetItems: event.budgetItems.length === 0 ? newBudgetItems : event.budgetItems,
        tasks: event.tasks.length === 0 ? newTasks : event.tasks,
        vendors: event.vendors.length === 0 ? newVendors : event.vendors,
        ideas: event.ideas.length === 0 ? newIdeas : event.ideas,
        updatedAt: new Date().toISOString(),
      };

      if (saveEvent(updated)) {
        showToast(
          data.source === 'ai' ? 'AI Plan generated successfully with Gemini!' : 'Demo Plan generated locally.',
          'success'
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate plan', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate AI Plan Banner if not yet generated */}
      {!event.aiPlan && (
        <div className="card card-body bg-gradient-to-r from-purple-50 via-white to-amber-50 border-2 border-primary-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-base">Generate Complete AI Plan</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Let Google Gemini automatically design a custom theme, color palette, smart budget allocation, and checklist for your celebration.
                </p>
              </div>
            </div>
            <button
              id="btn-generate-gemini-plan"
              onClick={handleGeneratePlan}
              disabled={isGenerating}
              className="btn btn-primary whitespace-nowrap shadow-sm hover:shadow-md transition-shadow"
            >
              {isGenerating ? (
                <>
                  <span className="spinner w-4 h-4 mr-2" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Generate with Gemini
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Event Summary & Concept */}
      {event.aiPlan?.eventSummary && (
        <div className="card card-body space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Event Concept & Summary</h2>
            <div className="flex items-center gap-2">
              <span className={`badge ${event.aiPlanSource === 'ai' ? 'badge-primary' : 'badge-info'}`}>
                {event.aiPlanSource === 'ai' ? 'Gemini AI' : 'Demo Plan'}
              </span>
              <button
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="btn btn-ghost btn-sm text-xs text-primary-700"
                title="Regenerate plan with Gemini"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                {isGenerating ? 'Updating...' : 'Regenerate'}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{event.aiPlan.eventSummary}</p>

          {/* Theme Concept & Color Palette */}
          {event.aiPlan.concept && (
            <div className="p-4 rounded-xl bg-surface-100 border border-surface-200 mt-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-primary-900 text-sm">Theme: {event.aiPlan.concept.name}</h3>
                {event.aiPlan.concept.colorPalette && event.aiPlan.concept.colorPalette.length > 0 && (
                  <div className="flex items-center gap-1.5" title="Color Palette">
                    {event.aiPlan.concept.colorPalette.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-6 h-6 rounded-full border border-white shadow-sm flex items-center justify-center text-[10px] font-mono text-transparent hover:text-white"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{event.aiPlan.concept.description}</p>
              {event.aiPlan.concept.rationale && (
                <p className="text-xs text-gray-500 italic border-l-2 border-primary-300 pl-2">
                  &ldquo;{event.aiPlan.concept.rationale}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Contingencies */}
          {event.aiPlan.contingencies && event.aiPlan.contingencies.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Contingency Strategies</h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {event.aiPlan.contingencies.map((c, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white border border-gray-100 text-xs">
                    <span className="font-medium text-gray-900">{c.risk}: </span>
                    <span className="text-gray-600">{c.mitigation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-body text-center">
          <p className="text-2xl font-bold text-primary-700">{daysLeft >= 0 ? daysLeft : '—'}</p>
          <p className="text-xs text-gray-500">{daysLeft >= 0 ? 'Days Remaining' : 'Event has passed'}</p>
        </div>
        <div className="card card-body text-center">
          <p className="text-2xl font-bold text-gray-900">{progress}%</p>
          <p className="text-xs text-gray-500">Planning Progress</p>
        </div>
        <div className="card card-body text-center">
          <p className="text-2xl font-bold text-accent-600">{formatCurrencyCompact(totalActual, currency)}</p>
          <p className="text-xs text-gray-500">of {formatCurrencyCompact(event.budgetInfo.totalBudget, currency)} spent</p>
        </div>
        <div className="card card-body text-center">
          <p className="text-2xl font-bold text-gray-900">{completedTasks}/{event.tasks.length}</p>
          <p className="text-xs text-gray-500">Tasks Completed</p>
        </div>
      </div>

      {/* Progress */}
      <div className="card card-body">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900">Overall Progress</h3>
          <span className="text-sm font-medium text-primary-700">{progress}%</span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Planning progress: ${progress}%`}>
          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }}></div>
        </div>
      </div>

      {/* Overdue Warning */}
      {overdue.length > 0 && (
        <div className="p-4 rounded-lg bg-danger-100 border border-red-200" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-danger-500">{overdue.length} Overdue Task{overdue.length > 1 ? 's' : ''}</p>
              <ul className="mt-1 space-y-1">
                {overdue.slice(0, 3).map((t) => (
                  <li key={t.id} className="text-sm text-red-600">{t.title} (due {t.dueDate})</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Tasks */}
        <div className="card card-body">
          <h3 className="font-medium text-gray-900 mb-3">Upcoming Tasks</h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming tasks</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.priority === 'critical' ? 'bg-danger-500' : t.priority === 'high' ? 'bg-accent-500' : 'bg-gray-300'}`} />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-gray-400">{t.dueDate}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Vendor Status */}
        <div className="card card-body">
          <h3 className="font-medium text-gray-900 mb-3">Vendor Status</h3>
          {event.vendors.length === 0 ? (
            <p className="text-sm text-gray-400">No vendors added yet</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Vendors</span>
                <span className="font-medium">{event.vendors.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Booked</span>
                <span className="font-medium text-success-500">{bookedVendors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pending</span>
                <span className="font-medium text-accent-600">{event.vendors.length - bookedVendors}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Details */}
      <div className="card card-body">
        <h3 className="font-medium text-gray-900 mb-3">Event Details</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date</dt>
            <dd className="font-medium text-gray-900 mt-0.5">{event.basicInfo.date}</dd>
          </div>
          <div>
            <dt className="text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location</dt>
            <dd className="font-medium text-gray-900 mt-0.5">{event.basicInfo.location}</dd>
          </div>
          <div>
            <dt className="text-gray-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Guests</dt>
            <dd className="font-medium text-gray-900 mt-0.5">{event.basicInfo.guestCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Venue</dt>
            <dd className="font-medium text-gray-900 mt-0.5 capitalize">{event.basicInfo.venueType}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Budget</dt>
            <dd className="font-medium text-gray-900 mt-0.5">{formatCurrencyCompact(event.budgetInfo.totalBudget, currency)}</dd>
          </div>
          {event.basicInfo.startTime && (
            <div>
              <dt className="text-gray-500">Time</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{event.basicInfo.startTime}{event.basicInfo.endTime ? ` – ${event.basicInfo.endTime}` : ''}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

// ===== BUDGET TAB =====
function BudgetTab({ event, currency, currencySymbol, saveEvent, showToast }: {
  event: CelebrioEvent; currency: string; currencySymbol: string;
  saveEvent: (e: CelebrioEvent) => boolean;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ category: '', description: '', plannedAmount: 0, actualAmount: 0, paymentStatus: 'unpaid' as PaymentStatus, notes: '' });

  const totalBudget = event.budgetInfo.totalBudget;
  const items = event.budgetItems;
  const totalPlanned = calculateTotalPlanned(items);
  const totalActual = calculateTotalActual(items);
  const remaining = calculateRemainingBudget(totalBudget, items);
  const available = calculateAvailableFunds(totalBudget, items);
  const overPlanned = isBudgetOverPlanned(totalBudget, items);
  const utilization = calculateBudgetUtilization(totalBudget, items);
  const plannedUtil = calculatePlannedUtilization(totalBudget, items);
  const categoryBreakdown = getBudgetByCategory(items);

  const addItem = () => {
    if (!newItem.category || !newItem.description) {
      showToast('Category and description are required', 'error');
      return;
    }
    const item: BudgetItem = {
      id: uuidv4(),
      category: newItem.category,
      description: newItem.description,
      plannedAmount: toMinorUnits(newItem.plannedAmount),
      actualAmount: toMinorUnits(newItem.actualAmount),
      paymentStatus: newItem.paymentStatus,
      notes: newItem.notes,
    };
    const updated = { ...event, budgetItems: [...event.budgetItems, item] };
    if (saveEvent(updated)) {
      setShowAddForm(false);
      setNewItem({ category: '', description: '', plannedAmount: 0, actualAmount: 0, paymentStatus: 'unpaid', notes: '' });
      showToast('Budget item added', 'success');
    }
  };

  const deleteItem = (id: string) => {
    const updated = { ...event, budgetItems: event.budgetItems.filter((i) => i.id !== id) };
    saveEvent(updated);
    showToast('Budget item removed', 'success');
  };

  const updateItem = (id: string, changes: Partial<BudgetItem>) => {
    const updated = {
      ...event,
      budgetItems: event.budgetItems.map((i) => i.id === id ? { ...i, ...changes } : i),
    };
    saveEvent(updated);
  };

  const handleExportCsv = () => {
    const csv = exportBudgetCsv(items, event.budgetInfo.currency);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.basicInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}_budget.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Budget exported as CSV', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Budget Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-body">
          <p className="text-xs text-gray-500 mb-1">Total Budget</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalBudget, event.budgetInfo.currency)}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 mb-1">Planned</p>
          <p className={`text-lg font-bold ${overPlanned ? 'text-danger-500' : 'text-gray-900'}`}>{formatCurrency(totalPlanned, event.budgetInfo.currency)}</p>
          <p className="text-xs text-gray-400">{plannedUtil}% of budget</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 mb-1">Actual Spent</p>
          <p className="text-lg font-bold text-accent-600">{formatCurrency(totalActual, event.budgetInfo.currency)}</p>
          <p className="text-xs text-gray-400">{utilization}% utilized</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 mb-1">Remaining</p>
          <p className={`text-lg font-bold ${available < 0 ? 'text-danger-500' : 'text-success-500'}`}>{formatCurrency(available, event.budgetInfo.currency)}</p>
          <p className="text-xs text-gray-400">After actual spending</p>
        </div>
      </div>

      {/* Over-budget warning */}
      {overPlanned && (
        <div className="p-4 rounded-lg bg-danger-100 border border-red-200" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-danger-500">Budget Over-planned</p>
              <p className="text-sm text-red-600 mt-1">Your planned expenses exceed the total budget by {formatCurrency(totalPlanned - totalBudget, event.budgetInfo.currency)}. Consider reducing allocations or removing optional items.</p>
            </div>
          </div>
        </div>
      )}

      {/* Budget Utilization Bar */}
      <div className="card card-body">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900">Budget Utilization</h3>
          <span className="text-sm text-gray-500">{utilization}%</span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={utilization} aria-valuemin={0} aria-valuemax={100} aria-label={`Budget utilization: ${utilization}%`}>
          <div className={`progress-fill ${utilization > 100 ? 'over-budget' : ''}`} style={{ width: `${Math.min(utilization, 100)}%` }}></div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Planned: {formatCurrency(totalPlanned, event.budgetInfo.currency)} · Spent: {formatCurrency(totalActual, event.budgetInfo.currency)} · Available: {formatCurrency(available, event.budgetInfo.currency)}
        </p>
      </div>

      {/* Category Breakdown */}
      {Object.keys(categoryBreakdown).length > 0 && (
        <div className="card card-body">
          <h3 className="font-medium text-gray-900 mb-3">Category Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(categoryBreakdown).map(([cat, data]) => (
              <div key={cat}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{cat}</span>
                  <span className="text-gray-500">{formatCurrencyCompact(data.planned, event.budgetInfo.currency)}</span>
                </div>
                <div className="progress-bar" style={{ height: '4px' }}>
                  <div className="progress-fill" style={{ width: `${totalBudget > 0 ? Math.min((data.planned / totalBudget) * 100, 100) : 0}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Budget Items ({items.length})</h3>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button onClick={handleExportCsv} className="btn btn-ghost btn-sm">
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card card-body border-primary-200">
          <h4 className="font-medium text-gray-900 mb-4">New Budget Item</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="bi-category" className="form-label form-label-required">Category</label>
              <input id="bi-category" className="form-input" value={newItem.category} onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))} placeholder="e.g., Venue, Catering" />
            </div>
            <div className="form-group">
              <label htmlFor="bi-description" className="form-label form-label-required">Description</label>
              <input id="bi-description" className="form-input" value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} placeholder="e.g., Wedding venue deposit" />
            </div>
            <div className="form-group">
              <label htmlFor="bi-planned" className="form-label">Planned ({currencySymbol})</label>
              <input id="bi-planned" type="number" className="form-input" value={newItem.plannedAmount || ''} onChange={(e) => setNewItem((p) => ({ ...p, plannedAmount: parseFloat(e.target.value) || 0 }))} min={0} step={100} />
            </div>
            <div className="form-group">
              <label htmlFor="bi-actual" className="form-label">Actual ({currencySymbol})</label>
              <input id="bi-actual" type="number" className="form-input" value={newItem.actualAmount || ''} onChange={(e) => setNewItem((p) => ({ ...p, actualAmount: parseFloat(e.target.value) || 0 }))} min={0} step={100} />
            </div>
            <div className="form-group">
              <label htmlFor="bi-status" className="form-label">Payment Status</label>
              <select id="bi-status" className="form-input" value={newItem.paymentStatus} onChange={(e) => setNewItem((p) => ({ ...p, paymentStatus: e.target.value as PaymentStatus }))}>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="bi-notes" className="form-label">Notes</label>
              <input id="bi-notes" className="form-input" value={newItem.notes} onChange={(e) => setNewItem((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowAddForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={addItem} className="btn btn-primary btn-sm">Add Item</button>
          </div>
        </div>
      )}

      {/* Budget Items List */}
      {items.length === 0 ? (
        <div className="empty-state">
          <Wallet className="empty-state-icon" />
          <p className="text-gray-500 mb-2">No budget items yet</p>
          <p className="text-sm text-gray-400">Add items to track your event expenses</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <BudgetItemRow
              key={item.id}
              item={item}
              currency={event.budgetInfo.currency}
              currencySymbol={currencySymbol}
              isEditing={editingId === item.id}
              onEdit={() => setEditingId(item.id)}
              onCancel={() => setEditingId(null)}
              onSave={(changes) => { updateItem(item.id, changes); setEditingId(null); showToast('Item updated', 'success'); }}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetItemRow({ item, currency, currencySymbol, isEditing, onEdit, onCancel, onSave, onDelete }: {
  item: BudgetItem; currency: string; currencySymbol: string; isEditing: boolean;
  onEdit: () => void; onCancel: () => void; onSave: (changes: Partial<BudgetItem>) => void; onDelete: () => void;
}) {
  const [editState, setEditState] = useState({
    category: item.category,
    description: item.description,
    plannedAmount: toMajorUnits(item.plannedAmount),
    actualAmount: toMajorUnits(item.actualAmount),
    paymentStatus: item.paymentStatus,
    notes: item.notes || '',
  });

  useEffect(() => {
    if (isEditing) {
      setEditState({
        category: item.category,
        description: item.description,
        plannedAmount: toMajorUnits(item.plannedAmount),
        actualAmount: toMajorUnits(item.actualAmount),
        paymentStatus: item.paymentStatus,
        notes: item.notes || '',
      });
    }
  }, [isEditing, item]);

  if (isEditing) {
    return (
      <div className="card card-body border-primary-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label text-xs">Category</label>
            <input className="form-input" value={editState.category} onChange={(e) => setEditState((p) => ({ ...p, category: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Description</label>
            <input className="form-input" value={editState.description} onChange={(e) => setEditState((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Planned ({currencySymbol})</label>
            <input type="number" className="form-input" value={editState.plannedAmount} onChange={(e) => setEditState((p) => ({ ...p, plannedAmount: parseFloat(e.target.value) || 0 }))} min={0} />
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Actual ({currencySymbol})</label>
            <input type="number" className="form-input" value={editState.actualAmount} onChange={(e) => setEditState((p) => ({ ...p, actualAmount: parseFloat(e.target.value) || 0 }))} min={0} />
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Payment Status</label>
            <select className="form-input" value={editState.paymentStatus} onChange={(e) => setEditState((p) => ({ ...p, paymentStatus: e.target.value as PaymentStatus }))}>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Notes</label>
            <input className="form-input" value={editState.notes} onChange={(e) => setEditState((p) => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="btn btn-secondary btn-sm"><X className="w-3 h-3" /> Cancel</button>
          <button onClick={() => onSave({
            category: editState.category,
            description: editState.description,
            plannedAmount: toMinorUnits(editState.plannedAmount),
            actualAmount: toMinorUnits(editState.actualAmount),
            paymentStatus: editState.paymentStatus,
            notes: editState.notes,
          })} className="btn btn-primary btn-sm"><Check className="w-3 h-3" /> Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-body flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="badge badge-primary text-xs">{item.category}</span>
          <span className={`badge text-xs ${item.paymentStatus === 'paid' ? 'badge-success' : item.paymentStatus === 'partially-paid' ? 'badge-warning' : 'badge-danger'}`}>
            {item.paymentStatus.replace('-', ' ')}
          </span>
        </div>
        <p className="text-sm text-gray-900">{item.description}</p>
        {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">Planned: {formatCurrency(item.plannedAmount, currency as 'INR')}</p>
          <p className="text-xs text-gray-500">Actual: {formatCurrency(item.actualAmount, currency as 'INR')}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="btn btn-ghost btn-sm btn-icon" aria-label="Edit item"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="btn btn-ghost btn-sm btn-icon text-danger-500" aria-label="Delete item"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

// ===== TIMELINE TAB =====
function TimelineTab({ event, saveEvent, showToast }: {
  event: CelebrioEvent;
  saveEvent: (e: CelebrioEvent) => boolean;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', priority: 'medium' as TaskPriority, category: 'other' as TaskCategory, notes: '' });

  const today = new Date().toISOString().split('T')[0];

  let filteredTasks = [...event.tasks];
  if (statusFilter === 'pending') filteredTasks = filteredTasks.filter((t) => !t.completed);
  if (statusFilter === 'completed') filteredTasks = filteredTasks.filter((t) => t.completed);
  if (statusFilter === 'overdue') filteredTasks = filteredTasks.filter((t) => !t.completed && t.dueDate < today);
  if (priorityFilter !== 'all') filteredTasks = filteredTasks.filter((t) => t.priority === priorityFilter);

  filteredTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const toggleComplete = (taskId: string) => {
    const updated = {
      ...event,
      tasks: event.tasks.map((t) => t.id === taskId ? { ...t, completed: !t.completed } : t),
    };
    saveEvent(updated);
  };

  const addTask = () => {
    if (!newTask.title || !newTask.dueDate) {
      showToast('Title and due date are required', 'error');
      return;
    }
    const task: EventTask = {
      id: uuidv4(),
      title: newTask.title,
      description: newTask.description,
      dueDate: newTask.dueDate,
      priority: newTask.priority,
      category: newTask.category,
      completed: false,
      notes: newTask.notes,
    };
    const updated = { ...event, tasks: [...event.tasks, task] };
    if (saveEvent(updated)) {
      setShowAddForm(false);
      setNewTask({ title: '', description: '', dueDate: '', priority: 'medium', category: 'other', notes: '' });
      showToast('Task added', 'success');
    }
  };

  const deleteTask = (id: string) => {
    const updated = { ...event, tasks: event.tasks.filter((t) => t.id !== id) };
    saveEvent(updated);
    showToast('Task removed', 'success');
  };

  const updateTask = (id: string, changes: Partial<EventTask>) => {
    const updated = {
      ...event,
      tasks: event.tasks.map((t) => t.id === id ? { ...t, ...changes } : t),
    };
    saveEvent(updated);
    setEditingId(null);
    showToast('Task updated', 'success');
  };

  const overdueTasks = event.tasks.filter((t) => !t.completed && t.dueDate < today);
  const completedCount = event.tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-body text-center">
          <p className="text-2xl font-bold text-gray-900">{event.tasks.length}</p>
          <p className="text-xs text-gray-500">Total Tasks</p>
        </div>
        <div className="card card-body text-center">
          <p className="text-2xl font-bold text-success-500">{completedCount}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="card card-body text-center">
          <p className="text-2xl font-bold text-gray-900">{event.tasks.length - completedCount}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div className="card card-body text-center">
          <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-danger-500' : 'text-success-500'}`}>{overdueTasks.length}</p>
          <p className="text-xs text-gray-500">Overdue</p>
        </div>
      </div>

      {/* Filters and Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-400" aria-hidden="true" />
            {(['all', 'pending', 'completed', 'overdue'] as const).map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-ghost'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <select className="form-input py-1 px-2 text-xs w-auto" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filter by priority">
            <option value="all">All Priorities</option>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <div className="card card-body border-primary-200">
          <h4 className="font-medium text-gray-900 mb-4">New Task</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group sm:col-span-2">
              <label htmlFor="task-title" className="form-label form-label-required">Title</label>
              <input id="task-title" className="form-input" value={newTask.title} onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., Book venue" />
            </div>
            <div className="form-group">
              <label htmlFor="task-due" className="form-label form-label-required">Due Date</label>
              <input id="task-due" type="date" className="form-input" value={newTask.dueDate} onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="task-priority" className="form-label">Priority</label>
              <select id="task-priority" className="form-input" value={newTask.priority} onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as TaskPriority }))}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="task-category" className="form-label">Category</label>
              <select id="task-category" className="form-input" value={newTask.category} onChange={(e) => setNewTask((p) => ({ ...p, category: e.target.value as TaskCategory }))}>
                {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="task-desc" className="form-label">Description</label>
              <input id="task-desc" className="form-input" value={newTask.description} onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowAddForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={addTask} className="btn btn-primary btn-sm">Add Task</button>
          </div>
        </div>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <ListTodo className="empty-state-icon" />
          <p className="text-gray-500 mb-2">{event.tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}</p>
          <p className="text-sm text-gray-400">Add tasks to track your event preparation</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              isEditing={editingId === task.id}
              onToggle={() => toggleComplete(task.id)}
              onEdit={() => setEditingId(task.id)}
              onSave={(changes) => updateTask(task.id, changes)}
              onCancel={() => setEditingId(null)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, today, isEditing, onToggle, onEdit, onSave, onCancel, onDelete }: {
  task: EventTask; today: string; isEditing: boolean;
  onToggle: () => void; onEdit: () => void; onSave: (changes: Partial<EventTask>) => void; onCancel: () => void; onDelete: () => void;
}) {
  const isOverdue = !task.completed && task.dueDate < today;
  const [editState, setEditState] = useState({ title: task.title, description: task.description, dueDate: task.dueDate, priority: task.priority, category: task.category, notes: task.notes || '' });

  useEffect(() => {
    if (isEditing) {
      setEditState({ title: task.title, description: task.description, dueDate: task.dueDate, priority: task.priority, category: task.category, notes: task.notes || '' });
    }
  }, [isEditing, task]);

  if (isEditing) {
    return (
      <div className="card card-body border-primary-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-group sm:col-span-2">
            <label className="form-label text-xs">Title</label>
            <input className="form-input" value={editState.title} onChange={(e) => setEditState((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Due Date</label>
            <input type="date" className="form-input" value={editState.dueDate} onChange={(e) => setEditState((p) => ({ ...p, dueDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Priority</label>
            <select className="form-input" value={editState.priority} onChange={(e) => setEditState((p) => ({ ...p, priority: e.target.value as TaskPriority }))}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Category</label>
            <select className="form-input" value={editState.category} onChange={(e) => setEditState((p) => ({ ...p, category: e.target.value as TaskCategory }))}>
              {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Description</label>
            <input className="form-input" value={editState.description} onChange={(e) => setEditState((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={() => onSave(editState)} className="btn btn-primary btn-sm">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card card-body flex items-start gap-3 ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0"
        aria-label={task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
      >
        {task.completed ? (
          <CheckCircle2 className="w-5 h-5 text-success-500" />
        ) : (
          <Circle className="w-5 h-5 text-gray-300 hover:text-primary-400" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
        {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`badge text-xs ${task.priority === 'critical' ? 'badge-danger' : task.priority === 'high' ? 'badge-accent' : task.priority === 'medium' ? 'badge-warning' : 'badge-info'}`}>
            {task.priority}
          </span>
          <span className="badge badge-primary text-xs">{task.category}</span>
          <span className={`text-xs ${isOverdue ? 'text-danger-500 font-medium' : 'text-gray-400'}`}>
            {isOverdue ? 'Overdue: ' : ''}{task.dueDate}
          </span>
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="btn btn-ghost btn-sm btn-icon" aria-label="Edit task"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="btn btn-ghost btn-sm btn-icon text-danger-500" aria-label="Delete task"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

// ===== VENDORS TAB =====
function VendorsTab({ event, currency, currencySymbol, saveEvent, showToast }: {
  event: CelebrioEvent; currency: string; currencySymbol: string;
  saveEvent: (e: CelebrioEvent) => boolean;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newVendor, setNewVendor] = useState({ name: '', category: 'other' as VendorCategory, contactInfo: '', website: '', estimatedQuotation: 0, status: 'to-research' as VendorStatus, notes: '' });

  let filtered = [...event.vendors];
  if (categoryFilter !== 'all') filtered = filtered.filter((v) => v.category === categoryFilter);
  if (statusFilter !== 'all') filtered = filtered.filter((v) => v.status === statusFilter);

  const addVendor = () => {
    if (!newVendor.name) { showToast('Vendor name is required', 'error'); return; }
    // Validate URL if provided
    if (newVendor.website) {
      try {
        const url = new URL(newVendor.website);
        if (!['http:', 'https:'].includes(url.protocol)) {
          showToast('Website must use http or https', 'error');
          return;
        }
      } catch {
        showToast('Invalid website URL', 'error');
        return;
      }
    }
    const vendor: Vendor = {
      id: uuidv4(),
      name: newVendor.name,
      category: newVendor.category,
      contactInfo: newVendor.contactInfo || undefined,
      website: newVendor.website || undefined,
      estimatedQuotation: newVendor.estimatedQuotation > 0 ? toMinorUnits(newVendor.estimatedQuotation) : undefined,
      status: newVendor.status,
      notes: newVendor.notes || undefined,
    };
    const updated = { ...event, vendors: [...event.vendors, vendor] };
    if (saveEvent(updated)) {
      setShowAddForm(false);
      setNewVendor({ name: '', category: 'other', contactInfo: '', website: '', estimatedQuotation: 0, status: 'to-research', notes: '' });
      showToast('Vendor added', 'success');
    }
  };

  const deleteVendor = (id: string) => {
    const updated = { ...event, vendors: event.vendors.filter((v) => v.id !== id) };
    saveEvent(updated);
    showToast('Vendor removed', 'success');
  };

  const updateVendor = (id: string, changes: Partial<Vendor>) => {
    const updated = {
      ...event,
      vendors: event.vendors.map((v) => v.id === id ? { ...v, ...changes } : v),
    };
    saveEvent(updated);
    setEditingId(null);
    showToast('Vendor updated', 'success');
  };

  const updateVendorStatus = (id: string, status: VendorStatus) => {
    updateVendor(id, { status });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <select className="form-input py-1 px-2 text-sm w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category">
            <option value="all">All Categories</option>
            {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{VENDOR_CATEGORY_LABELS[c]}</option>)}
          </select>
          <select className="form-input py-1 px-2 text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All Statuses</option>
            {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{VENDOR_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card card-body border-primary-200">
          <h4 className="font-medium text-gray-900 mb-4">New Vendor</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="v-name" className="form-label form-label-required">Vendor Name</label>
              <input id="v-name" className="form-input" value={newVendor.name} onChange={(e) => setNewVendor((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Sunshine Caterers" />
            </div>
            <div className="form-group">
              <label htmlFor="v-category" className="form-label">Category</label>
              <select id="v-category" className="form-input" value={newVendor.category} onChange={(e) => setNewVendor((p) => ({ ...p, category: e.target.value as VendorCategory }))}>
                {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{VENDOR_CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="v-contact" className="form-label">Contact Info</label>
              <input id="v-contact" className="form-input" value={newVendor.contactInfo} onChange={(e) => setNewVendor((p) => ({ ...p, contactInfo: e.target.value }))} placeholder="Phone or email" />
            </div>
            <div className="form-group">
              <label htmlFor="v-website" className="form-label">Website</label>
              <input id="v-website" type="url" className="form-input" value={newVendor.website} onChange={(e) => setNewVendor((p) => ({ ...p, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label htmlFor="v-estimate" className="form-label">Estimated Quotation ({currencySymbol})</label>
              <input id="v-estimate" type="number" className="form-input" value={newVendor.estimatedQuotation || ''} onChange={(e) => setNewVendor((p) => ({ ...p, estimatedQuotation: parseFloat(e.target.value) || 0 }))} min={0} />
            </div>
            <div className="form-group">
              <label htmlFor="v-status" className="form-label">Status</label>
              <select id="v-status" className="form-input" value={newVendor.status} onChange={(e) => setNewVendor((p) => ({ ...p, status: e.target.value as VendorStatus }))}>
                {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{VENDOR_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group sm:col-span-2">
              <label htmlFor="v-notes" className="form-label">Notes</label>
              <textarea id="v-notes" className="form-input" rows={2} value={newVendor.notes} onChange={(e) => setNewVendor((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowAddForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={addVendor} className="btn btn-primary btn-sm">Add Vendor</button>
          </div>
        </div>
      )}

      {/* Vendor List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Store className="empty-state-icon" />
          <p className="text-gray-500 mb-2">{event.vendors.length === 0 ? 'No vendors yet' : 'No matching vendors'}</p>
          <p className="text-sm text-gray-400">Add vendors to manage your event suppliers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((vendor) => (
            <div key={vendor.id} className="card card-body">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-gray-900">{vendor.name}</h4>
                    <span className="badge badge-primary text-xs">{VENDOR_CATEGORY_LABELS[vendor.category]}</span>
                  </div>
                  {vendor.contactInfo && <p className="text-xs text-gray-500">{vendor.contactInfo}</p>}
                  {vendor.website && (
                    <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
                      Website <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                  {vendor.notes && <p className="text-xs text-gray-400 mt-1">{vendor.notes}</p>}
                  {vendor.estimatedQuotation && (
                    <p className="text-sm text-gray-600 mt-1">Est: {formatCurrency(vendor.estimatedQuotation, currency as 'INR')}</p>
                  )}
                  {vendor.confirmedQuotation && (
                    <p className="text-sm text-success-500 mt-0.5">Confirmed: {formatCurrency(vendor.confirmedQuotation, currency as 'INR')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    className="form-input py-1 px-2 text-xs w-auto"
                    value={vendor.status}
                    onChange={(e) => updateVendorStatus(vendor.id, e.target.value as VendorStatus)}
                    aria-label={`Status for ${vendor.name}`}
                  >
                    {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{VENDOR_STATUS_LABELS[s]}</option>)}
                  </select>
                  <button onClick={() => setEditingId(vendor.id === editingId ? null : vendor.id)} className="btn btn-ghost btn-sm btn-icon" aria-label="Edit vendor">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteVendor(vendor.id)} className="btn btn-ghost btn-sm btn-icon text-danger-500" aria-label="Delete vendor">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Edit */}
              {editingId === vendor.id && (
                <VendorEditForm
                  vendor={vendor}
                  currencySymbol={currencySymbol}
                  onSave={(changes) => updateVendor(vendor.id, changes)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorEditForm({ vendor, currencySymbol, onSave, onCancel }: { vendor: Vendor; currencySymbol: string; onSave: (changes: Partial<Vendor>) => void; onCancel: () => void }) {
  const [s, setS] = useState({
    name: vendor.name,
    contactInfo: vendor.contactInfo || '',
    website: vendor.website || '',
    estimatedQuotation: vendor.estimatedQuotation ? toMajorUnits(vendor.estimatedQuotation) : 0,
    confirmedQuotation: vendor.confirmedQuotation ? toMajorUnits(vendor.confirmedQuotation) : 0,
    notes: vendor.notes || '',
    paymentNotes: vendor.paymentNotes || '',
  });

  return (
    <div className="mt-4 pt-4 border-t border-surface-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group">
          <label className="form-label text-xs">Name</label>
          <input className="form-input" value={s.name} onChange={(e) => setS((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Contact</label>
          <input className="form-input" value={s.contactInfo} onChange={(e) => setS((p) => ({ ...p, contactInfo: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Website</label>
          <input type="url" className="form-input" value={s.website} onChange={(e) => setS((p) => ({ ...p, website: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Est Quotation ({currencySymbol})</label>
          <input type="number" className="form-input" value={s.estimatedQuotation || ''} onChange={(e) => setS((p) => ({ ...p, estimatedQuotation: parseFloat(e.target.value) || 0 }))} min={0} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Confirmed ({currencySymbol})</label>
          <input type="number" className="form-input" value={s.confirmedQuotation || ''} onChange={(e) => setS((p) => ({ ...p, confirmedQuotation: parseFloat(e.target.value) || 0 }))} min={0} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Payment Notes</label>
          <input className="form-input" value={s.paymentNotes} onChange={(e) => setS((p) => ({ ...p, paymentNotes: e.target.value }))} />
        </div>
        <div className="form-group sm:col-span-2">
          <label className="form-label text-xs">Notes</label>
          <textarea className="form-input" rows={2} value={s.notes} onChange={(e) => setS((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="btn btn-secondary btn-sm">Cancel</button>
        <button onClick={() => onSave({
          name: s.name,
          contactInfo: s.contactInfo || undefined,
          website: s.website || undefined,
          estimatedQuotation: s.estimatedQuotation > 0 ? toMinorUnits(s.estimatedQuotation) : undefined,
          confirmedQuotation: s.confirmedQuotation > 0 ? toMinorUnits(s.confirmedQuotation) : undefined,
          notes: s.notes || undefined,
          paymentNotes: s.paymentNotes || undefined,
        })} className="btn btn-primary btn-sm">Save Changes</button>
      </div>
    </div>
  );
}

// ===== IDEAS TAB =====
function IdeasTab({ event, currency, saveEvent, showToast }: {
  event: CelebrioEvent; currency: string;
  saveEvent: (e: CelebrioEvent) => boolean;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<EventIdea[]>([]);

  const generateIdeas = async () => {
    if (!prompt.trim()) { showToast('Enter a prompt for ideas', 'error'); return; }
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basicInfo: event.basicInfo,
          budgetInfo: event.budgetInfo,
          preferences: event.preferences,
          prompt: prompt.trim(),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) throw new Error('Failed to generate ideas');
      const data = await response.json();

      const ideas: EventIdea[] = (data.ideas || []).map((idea: { title: string; description: string; estimatedCost?: number; category: string }) => ({
        id: uuidv4(),
        title: idea.title,
        description: idea.description,
        estimatedCost: idea.estimatedCost,
        category: idea.category,
        saved: false,
      }));

      setGeneratedIdeas(ideas);
      if (data.source === 'demo') {
        showToast('Demo ideas generated (AI not configured)', 'info');
      } else {
        showToast('Ideas generated!', 'success');
      }
    } catch {
      showToast('Failed to generate ideas. Try again later.', 'error');
    }
    setIsGenerating(false);
  };

  const saveIdea = (idea: EventIdea) => {
    const savedIdea = { ...idea, saved: true };
    const updated = { ...event, ideas: [...event.ideas.filter((i) => i.id !== idea.id), savedIdea] };
    if (saveEvent(updated)) {
      // Update local generated list
      setGeneratedIdeas((prev) => prev.map((i) => i.id === idea.id ? savedIdea : i));
      showToast('Idea saved', 'success');
    }
  };

  const removeIdea = (ideaId: string) => {
    const updated = { ...event, ideas: event.ideas.filter((i) => i.id !== ideaId) };
    saveEvent(updated);
    setGeneratedIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, saved: false } : i));
    showToast('Idea removed', 'success');
  };

  const savedIdeas = event.ideas.filter((i) => i.saved);

  return (
    <div className="space-y-6">
      {/* Idea Generator */}
      <div className="card card-body">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent-600" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Generate Ideas</h2>
            <p className="text-sm text-gray-500">Ask for creative suggestions for your event</p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            className="form-input flex-1"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Low-budget decoration ideas, unique birthday activities..."
            maxLength={500}
            onKeyDown={(e) => { if (e.key === 'Enter') generateIdeas(); }}
            aria-label="Ideas prompt"
          />
          <button onClick={generateIdeas} disabled={isGenerating || !prompt.trim()} className="btn btn-primary">
            {isGenerating ? <span className="spinner" aria-hidden="true"></span> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {['Low-budget decoration ideas', 'Unique activities', 'Sustainable options', 'Indoor alternatives'].map((suggestion) => (
            <button key={suggestion} onClick={() => setPrompt(suggestion)} className="btn btn-ghost btn-sm text-xs">
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Generated Ideas */}
      {generatedIdeas.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Generated Ideas</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {generatedIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} currency={currency} onSave={() => saveIdea(idea)} onRemove={() => removeIdea(idea.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Saved Ideas */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Saved Ideas ({savedIdeas.length})</h3>
        {savedIdeas.length === 0 ? (
          <div className="empty-state py-8">
            <Lightbulb className="empty-state-icon" />
            <p className="text-gray-500">No saved ideas yet</p>
            <p className="text-sm text-gray-400">Generate and save ideas you like</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {savedIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} currency={currency} onRemove={() => removeIdea(idea.id)} />
            ))}
          </div>
        )}
      </div>

      {/* AI Plan Ideas */}
      {event.aiPlan?.ideas && event.aiPlan.ideas.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">
            Plan Suggestions
            {event.aiPlanSource === 'demo' && <span className="text-xs text-info-500 ml-2">(Demo)</span>}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {event.aiPlan.ideas.map((idea, i) => {
              const ideaObj: EventIdea = {
                id: `plan-idea-${i}`,
                title: idea.title,
                description: idea.description,
                estimatedCost: idea.estimatedCost,
                category: idea.category,
                saved: event.ideas.some((si) => si.title === idea.title && si.saved),
              };
              return (
                <IdeaCard
                  key={i}
                  idea={ideaObj}
                  currency={currency}
                  onSave={() => saveIdea({ ...ideaObj, id: uuidv4() })}
                  onRemove={() => {
                    const match = event.ideas.find((si) => si.title === idea.title && si.saved);
                    if (match) removeIdea(match.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaCard({ idea, currency, onSave, onRemove }: { idea: EventIdea; currency: string; onSave?: () => void; onRemove: () => void }) {
  return (
    <div className="card card-body">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-900 text-sm">{idea.title}</h4>
          <span className="badge badge-primary text-xs mt-1">{idea.category}</span>
        </div>
        <button
          onClick={idea.saved ? onRemove : onSave}
          className="btn btn-ghost btn-sm btn-icon flex-shrink-0"
          aria-label={idea.saved ? 'Remove idea' : 'Save idea'}
        >
          {idea.saved ? <Star className="w-4 h-4 text-accent-500 fill-accent-500" /> : <StarOff className="w-4 h-4 text-gray-400" />}
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-2 leading-relaxed">{idea.description}</p>
      {idea.estimatedCost !== undefined && idea.estimatedCost > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Est. cost: {formatCurrency(idea.estimatedCost, currency as 'INR')} <span className="text-gray-300">(planning estimate)</span>
        </p>
      )}
    </div>
  );
}

// ===== SETTINGS TAB =====
function SettingsTab({ event, saveEvent, showToast, onDelete }: {
  event: CelebrioEvent;
  saveEvent: (e: CelebrioEvent) => boolean;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onDelete: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: event.basicInfo.name,
    date: event.basicInfo.date,
    location: event.basicInfo.location,
    guestCount: event.basicInfo.guestCount,
    venueType: event.basicInfo.venueType,
    startTime: event.basicInfo.startTime || '',
    endTime: event.basicInfo.endTime || '',
  });

  const handleSave = () => {
    if (!form.name || !form.date || !form.location || form.guestCount < 1) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    const updated = {
      ...event,
      basicInfo: {
        ...event.basicInfo,
        name: form.name,
        date: form.date,
        location: form.location,
        guestCount: form.guestCount,
        venueType: form.venueType as 'indoor' | 'outdoor' | 'mixed',
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
      },
    };
    if (saveEvent(updated)) {
      setEditing(false);
      showToast('Event updated', 'success');
    }
  };

  const handleExportJson = () => {
    const data = storageService.exportEvent(event.id);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.basicInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Event exported', 'success');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Edit Event Details */}
      <div className="card card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Event Details</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="settings-name" className="form-label form-label-required">Event Name</label>
              <input id="settings-name" className="form-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="settings-date" className="form-label form-label-required">Date</label>
                <input id="settings-date" type="date" className="form-input" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="settings-location" className="form-label form-label-required">Location</label>
                <input id="settings-location" className="form-input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="settings-guests" className="form-label form-label-required">Guest Count</label>
                <input id="settings-guests" type="number" className="form-input" value={form.guestCount} onChange={(e) => setForm((p) => ({ ...p, guestCount: parseInt(e.target.value) || 0 }))} min={1} />
              </div>
              <div className="form-group">
                <label htmlFor="settings-venue" className="form-label">Venue Type</label>
                <select id="settings-venue" className="form-input" value={form.venueType} onChange={(e) => setForm((p) => ({ ...p, venueType: e.target.value as 'indoor' | 'outdoor' | 'mixed' }))}>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={handleSave} className="btn btn-primary btn-sm">Save Changes</button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">Name</dt><dd className="font-medium">{event.basicInfo.name}</dd></div>
            <div><dt className="text-gray-500">Type</dt><dd className="font-medium capitalize">{EVENT_TYPE_LABELS[event.basicInfo.type]}</dd></div>
            <div><dt className="text-gray-500">Date</dt><dd className="font-medium">{event.basicInfo.date}</dd></div>
            <div><dt className="text-gray-500">Location</dt><dd className="font-medium">{event.basicInfo.location}</dd></div>
            <div><dt className="text-gray-500">Guests</dt><dd className="font-medium">{event.basicInfo.guestCount}</dd></div>
            <div><dt className="text-gray-500">Venue</dt><dd className="font-medium capitalize">{event.basicInfo.venueType}</dd></div>
          </dl>
        )}
      </div>

      {/* Data Management */}
      <div className="card card-body">
        <h3 className="font-semibold text-gray-900 mb-4">Data Management</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Export Event</p>
              <p className="text-xs text-gray-500">Download this event as JSON</p>
            </div>
            <button onClick={handleExportJson} className="btn btn-secondary btn-sm">
              <Download className="w-4 h-4" /> Export JSON
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Print Summary</p>
              <p className="text-xs text-gray-500">Print a summary of this event</p>
            </div>
            <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Storage Notice */}
      <div className="p-4 rounded-lg bg-info-100 border border-blue-200 text-sm text-blue-800">
        <p className="font-medium mb-1">About Your Data</p>
        <p>Your event data is stored locally in this browser. It will not sync across devices unless exported and imported manually. When using AI features, event details are sent to the configured AI provider.</p>
      </div>

      {/* Danger Zone */}
      <div className="card card-body border-red-200">
        <h3 className="font-semibold text-danger-500 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 mb-4">Permanently delete this event and all its data.</p>
        <button onClick={() => setShowDeleteConfirm(true)} className="btn btn-danger btn-sm">
          <Trash2 className="w-4 h-4" /> Delete Event
        </button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label="Confirm event deletion">
          <div className="dialog-content p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete &ldquo;{event.basicInfo.name}&rdquo;?</h3>
            <p className="text-sm text-gray-600 mb-6">This action is permanent and cannot be undone. All budget items, tasks, vendors, and ideas will be lost.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={onDelete} className="btn btn-danger">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
