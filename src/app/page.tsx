'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CelebrioEvent } from '@/types/event';
import { storageService } from '@/lib/storage/storage-service';
import { calculateEventProgress, calculateDaysRemaining, formatCurrencyCompact, getUpcomingTasks, getOverdueTasks } from '@/lib/calculations/budget';
import { EVENT_TYPE_LABELS } from '@/types/event';
import { Calendar, Plus, PartyPopper, Sparkles, Clock, Trash2, Copy, Download, Upload, AlertTriangle, CheckCircle2, TrendingUp, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { importEventSchema } from '@/lib/schemas/validation';

export default function DashboardPage() {
  const [events, setEvents] = useState<CelebrioEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [importing, setImporting] = useState(false);

  const loadEvents = useCallback(() => {
    const stored = storageService.getAllEvents();
    setEvents(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDelete = (id: string) => {
    const success = storageService.deleteEvent(id);
    if (success) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setToast({ message: 'Event deleted successfully', type: 'success' });
    } else {
      setToast({ message: 'Failed to delete event', type: 'error' });
    }
    setDeleteConfirm(null);
  };

  const handleDuplicate = (event: CelebrioEvent) => {
    const newEvent: CelebrioEvent = {
      ...JSON.parse(JSON.stringify(event)),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      basicInfo: { ...event.basicInfo, name: `${event.basicInfo.name} (Copy)` },
    };
    const success = storageService.createEvent(newEvent);
    if (success) {
      setEvents((prev) => [...prev, newEvent]);
      setToast({ message: 'Event duplicated', type: 'success' });
    }
  };

  const handleExportAll = () => {
    const data = storageService.exportAllEvents();
    downloadFile(data, 'celebrio-events.json', 'application/json');
    setToast({ message: 'Events exported', type: 'success' });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      setToast({ message: 'File too large (max 5MB)', type: 'error' });
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      let imported = 0;
      for (const item of items) {
        const validation = importEventSchema.safeParse(item);
        if (validation.success) {
          const result = storageService.importEvent(validation.data);
          if (result.success) imported++;
        }
      }

      if (imported > 0) {
        loadEvents();
        setToast({ message: `${imported} event(s) imported`, type: 'success' });
      } else {
        setToast({ message: 'No valid events found in file', type: 'error' });
      }
    } catch {
      setToast({ message: 'Invalid file format', type: 'error' });
    }
    setImporting(false);
    e.target.value = '';
  };

  // Statistics
  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter((e) => e.basicInfo.date >= today);
  const planningEvents = events.filter((e) => !e.wizardCompleted || calculateEventProgress(e) < 80);

  const allUpcomingTasks = events.flatMap((e) => {
    const tasks = getUpcomingTasks(e, 3);
    return tasks.map((t) => ({ ...t, eventName: e.basicInfo.name, eventId: e.id }));
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);

  const allOverdueTasks = events.flatMap((e) => {
    const tasks = getOverdueTasks(e);
    return tasks.map((t) => ({ ...t, eventName: e.basicInfo.name, eventId: e.id }));
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ width: '2.5rem', height: '2.5rem' }}></div>
          <p className="text-sm text-gray-500">Loading your celebrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-surface-300 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
                <PartyPopper className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-display font-bold text-primary-900">Celebrio</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Your celebration, thoughtfully planned</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="btn btn-ghost btn-sm cursor-pointer" aria-label="Import events from JSON file">
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="sr-only"
                  disabled={importing}
                />
              </label>
              {events.length > 0 && (
                <button onClick={handleExportAll} className="btn btn-ghost btn-sm" aria-label="Export all events">
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}
              <Link href="/events/new" className="btn btn-primary btn-sm">
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Plan an Event</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {events.length === 0 ? (
          /* Empty State */
          <div className="empty-state py-20">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-primary-500" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">Start planning your celebration</h2>
            <p className="text-gray-500 mb-8 max-w-md">
              Create your first event and let Celebrio help you organize everything —
              from budget and timeline to vendors and creative ideas.
            </p>
            <Link href="/events/new" className="btn btn-primary btn-lg">
              <Plus className="w-5 h-5" aria-hidden="true" />
              Plan Your First Event
            </Link>
            <p className="text-xs text-gray-400 mt-4">Weddings · Birthdays · Community Events · and more</p>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<Calendar className="w-5 h-5" />} label="Total Events" value={events.length} color="primary" />
              <StatCard icon={<Clock className="w-5 h-5" />} label="Upcoming" value={upcomingEvents.length} color="accent" />
              <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Planning" value={planningEvents.length} color="info" />
              <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Overdue Tasks" value={allOverdueTasks.length} color={allOverdueTasks.length > 0 ? 'danger' : 'success'} />
            </div>

            {/* Overdue Warning */}
            {allOverdueTasks.length > 0 && (
              <div className="mb-6 p-4 rounded-lg bg-danger-100 border border-red-200 flex items-start gap-3" role="alert">
                <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-danger-500">You have {allOverdueTasks.length} overdue task{allOverdueTasks.length > 1 ? 's' : ''}</p>
                  <p className="text-sm text-red-600 mt-1">
                    {allOverdueTasks.slice(0, 3).map((t) => `"${t.title}" for ${t.eventName}`).join(', ')}
                    {allOverdueTasks.length > 3 ? ` and ${allOverdueTasks.length - 3} more` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Upcoming Tasks */}
            {allUpcomingTasks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-display font-semibold text-gray-900 mb-3">Upcoming Tasks</h2>
                <div className="card">
                  <ul className="divide-y divide-surface-200">
                    {allUpcomingTasks.map((task) => (
                      <li key={task.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            task.priority === 'critical' ? 'bg-danger-500' :
                            task.priority === 'high' ? 'bg-accent-500' :
                            task.priority === 'medium' ? 'bg-warning-500' : 'bg-gray-400'
                          }`} aria-label={`Priority: ${task.priority}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                            <p className="text-xs text-gray-500">{task.eventName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">{formatDate(task.dueDate)}</span>
                          <Link href={`/events/${task.eventId}`} className="btn btn-ghost btn-sm btn-icon" aria-label={`Go to ${task.eventName}`}>
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Events List */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold text-gray-900">Your Events</h2>
              <Link href="/events/new" className="btn btn-secondary btn-sm">
                <Plus className="w-4 h-4" aria-hidden="true" />
                New Event
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={() => setDeleteConfirm(event.id)}
                    onDuplicate={() => handleDuplicate(event)}
                  />
                ))}
            </div>
          </>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label="Confirm deletion">
          <div className="dialog-content p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Event?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete this event and all its data. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = {
    primary: 'bg-primary-50',
    accent: 'bg-accent-50',
    info: 'bg-info-100',
    success: 'bg-success-100',
    danger: 'bg-danger-100',
  };
  const textMap: Record<string, string> = {
    primary: 'text-primary-600',
    accent: 'text-accent-600',
    info: 'text-info-500',
    success: 'text-success-500',
    danger: 'text-danger-500',
  };

  return (
    <div className="card card-body">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bgMap[color] || bgMap.primary} ${textMap[color] || textMap.primary} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, onDelete, onDuplicate }: { event: CelebrioEvent; onDelete: () => void; onDuplicate: () => void }) {
  const progress = calculateEventProgress(event);
  const daysRemaining = calculateDaysRemaining(event.basicInfo.date);
  const isPast = daysRemaining < 0;
  const typeLabel = EVENT_TYPE_LABELS[event.basicInfo.type] || event.basicInfo.type;

  return (
    <article className="card group">
      <div className="card-body">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{event.basicInfo.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{typeLabel}</p>
          </div>
          <span className={`badge ${isPast ? 'badge-warning' : 'badge-primary'} ml-2 flex-shrink-0`}>
            {isPast ? 'Past' : `${daysRemaining}d left`}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
            <span>{formatDate(event.basicInfo.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
            <span>{event.basicInfo.guestCount} guests</span>
          </div>
          {event.budgetInfo.totalBudget > 0 && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              <span>Budget: {formatCurrencyCompact(event.budgetInfo.totalBudget, event.budgetInfo.currency)}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Planning progress</span>
            <span className="text-xs font-medium text-gray-700">{progress}%</span>
          </div>
          <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Planning progress: ${progress}%`}>
            <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }}></div>
          </div>
        </div>

        {event.aiPlan && (
          <div className="mb-3">
            <span className={`badge ${event.aiPlanSource === 'ai' ? 'badge-primary' : 'badge-info'} text-xs`}>
              {event.aiPlanSource === 'ai' ? 'AI-generated plan' : 'Demo plan'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-surface-200">
          <Link href={`/events/${event.id}`} className="btn btn-primary btn-sm flex-1 mr-2">
            Open
          </Link>
          <div className="flex gap-1">
            <button onClick={onDuplicate} className="btn btn-ghost btn-sm btn-icon" aria-label="Duplicate event" title="Duplicate">
              <Copy className="w-4 h-4" aria-hidden="true" />
            </button>
            <button onClick={onDelete} className="btn btn-ghost btn-sm btn-icon text-danger-500" aria-label="Delete event" title="Delete">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
