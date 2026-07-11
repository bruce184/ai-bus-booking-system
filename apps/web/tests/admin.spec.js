import { test, expect } from '@playwright/test';

import {
  closeAdminE2EDatabase,
  demoFixtures,
  resetAdminE2EFixtures
} from './demoDatabase.js';

test.describe('Admin & Staff Portal Business Logic E2E Tests', () => {
  test.beforeEach(async () => {
    await resetAdminE2EFixtures();
  });

  test.afterEach(async () => {
    await resetAdminE2EFixtures();
  });

  test.afterAll(async () => {
    await closeAdminE2EDatabase();
  });

  test('Access Control & Authorization (Sec 7.3)', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#email').fill('customer@example.com');
    await page.locator('#password').fill('customer123');
    await page.locator('button[type="submit"]').click();
    // Assert the actual rejection message so a transient network failure
    // cannot masquerade as a role rejection.
    await expect(page.getByText('Access denied. Admin or Staff role required.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.locator('#email').fill('staff@example.com');
    await page.locator('#password').fill('staff123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/admin\/bookings/);
    await expect(page.locator('h1')).toContainText('Bookings & Check-in');
    await expect(page.getByRole('link', { name: /Bookings/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Dashboard/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.locator('#email').fill('admin@example.com');
    await page.locator('#password').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('Trip Seat Map States & Admin Blocking (Sec 8.2)', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#email').fill('admin@example.com');
    await page.locator('#password').fill('admin123');
    await page.locator('button[type="submit"]').click();

    await page.getByRole('link', { name: /Trips/ }).click();
    await expect(page).toHaveURL(/\/admin\/trips/);
    await page.getByTestId(`block-seats-${demoFixtures.tripId}`).click();

    const modal = page.getByText('Inventory Operations');
    await expect(modal).toBeVisible();

    const seatButton = page.getByRole('button', {
      name: demoFixtures.seatLabel,
      exact: true
    });
    await expect(seatButton).toBeVisible();
    await seatButton.click();

    await page.locator('#reason').fill('VIP delegation reserve');
    await page.getByRole('button', { name: 'Confirm Block' }).click();

    await expect(page.locator('.toast')).toContainText('Successfully blocked');
    await expect(seatButton).toBeDisabled();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('Check-in Boarding State Changes (Sec 6)', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#email').fill('staff@example.com');
    await page.locator('#password').fill('staff123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/admin\/bookings/);
    await expect(page.getByRole('heading', { name: 'Bookings List' })).toHaveCount(0);

    await page.locator('#code').fill(demoFixtures.bookingCode);
    await page.getByRole('button', { name: 'Confirm Boarding' }).click();
    await expect(page.locator('.toast')).toContainText('successfully');

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.locator('#email').fill('admin@example.com');
    await page.locator('#password').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.getByRole('link', { name: /Bookings/ }).click();

    const bookingRow = page.locator('tr').filter({ hasText: demoFixtures.bookingCode });
    await expect(bookingRow.getByText('CHECKED_IN', { exact: true })).toBeVisible();
  });
});
