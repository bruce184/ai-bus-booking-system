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

  test('logged-in customer opens booking detail from "Vé của tôi" without leaking email into the URL', async ({ page }) => {
    const contactEmail = `e2e-${Date.now()}@example.com`;

    // createBooking attaches customer_user_id from the session (see
    // graphql-gateway/src/server/resolvers.js), so the booking below only
    // shows up in myBookings if made while logged in.
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('customer@example.com');
    await page.locator('input[type="password"]').fill('customer123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/my-bookings/);

    await page.goto(`/search?from=${SEARCH.from}&to=${encodeURIComponent(SEARCH.to)}&date=${SEARCH.date}`);
    await page.getByRole('link', { name: 'Chọn ghế' }).first().click();
    const seat = page.locator('button.seat-available').first();
    await expect(seat).toBeVisible({ timeout: 15000 });
    await seat.click();
    await page.locator('button.seat-hold-button').click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 15000 });

    await page.locator('input[type="email"]').first().fill(contactEmail);
    await page.locator('input[placeholder="Nguyễn Văn A"]').first().fill('E2E MyBookings');
    await page.locator('input[placeholder="0900000000"]').first().fill('0900000002');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/payment$/, { timeout: 15000 });
    await page.getByRole('button', { name: 'Thanh toán thành công' }).click();
    await expect(page).toHaveURL(/\/booking\//, { timeout: 15000 });
    const bookingCode = await page.getByText(/BK\d+/).first().innerText();

    // my-bookings/page.js's viewBookingDetail: storeFlowContext then a bare
    // /booking/<code> push (no ?email= query param).
    await page.goto('/my-bookings');
    const bookingCard = page.locator('article').filter({ hasText: bookingCode });
    await expect(bookingCard).toBeVisible({ timeout: 15000 });
    await bookingCard.getByRole('button', { name: 'Xem chi tiết' }).click();

    await expect(page).toHaveURL(new RegExp(`/booking/${bookingCode}$`), { timeout: 15000 });
    expect(page.url()).not.toContain('email');
    expect(page.url()).not.toContain('%40'); // encoded '@'
    await expect(page.getByRole('heading', { name: 'Đặt vé thành công!' })).toBeVisible();
    await expect(page.getByText(bookingCode).first()).toBeVisible();
  });

  test('selecting more than the checkout seat limit is blocked with an error', async ({ page }) => {
    await page.goto(`/search?from=${SEARCH.from}&to=${encodeURIComponent(SEARCH.to)}&date=${SEARCH.date}`);
    await page.getByRole('link', { name: 'Chọn ghế' }).first().click();

    // Selecting doesn't change a seat's seat-available class (only appends
    // seat-selected - see SeatMap.jsx), so this locator's matches stay
    // stable as seats are picked; each .nth(i) is still a distinct seat.
    const seats = page.locator('button.seat-available');
    await expect(seats.first()).toBeVisible({ timeout: 15000 });
    // Needs at least 11 available seats on the demo trip (10 to fill the cap
    // + 1 to prove the next one is rejected); fails clearly here rather than
    // a confusing timeout later if the seeded trip has fewer.
    const eleventhSeat = seats.nth(10);
    await expect(eleventhSeat).toBeVisible({ timeout: 15000 });

    for (let i = 0; i < 10; i += 1) {
      await seats.nth(i).click();
    }
    await expect(seats.nth(9)).toHaveAttribute('aria-pressed', 'true');

    await eleventhSeat.click();

    await expect(page.locator('.seat-map-error')).toContainText('tối đa 10 ghế');
    await expect(eleventhSeat).not.toHaveAttribute('aria-pressed', 'true');
  });

  test('autocomplete ignores a stale suggestion response that arrives after a newer one', async ({ page }) => {
    let autocompleteRequests = 0;

    // Stub the GraphQL endpoint so this test controls exactly which
    // response arrives first, instead of hoping a real race reproduces -
    // the first (stale) keystroke's response is delayed past the second's.
    await page.route('**/api/graphql', async (route, request) => {
      let body = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      const isAutocomplete = typeof body?.query === 'string' && body.query.includes('autocompleteLocations');
      if (!isAutocomplete) {
        await route.continue();
        return;
      }

      autocompleteRequests += 1;
      const isStaleRequest = autocompleteRequests === 1;
      if (isStaleRequest) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            autocompleteLocations: [{
              id: `e2e-loc-${autocompleteRequests}`,
              name: isStaleRequest ? 'E2E-STALE-SUGGESTION' : 'E2E-FRESH-SUGGESTION',
              type: 'PROVINCE'
            }]
          }
        })
      });
    });

    await page.goto('/');
    const fromInput = page.locator('#from-input');
    await fromInput.fill('Ha');
    await page.waitForTimeout(250); // past the 200ms debounce: first (slow) request now in flight
    await fromInput.fill('Da Lat');
    await page.waitForTimeout(1000); // both requests resolved; the stale one lands last but must be ignored

    const listId = await fromInput.getAttribute('list');
    const optionValues = await page.locator(`#${listId} option`).evaluateAll(
      (options) => options.map((option) => option.value)
    );

    expect(optionValues).toContain('E2E-FRESH-SUGGESTION');
    expect(optionValues).not.toContain('E2E-STALE-SUGGESTION');
  });

  test('booking confirmation page renders a real QR ticket once the ticket worker issues it', async ({ page }) => {
    const contactEmail = `e2e-${Date.now()}@example.com`;

    await page.goto(`/search?from=${SEARCH.from}&to=${encodeURIComponent(SEARCH.to)}&date=${SEARCH.date}`);
    await page.getByRole('link', { name: 'Chọn ghế' }).first().click();
    const seat = page.locator('button.seat-available').first();
    await expect(seat).toBeVisible({ timeout: 15000 });
    await seat.click();
    await page.locator('button.seat-hold-button').click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 15000 });

    await page.locator('input[type="email"]').first().fill(contactEmail);
    await page.locator('input[placeholder="Nguyễn Văn A"]').first().fill('E2E Ticket');
    await page.locator('input[placeholder="0900000000"]').first().fill('0900000003');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/payment$/, { timeout: 15000 });
    await page.getByRole('button', { name: 'Thanh toán thành công' }).click();
    await expect(page).toHaveURL(/\/booking\//, { timeout: 15000 });

    // ticket-worker issues tickets asynchronously off the outbox/RabbitMQ
    // consumer after payment; booking/[bookingCode]/page.js shows a "đang
    // phát hành" notice until tickets exist, so poll with reloads instead
    // of asserting once.
    const qrImage = page.locator('img[alt^="QR check-in"]').first();
    await expect(async () => {
      await page.reload();
      await expect(qrImage).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    await expect(page.getByText(/^TK\d+/).first()).toBeVisible();
    await expect(page.getByText('Mã vé (Ticket code)').first()).toBeVisible();
    await expect(page.getByText('E2E Ticket', { exact: false }).first()).toBeVisible();
  });

  test('customer cancels a PAID booking from "Vé của tôi" and sees status flip to CANCELLED', async ({ page }) => {
    const contactEmail = `e2e-${Date.now()}@example.com`;

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('customer@example.com');
    await page.locator('input[type="password"]').fill('customer123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/my-bookings/);

    await page.goto(`/search?from=${SEARCH.from}&to=${encodeURIComponent(SEARCH.to)}&date=${SEARCH.date}`);
    await page.getByRole('link', { name: 'Chọn ghế' }).first().click();
    const seat = page.locator('button.seat-available').first();
    await expect(seat).toBeVisible({ timeout: 15000 });
    await seat.click();
    await page.locator('button.seat-hold-button').click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 15000 });

    await page.locator('input[type="email"]').first().fill(contactEmail);
    await page.locator('input[placeholder="Nguyễn Văn A"]').first().fill('E2E Cancel');
    await page.locator('input[placeholder="0900000000"]').first().fill('0900000004');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/payment$/, { timeout: 15000 });
    await page.getByRole('button', { name: 'Thanh toán thành công' }).click();
    await expect(page).toHaveURL(/\/booking\//, { timeout: 15000 });
    const bookingCode = await page.getByText(/BK\d+/).first().innerText();

    // canCancel() (services/booking-service/src/status.js) only allows PAID
    // bookings, and ticket-worker flips PAID -> TICKET_ISSUED asynchronously
    // within a few seconds - head to my-bookings immediately instead of
    // lingering on the confirmation page so the cancel button is still there.
    await page.goto('/my-bookings');
    const bookingCard = page.locator('article').filter({ hasText: bookingCode });
    await expect(bookingCard).toBeVisible({ timeout: 15000 });
    await expect(bookingCard.getByText('PAID', { exact: true })).toBeVisible({ timeout: 10000 });

    page.once('dialog', (dialog) => dialog.accept());
    await bookingCard.getByRole('button', { name: 'Hủy vé' }).click();

    await expect(page.getByText(`Đã hủy booking ${bookingCode}.`)).toBeVisible({ timeout: 10000 });
    await expect(bookingCard.getByText('CANCELLED', { exact: true })).toBeVisible();
    await expect(bookingCard.getByRole('button', { name: 'Hủy vé' })).toHaveCount(0);
  });

  test('EcoBus AI assistant panel answers via its read-only tools (search, policy, booking lookup)', async ({ page }) => {
    await page.goto('/');
    const answer = page.locator('.chatbot-answer');

    // ChatbotPanel.jsx's default search (TP.HCM / Da Lat / tomorrow) matches
    // this file's own SEARCH constant, so the seeded demo trip is findable.
    await page.getByRole('button', { name: 'Tìm chuyến' }).click();
    await expect(answer).toContainText('searchTrips result', { timeout: 15000 });
    await expect(answer).toContainText('operatorName');

    await page.getByRole('button', { name: 'Hủy vé' }).click();
    await expect(answer).toContainText('bus://policy/cancellation', { timeout: 15000 });

    await page.getByRole('button', { name: 'Check-in' }).click();
    await expect(answer).toContainText('bus://policy/checkin', { timeout: 15000 });

    // Seeded demo booking (database/seed.sql) - read-only lookup, no mutation.
    await page.getByLabel('Mã đặt chỗ').fill('BK202606240001');
    await page.getByLabel('Email đặt chỗ').fill('guest.anna@example.com');
    await page.getByRole('button', { name: 'Tra cứu booking' }).click();
    await expect(answer).toContainText('getBookingStatus result', { timeout: 15000 });
    await expect(answer).toContainText('guest.anna@example.com');
  });
});
