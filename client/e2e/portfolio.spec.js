import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function fillContact(page) {
  await page.getByLabel('Your name', { exact: true }).fill('Alex Smith');
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com');
  await page.getByLabel('Subject', { exact: true }).fill('Hello Aakash');
  await page.getByLabel('Your message', { exact: true }).fill('I would like to get in touch about your portfolio.');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('layout fits desktop and 320px screens; links and headings are usable', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thoughtful code');
  await expect(page.getByRole('link', { name: 'aakashgarude@gmail.com', exact: true })).toHaveAttribute('href', 'mailto:aakashgarude@gmail.com');
  const originalViewport = page.viewportSize();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, 'horizontal overflow at width ' + width).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  }
  await page.setViewportSize(originalViewport);
  if (testInfo.project.name !== 'desktop-firefox') {
    await page.screenshot({ path: testInfo.outputPath('home-light.jpg'), type: 'jpeg', quality: 65, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('mobile menu supports keyboard navigation and restores focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'About', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Stack', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await expect(page.getByRole('navigation')).toBeHidden();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.getByRole('navigation')).toBeHidden();
});

test('theme persists and both themes pass automated WCAG accessibility checks', async ({ page }, testInfo) => {
  const light = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(light.violations, JSON.stringify(light.violations)).toEqual([]);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const dark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(dark.violations, JSON.stringify(dark.violations)).toEqual([]);
  if (testInfo.project.name !== 'desktop-firefox') {
    await page.screenshot({ path: testInfo.outputPath('home-dark.jpg'), type: 'jpeg', quality: 65, fullPage: true });
  }
});

test('theme still works when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('project details can be expanded and collapsed', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Project details' });
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'How it fits together' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide details' }).click();
  await expect(page.locator('#project-details')).toHaveCount(0);
});

test('invalid contact input shows field errors, focuses name and sends no request', async ({ page }) => {
  let posts = 0;
  page.on('request', request => { if (request.url().endsWith('/api/contact')) posts++; });
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.field-error')).toHaveCount(4);
  await expect(page.getByLabel('Your name', { exact: true })).toBeFocused();
  expect(posts).toBe(0);
});

test('valid contact request is trimmed, sent once and clears only after success', async ({ page }) => {
  let posts = 0;
  let payload;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/contact', async route => {
    posts++;
    payload = route.request().postDataJSON();
    await gate;
    await route.fulfill({ status: 200, json: { saved: true, emailSent: true } });
  });
  await fillContact(page);
  await page.getByLabel('Your name', { exact: true }).fill('  Alex Smith  ');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  await expect(page.getByLabel('Email address', { exact: true })).toBeDisabled();
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(posts).toBe(1);
  release();
  await expect(page.locator('.form-status.success')).toContainText('Message sent');
  expect(payload.name).toBe('Alex Smith');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('');
});

test('saved-but-unsent messages have honest pending feedback', async ({ page }) => {
  await page.route('**/api/contact', route => route.fulfill({ status: 202, json: { saved: true, emailSent: false } }));
  await fillContact(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.form-status.pending')).toContainText('could not be confirmed');
  await expect(page.locator('.form-status.success')).toHaveCount(0);
});

test('server field errors are shown and visitor text is retained', async ({ page }) => {
  await page.route('**/api/contact', route => route.fulfill({
    status: 400, json: { saved: false, emailSent: false, errors: { subject: ['Please use a different subject.'] } },
  }));
  await fillContact(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#subject-error')).toHaveText('Please use a different subject.');
  await expect(page.getByLabel('Subject', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Alex Smith');
});

test('rate limits, server failures and malformed success responses retain messages', async ({ page }) => {
  for (const reply of [
    { status: 429, json: { saved: false, emailSent: false } },
    { status: 503, json: { saved: false, emailSent: false } },
    { status: 200, json: { saved: 'false', emailSent: 'false' } },
    { status: 200, body: '<html>Not JSON</html>', contentType: 'text/html' },
  ]) {
    await page.route('**/api/contact', route => route.fulfill(reply));
    await fillContact(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('.form-status.error')).toBeVisible();
    await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Alex Smith');
    await expect(page.locator('.form-status.success')).toHaveCount(0);
    await page.unroute('**/api/contact');
  }
});

test('network errors recover the form without discarding visitor text', async ({ page }) => {
  await page.route('**/api/contact', route => route.abort('failed'));
  await fillContact(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.form-status.error')).toContainText('Could not connect');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await expect(page.getByLabel('Your message', { exact: true })).not.toHaveValue('');
});

test('HTML-like input is treated as text and the real unconfigured API fails safely', async ({ page }) => {
  await fillContact(page);
  await page.getByLabel('Your name', { exact: true }).fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.form-status.error')).toContainText('could not be submitted');
  await expect(page.locator('input#name')).toHaveValue('<img src=x onerror=alert(1)>');
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
