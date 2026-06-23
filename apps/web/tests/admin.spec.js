import { test, expect } from '@playwright/test';

test.describe('Admin & Staff Portal Business Logic E2E Tests', () => {

  test('Access Control & Authorization (Sec 7.3)', async ({ page }) => {
    // 1. Customer Role Rejection
    await page.goto('/admin/login');
    await page.locator('#email').fill('customer@example.com');
    await page.locator('#password').fill('customer123');
    await page.locator('button[type="submit"]').click();
    
    // Check that we are rejected (either still on login or showing error toast)
    // The security context prevents CUSTOMER from accessing the layout
    await expect(page).toHaveURL(/\/admin\/login/);
    
    // 2. Staff Role Login & Navigation
    await page.locator('#email').fill('staff@example.com');
    await page.locator('#password').fill('staff123');
    await page.locator('button[type="submit"]').click();
    
    // Staff should be redirected to the Dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    
    // Staff should be able to view Bookings boarding desk
    await page.click('text=Bookings');
    await expect(page).toHaveURL(/\/admin\/bookings/);
    await expect(page.locator('h1')).toContainText('Bookings & Check-in');
    
    // Log out to prepare for Admin tests
    await page.click('text=Logout');
    await expect(page).toHaveURL(/\/admin\/login/);
    
    // 3. Admin Role Login
    await page.locator('#email').fill('admin@example.com');
    await page.locator('#password').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('Trip Seat Map States & Admin Blocking (Sec 8.2)', async ({ page }) => {
    // Login as Admin
    await page.goto('/admin/login');
    await page.locator('#email').fill('admin@example.com');
    await page.locator('#password').fill('admin123');
    await page.locator('button[type="submit"]').click();
    
    // Navigate to Trips
    await page.click('text=Trips');
    await expect(page).toHaveURL(/\/admin\/trips/);
    
    // Click "Block Seats" on the first scheduled trip (trip-1)
    await page.locator('button:has-text("Block Seats")').first().click();
    
    // Verify blocking modal is visible
    const modal = page.locator('text=Inventory Operations');
    await expect(modal).toBeVisible();
    
    // Select an Available seat (e.g., A04)
    const seatBtn = page.getByRole('button', { name: 'A04', exact: true });
    await expect(seatBtn).toBeVisible();
    
    // Click A04 to toggle selection
    await seatBtn.click();
    
    // Verify it is listed in the selected list
    await expect(page.locator('text=A04').first()).toBeVisible();
    
    // Enter block reason
    await page.locator('#reason').fill('VIP delegation reserve');
    
    // Submit blocking request
    await page.click('button:has-text("Confirm Block")');
    
    // Success toast should appear
    await expect(page.locator('.toast')).toBeVisible();
    
    // The seat status should visually reflect BLOCKED (disabled)
    await expect(seatBtn).toBeDisabled();
    
    // Close modal
    await page.click('button:has-text("Close")');
    await expect(modal).not.toBeVisible();
  });

  test('Check-in Boarding State Changes (Sec 6)', async ({ page }) => {
    // Login as Staff
    await page.goto('/admin/login');
    await page.locator('#email').fill('staff@example.com');
    await page.locator('#password').fill('staff123');
    await page.locator('button[type="submit"]').click();
    
    // Navigate to Bookings
    await page.click('text=Bookings');
    await expect(page).toHaveURL(/\/admin\/bookings/);
    
    // Verify booking BK202606240001 is currently PAID (not checked-in)
    const bookingRow = page.locator('tr:has-text("BK202606240001")');
    await expect(bookingRow.locator('text=PAID')).toBeVisible();
    
    // Input booking code manually at Boarding Desk
    await page.locator('#code').fill('BK202606240001');
    await page.click('button:has-text("Confirm Boarding")');
    
    // Toast notification showing success
    await expect(page.locator('.toast')).toBeVisible();
    
    // The state in the table must change from PAID to CHECKED_IN
    await expect(bookingRow.locator('text=CHECKED_IN')).toBeVisible();
  });

});
