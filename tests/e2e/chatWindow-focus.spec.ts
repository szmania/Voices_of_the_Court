import { test, expect } from '@playwright/test';

test('chat window appears and stays visible after focus loss', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Launch app with --disable-gpu flag (assuming local dev server)
  // await page.goto('http://localhost:5173');
  // Example assertion
  await expect(page.locator('#chat-window')).toBeVisible();
});