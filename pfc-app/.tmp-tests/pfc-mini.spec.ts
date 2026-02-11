import { test, expect } from 'playwright/test';

test('home loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle(/PFC|Meta|Reasoning|Next/i);
});
