import { test, expect } from '@playwright/test';

import { cleanupCustomerE2EBookings, closeAdminE2EDatabase } from './demoDatabase.js';
import { businessDate } from '../lib/date.js';

// database/seed.sql schedules its demo trips relative to current_date (so the
// search demo always has upcoming departures); a hardcoded absolute date here
// only matches the seed on the one calendar day it happened to be written.
// "Tomorrow" matches both the seed's nearest relative trip and the search
// page's own defaultSearchDate(), so this stays correct on any run date.
function tomorrowDate() {
  return businessDate(new Date(), 1);
}

const SEARCH = { from: 'TP.HCM', to: 'Da Lat', date: tomorrowDate() };

test.describe('Customer Booking Flow E2E (Sec 3.1-3.3)', () => {
  test.afterEach(async () => {
    await cleanupCustomerE2EBookings();
  });

  test.afterAll(async () => {
    await closeAdminE2EDatabase();
  });

  test('guest searches, holds a seat, checks out, and pays (simulated)', async ({ page }) => {
    const contactEmail = `e2e-${Date.now()}@example.com`;

    // Module 1: search results for a seeded future trip.
    await page.goto(`/search?from=${SEARCH.from}&to=${encodeURIComponent(SEARCH.to)}&date=${SEARCH.date}`);
    const chooseSeats = page.getByRole('link', { name: 'Chọn ghế' }).first();
    await expect(chooseSeats).toBeVisible({ timeout: 15000 });
    await chooseSeats.click();

    // Module 2: seat map, pick the first available seat and hold it (Redis TTL).
    const seat = page.locator('button.seat-available').first();
    await expect(seat).toBeVisible({ timeout: 15000 });
    await seat.click();
    await expect(seat).toHaveAttribute('aria-pressed', 'true');
    await page.locator('button.seat-hold-button').click();

    // Hold succeeded -> checkout page with countdown. tripId/holdToken travel
    // via the encrypted flow-context cookie (storeFlowContext in
    // _TripDetailClient.jsx), not a URL query param - see
    // apps/web/app/checkout/page.js reading flowContext.tripId.
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 15000 });

    // Module 3: guest checkout with passenger info.
    await page.locator('input[type="email"]').first().fill(contactEmail);
    await page.locator('input[placeholder="Nguyễn Văn A"]').first().fill('E2E Passenger');
    await page.locator('input[placeholder="0900000000"]').first().fill('0900000001');
    await page.locator('button[type="submit"]').click();

    // Simulated payment. bookingCode/email travel via the flow-context
    // cookie too (checkout/page.js's storeFlowContext), not a URL query
    // param - see apps/web/app/payment/page.js reading flowContext.bookingCode.
    await expect(page).toHaveURL(/\/payment$/, { timeout: 15000 });
    await page.getByRole('button', { name: 'Thanh toán thành công' }).click();

    // Confirmation page: success banner + booking code (shown in both the
    // ticket card and the pre-ticket summary variants).
    await expect(page).toHaveURL(/\/booking\//, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Đặt vé thành công!' })).toBeVisible();
    await expect(page.getByText(/BK\d+/).first()).toBeVisible({ timeout: 10000 });
  });

  test('two clients racing for the same seat: only one hold succeeds', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    for (const p of [pageA, pageB]) {
      await p.goto(`/search?from=${SEARCH.from}&to=${encodeURIComponent(SEARCH.to)}&date=${SEARCH.date}`);
      await p.getByRole('link', { name: 'Chọn ghế' }).first().click();
      await expect(p.locator('button.seat-available').first()).toBeVisible({ timeout: 15000 });
    }

    // Both pick the same first available seat label.
    const seatLabel = await pageA.locator('button.seat-available').first().innerText();
    await pageA.getByRole('button', { name: seatLabel, exact: true }).click();
    await pageB.getByRole('button', { name: seatLabel, exact: true }).click();

    await pageA.locator('button.seat-hold-button').click();
    await expect(pageA).toHaveURL(/\/checkout$/, { timeout: 15000 });

    // Realtime subscription: B thấy ghế chuyển HELD ngay khi A giữ thành công,
    // lựa chọn của B bị bỏ và không thể giữ ghế đó nữa.
    const seatOnB = pageB.getByRole('button', { name: seatLabel, exact: true });
    await expect(seatOnB).toBeDisabled({ timeout: 15000 });
    await expect(pageB.locator('button.seat-hold-button')).toBeDisabled();
    await expect(pageB).not.toHaveURL(/\/checkout/);

    await contextA.close();
    await contextB.close();
  });
});
