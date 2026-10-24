/**
 * Unit tests for the storage service.
 * Tests CRUD operations, data migration, error handling, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageService } from '@/lib/storage/storage-service';
import type { CelebrioEvent } from '@/types/event';
import { STORAGE_VERSION } from '@/types/event';

function makeEvent(overrides: Partial<CelebrioEvent> = {}): CelebrioEvent {
  return {
    id: crypto.randomUUID(),
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
      totalBudget: 500_000_00,
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

beforeEach(() => {
  storageService.clearAll();
});

describe('storageService', () => {
  describe('isAvailable', () => {
    it('returns true when localStorage is available', () => {
      expect(storageService.isAvailable()).toBe(true);
    });
  });

  describe('getAllEvents', () => {
    it('returns empty array when no events stored', () => {
      expect(storageService.getAllEvents()).toEqual([]);
    });

    it('returns stored events', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      const events = storageService.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(event.id);
    });
  });

  describe('getEvent', () => {
    it('returns null for non-existent event', () => {
      expect(storageService.getEvent('non-existent')).toBeNull();
    });

    it('returns event by ID', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      const found = storageService.getEvent(event.id);
      expect(found).not.toBeNull();
      expect(found?.basicInfo.name).toBe('Test Event');
    });
  });

  describe('createEvent', () => {
    it('creates an event successfully', () => {
      const event = makeEvent();
      expect(storageService.createEvent(event)).toBe(true);
      expect(storageService.getAllEvents()).toHaveLength(1);
    });

    it('rejects duplicate IDs', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      expect(storageService.createEvent(event)).toBe(false);
      expect(storageService.getAllEvents()).toHaveLength(1);
    });

    it('stores multiple events', () => {
      storageService.createEvent(makeEvent());
      storageService.createEvent(makeEvent());
      expect(storageService.getAllEvents()).toHaveLength(2);
    });
  });

  describe('updateEvent', () => {
    it('updates an existing event', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      
      const updated = { ...event, basicInfo: { ...event.basicInfo, name: 'Updated Name' } };
      expect(storageService.updateEvent(updated)).toBe(true);
      
      const found = storageService.getEvent(event.id);
      expect(found?.basicInfo.name).toBe('Updated Name');
    });

    it('returns false for non-existent event', () => {
      expect(storageService.updateEvent(makeEvent())).toBe(false);
    });

    it('updates the updatedAt timestamp', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      
      const originalUpdatedAt = event.updatedAt;
      storageService.updateEvent({ ...event, basicInfo: { ...event.basicInfo, name: 'New' } });
      
      const found = storageService.getEvent(event.id);
      expect(found?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('deleteEvent', () => {
    it('deletes an existing event', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      expect(storageService.deleteEvent(event.id)).toBe(true);
      expect(storageService.getAllEvents()).toHaveLength(0);
    });

    it('returns false for non-existent event', () => {
      expect(storageService.deleteEvent('non-existent')).toBe(false);
    });

    it('does not affect other events', () => {
      const event1 = makeEvent();
      const event2 = makeEvent();
      storageService.createEvent(event1);
      storageService.createEvent(event2);
      storageService.deleteEvent(event1.id);
      
      expect(storageService.getAllEvents()).toHaveLength(1);
      expect(storageService.getEvent(event2.id)).not.toBeNull();
    });
  });

  describe('exportEvent', () => {
    it('exports event as JSON string', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      const exported = storageService.exportEvent(event.id);
      expect(exported).not.toBeNull();
      
      const parsed = JSON.parse(exported!);
      expect(parsed.id).toBe(event.id);
      expect(parsed.basicInfo.name).toBe('Test Event');
    });

    it('returns null for non-existent event', () => {
      expect(storageService.exportEvent('non-existent')).toBeNull();
    });
  });

  describe('importEvent', () => {
    it('imports an event successfully', () => {
      const event = makeEvent();
      const result = storageService.importEvent(event);
      expect(result.success).toBe(true);
      expect(storageService.getAllEvents()).toHaveLength(1);
    });

    it('generates new ID for duplicate imports', () => {
      const event = makeEvent();
      storageService.createEvent(event);
      const result = storageService.importEvent(event);
      expect(result.success).toBe(true);
      expect(storageService.getAllEvents()).toHaveLength(2);
      
      const events = storageService.getAllEvents();
      expect(events[0].id).not.toBe(events[1].id);
    });
  });

  describe('corrupted data handling', () => {
    it('returns empty array for corrupted JSON', () => {
      localStorage.setItem('celebrio_data', 'not-valid-json');
      expect(storageService.getAllEvents()).toEqual([]);
    });

    it('returns empty array for non-object data', () => {
      localStorage.setItem('celebrio_data', '"string"');
      expect(storageService.getAllEvents()).toEqual([]);
    });

    it('handles missing events array', () => {
      localStorage.setItem('celebrio_data', JSON.stringify({ version: 1 }));
      expect(storageService.getAllEvents()).toEqual([]);
    });

    it('filters out invalid events', () => {
      localStorage.setItem('celebrio_data', JSON.stringify({
        version: 1,
        events: [
          makeEvent(),
          null,
          undefined,
          'not-an-event',
          { notAnId: true },
        ],
      }));
      const events = storageService.getAllEvents();
      expect(events).toHaveLength(1);
    });
  });

  describe('data versioning', () => {
    it('migrates data without version', () => {
      localStorage.setItem('celebrio_data', JSON.stringify({
        events: [makeEvent()],
      }));
      const events = storageService.getAllEvents();
      expect(events).toHaveLength(1);
    });

    it('preserves current version data', () => {
      localStorage.setItem('celebrio_data', JSON.stringify({
        version: STORAGE_VERSION,
        events: [makeEvent()],
      }));
      const events = storageService.getAllEvents();
      expect(events).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    it('removes all data', () => {
      storageService.createEvent(makeEvent());
      storageService.clearAll();
      expect(storageService.getAllEvents()).toEqual([]);
    });
  });
});
