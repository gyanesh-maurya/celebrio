/**
 * Centralized browser storage service for Celebrio.
 * Uses localStorage with versioned schema and migration support.
 * All components access storage through this service - never directly.
 */

import type { CelebrioEvent, StorageData } from '@/types/event';
import { STORAGE_VERSION } from '@/types/event';

const STORAGE_KEY = 'celebrio_data';

/**
 * Safely reads and parses storage data. Returns null on any error.
 */
function readRawStorage(): StorageData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as StorageData;
  } catch {
    return null;
  }
}

/**
 * Migrate data from older schema versions.
 */
function migrateData(data: StorageData): StorageData {
  // Ensure events is always an array even if corrupted
  const events = Array.isArray(data.events) ? data.events : [];
  return { ...data, events, version: STORAGE_VERSION };
}

/**
 * Writes storage data safely. Returns true on success.
 */
function writeStorage(data: StorageData): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    // Handle quota exceeded or private browsing
    console.error('Storage write failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Gets all storage data with migration applied.
 */
function getStorageData(): StorageData {
  const raw = readRawStorage();
  if (!raw) return { version: STORAGE_VERSION, events: [] };
  return migrateData(raw);
}

// --- Public API ---

export const storageService = {
  /**
   * Get all events.
   */
  getAllEvents(): CelebrioEvent[] {
    const data = getStorageData();
    const events = Array.isArray(data?.events) ? data.events : [];
    return events.filter(
      (e): e is CelebrioEvent => typeof e === 'object' && e !== null && typeof e.id === 'string'
    );
  },

  /**
   * Get a single event by ID.
   */
  getEvent(id: string): CelebrioEvent | null {
    const events = this.getAllEvents();
    return events.find((e) => e.id === id) ?? null;
  },

  /**
   * Save a new event. Returns false if ID already exists or write fails.
   */
  createEvent(event: CelebrioEvent): boolean {
    const data = getStorageData();
    if (data.events.some((e) => e.id === event.id)) {
      return false; // Duplicate ID
    }
    data.events.push(event);
    return writeStorage(data);
  },

  /**
   * Update an existing event. Returns false if event not found or write fails.
   */
  updateEvent(event: CelebrioEvent): boolean {
    const data = getStorageData();
    const index = data.events.findIndex((e) => e.id === event.id);
    if (index === -1) return false;
    data.events[index] = { ...event, updatedAt: new Date().toISOString() };
    return writeStorage(data);
  },

  /**
   * Delete an event by ID. Returns false if not found or write fails.
   */
  deleteEvent(id: string): boolean {
    const data = getStorageData();
    const filtered = data.events.filter((e) => e.id !== id);
    if (filtered.length === data.events.length) return false; // Not found
    data.events = filtered;
    return writeStorage(data);
  },

  /**
   * Export all events as validated JSON string.
   */
  exportAllEvents(): string {
    const events = this.getAllEvents();
    return JSON.stringify(events, null, 2);
  },

  /**
   * Export a single event as JSON string.
   */
  exportEvent(id: string): string | null {
    const event = this.getEvent(id);
    if (!event) return null;
    // Strip any internal-only fields before export
    return JSON.stringify(event, null, 2);
  },

  /**
   * Import an event. Returns the event if successful, null otherwise.
   * Does not overwrite existing events with the same ID.
   */
  importEvent(eventData: CelebrioEvent): { success: boolean; error?: string } {
    const data = getStorageData();
    if (data.events.some((e) => e.id === eventData.id)) {
      // Generate a new ID to avoid collision
      const newId = crypto.randomUUID();
      const imported = {
        ...eventData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.events.push(imported);
    } else {
      data.events.push(eventData);
    }
    const success = writeStorage(data);
    return success ? { success: true } : { success: false, error: 'Failed to write to storage' };
  },

  /**
   * Check if storage is available.
   */
  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const testKey = '__celebrio_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Clear all application data (for testing).
   */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};
