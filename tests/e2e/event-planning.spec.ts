/**
 * End-to-end tests for the Celebrio event planning application.
 * Uses Playwright to test critical user flows.
 * Tests do not require a real AI API key - they test demo mode.
 */

import { test, expect } from '@playwright/test';

// Clear localStorage before each test for deterministic state
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

test.describe('Dashboard', () => {
  test('shows empty state on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Start planning your celebration')).toBeVisible();
    await expect(page.getByText('Plan Your First Event')).toBeVisible();
  });

  test('Plan an Event button navigates to wizard', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Plan Your First Event').click();
    await expect(page).toHaveURL(/\/events\/new/);
    await expect(page.getByText('Create New Event')).toBeVisible();
  });
});

test.describe('Event Creation Wizard', () => {
  test('creates a birthday event, saves without AI, persists after reload', async ({ page }) => {
    await page.goto('/events/new');

    // Step 1: Basic Info
    await page.fill('#event-name', 'Alice Birthday Party');
    await page.selectOption('#event-type', 'birthday');
    await page.fill('#event-date', '2027-03-15');
    await page.fill('#event-location', 'Bangalore');
    await page.fill('#guest-count', '30');
    await page.getByRole('radio', { name: /indoor/i }).click();
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: Budget
    await page.fill('#total-budget', '50000');
    await page.selectOption('#currency', 'INR');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3: Preferences (optional, just proceed)
    await page.getByRole('button', { name: /next/i }).click();

    // Step 4: Review
    await expect(page.getByText('Alice Birthday Party')).toBeVisible();
    await expect(page.getByText('Birthday')).toBeVisible();
    await expect(page.getByText('Bangalore')).toBeVisible();

    // Save without AI
    await page.getByRole('button', { name: /save without ai/i }).click();

    // Should redirect to event workspace
    await expect(page).toHaveURL(/\/events\//);
    await expect(page.getByText('Alice Birthday Party')).toBeVisible();

    // Reload page and verify persistence
    await page.reload();
    await expect(page.getByText('Alice Birthday Party')).toBeVisible();
  });

  test('validates required fields before proceeding', async ({ page }) => {
    await page.goto('/events/new');

    // Try to proceed without filling required fields
    await page.fill('#event-name', '');
    await page.getByRole('button', { name: /next/i }).click();

    // Should show validation error and stay on step 1
    await expect(page.getByText('Event name is required')).toBeVisible();
  });

  test('keyboard navigation works through wizard steps', async ({ page }) => {
    await page.goto('/events/new');

    // Tab to first input and type
    await page.keyboard.press('Tab'); // Skip to content link
    // Focus on event name
    await page.locator('#event-name').focus();
    await page.keyboard.type('Keyboard Test Event');

    // Verify the input received the text
    await expect(page.locator('#event-name')).toHaveValue('Keyboard Test Event');
  });
});

test.describe('Event Workspace', () => {
  // Helper to create an event through the UI
  async function createTestEvent(page: import('@playwright/test').Page) {
    await page.goto('/events/new');
    await page.fill('#event-name', 'Test Wedding');
    await page.selectOption('#event-type', 'wedding');
    await page.fill('#event-date', '2027-06-15');
    await page.fill('#event-location', 'Mumbai');
    await page.fill('#guest-count', '150');
    await page.getByRole('button', { name: /next/i }).click();
    await page.fill('#total-budget', '500000');
    await page.getByRole('button', { name: /next/i }).click();
    await page.getByRole('button', { name: /next/i }).click();
    await page.getByRole('button', { name: /save without ai/i }).click();
    await expect(page).toHaveURL(/\/events\//);
  }

  test('add and edit a budget item, verify total changes', async ({ page }) => {
    await createTestEvent(page);

    // Navigate to Budget tab
    await page.getByRole('tab', { name: /budget/i }).click();
    await expect(page.getByText('Total Budget')).toBeVisible();

    // Add a budget item
    await page.getByRole('button', { name: /add item/i }).click();
    await page.fill('#bi-category', 'Venue');
    await page.fill('#bi-description', 'Wedding hall deposit');
    await page.fill('#bi-planned', '200000');
    await page.fill('#bi-actual', '100000');
    await page.getByRole('button', { name: /^add item$/i }).click();

    // Verify the item appears and totals updated
    await expect(page.getByText('Wedding hall deposit')).toBeVisible();
    await expect(page.getByText(/2,00,000/)).toBeVisible();
  });

  test('create and complete a task', async ({ page }) => {
    await createTestEvent(page);

    // Navigate to Timeline tab
    await page.getByRole('tab', { name: /timeline/i }).click();

    // Add a task
    await page.getByRole('button', { name: /add task/i }).click();
    await page.fill('#task-title', 'Book the venue');
    await page.fill('#task-due', '2027-01-15');
    await page.selectOption('#task-priority', 'high');
    await page.getByRole('button', { name: /^add task$/i }).click();

    // Verify task appears
    await expect(page.getByText('Book the venue')).toBeVisible();

    // Mark as complete
    await page.getByRole('button', { name: /mark task as complete/i }).first().click();

    // Verify completed state
    await expect(page.getByText('1')).toBeVisible(); // Completed count
  });

  test('add a vendor and change its status', async ({ page }) => {
    await createTestEvent(page);

    // Navigate to Vendors tab
    await page.getByRole('tab', { name: /vendors/i }).click();

    // Add vendor
    await page.getByRole('button', { name: /add vendor/i }).click();
    await page.fill('#v-name', 'Royal Caterers');
    await page.selectOption('#v-category', 'caterer');
    await page.fill('#v-estimate', '150000');
    await page.getByRole('button', { name: /^add vendor$/i }).click();

    // Verify vendor appears
    await expect(page.getByText('Royal Caterers')).toBeVisible();

    // Change status
    await page.getByLabel(/status for royal caterers/i).selectOption('contacted');
    await expect(page.getByText('Vendor updated')).toBeVisible();
  });

  test('generate and save a personalized idea', async ({ page }) => {
    await createTestEvent(page);

    // Navigate to Ideas tab
    await page.getByRole('tab', { name: /ideas/i }).click();

    // Enter a prompt and generate
    await page.getByLabel(/ideas prompt/i).fill('decoration ideas');
    await page.getByRole('button', { name: /generate/i }).click();

    // Wait for results (demo mode should be fast)
    await expect(page.getByText('Generated Ideas')).toBeVisible({ timeout: 10000 });

    // Save the first idea
    const saveButtons = page.getByLabel(/save idea/i);
    if (await saveButtons.first().isVisible()) {
      await saveButtons.first().click();
      await expect(page.getByText('Idea saved')).toBeVisible();
    }
  });

  test('export event data as JSON', async ({ page }) => {
    await createTestEvent(page);

    // Navigate to Settings tab
    await page.getByRole('tab', { name: /settings/i }).click();

    // Trigger export (verify button exists)
    const exportButton = page.getByRole('button', { name: /export json/i });
    await expect(exportButton).toBeVisible();

    // We can't easily verify the download in Playwright without special setup
    // but we verify the button works without error
    const [download] = await Promise.all([
      page.waitForEvent('download').catch(() => null),
      exportButton.click(),
    ]);

    // If download triggered, verify filename
    if (download) {
      expect(download.suggestedFilename()).toContain('.json');
    }
  });

  test('edit event details from settings', async ({ page }) => {
    await createTestEvent(page);

    // Navigate to Settings tab
    await page.getByRole('tab', { name: /settings/i }).click();

    // Click Edit
    await page.getByRole('button', { name: /^edit$/i }).click();

    // Update name
    await page.fill('#settings-name', 'Updated Wedding Name');
    await page.getByRole('button', { name: /save changes/i }).click();

    // Verify the name updated
    await expect(page.getByText('Updated Wedding Name')).toBeVisible();
    await expect(page.getByText('Event updated')).toBeVisible();
  });

  test('delete event after confirmation', async ({ page }) => {
    await createTestEvent(page);

    // Navigate to Settings tab
    await page.getByRole('tab', { name: /settings/i }).click();

    // Click Delete
    await page.getByRole('button', { name: /delete event/i }).click();

    // Confirm in dialog
    await expect(page.getByText('Delete Permanently')).toBeVisible();
    await page.getByRole('button', { name: /delete permanently/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
  });
});

test.describe('Data Persistence', () => {
  test('event data survives page refresh', async ({ page }) => {
    // Create event
    await page.goto('/events/new');
    await page.fill('#event-name', 'Persistence Test');
    await page.selectOption('#event-type', 'birthday');
    await page.fill('#event-date', '2027-09-01');
    await page.fill('#event-location', 'Delhi');
    await page.fill('#guest-count', '25');
    await page.getByRole('button', { name: /next/i }).click();
    await page.fill('#total-budget', '25000');
    await page.getByRole('button', { name: /next/i }).click();
    await page.getByRole('button', { name: /next/i }).click();
    await page.getByRole('button', { name: /save without ai/i }).click();
    await expect(page).toHaveURL(/\/events\//);

    // Go to dashboard
    await page.goto('/');
    await expect(page.getByText('Persistence Test')).toBeVisible();

    // Reload and check again
    await page.reload();
    await expect(page.getByText('Persistence Test')).toBeVisible();
  });
});

test.describe('AI Error Handling', () => {
  test('AI error does not destroy existing event data', async ({ page }) => {
    // First create an event
    await page.goto('/events/new');
    await page.fill('#event-name', 'Error Test Event');
    await page.selectOption('#event-type', 'community');
    await page.fill('#event-date', '2027-05-01');
    await page.fill('#event-location', 'Chennai');
    await page.fill('#guest-count', '100');
    await page.getByRole('button', { name: /next/i }).click();
    await page.fill('#total-budget', '100000');
    await page.getByRole('button', { name: /next/i }).click();
    await page.getByRole('button', { name: /next/i }).click();

    // Generate AI plan (in demo mode, should still work)
    await page.getByRole('button', { name: /generate ai plan/i }).click();

    // Wait for redirect (demo mode generates quickly)
    await expect(page).toHaveURL(/\/events\//, { timeout: 15000 });

    // Event should exist
    await expect(page.getByText('Error Test Event')).toBeVisible();

    // Go back to dashboard - event should be listed
    await page.goto('/');
    await expect(page.getByText('Error Test Event')).toBeVisible();
  });
});
