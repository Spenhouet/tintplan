import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const photo = new URL('./fixtures/page-photo.jpg', import.meta.url).pathname;

test('photo to colored page, export and reimport', async ({ page }, testInfo) => {
  // Choose owned pens in Settings: the Copic Sketch 12 set (with Y13) plus a single pen
  await page.goto('/settings/pens');
  await page.getByRole('link', { name: /Sketch/ }).click();
  await page.getByRole('button', { name: '12 Colors Set', exact: true }).click();
  await page.getByPlaceholder('Code, name or hex').fill('R81');
  await page.getByRole('button', { name: 'R81', exact: true }).click();
  await expect(page.getByText('13 of 358')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('No pages yet')).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose image' }).click();
  await (await chooser).setFiles(photo);

  await expect(page.getByText('Crop the page')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  // The areas step scans the page and keeps the detected areas tinted
  await expect(page.getByText('Check areas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start coloring' })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByText(/\d+ areas/)).toBeVisible();
  await expect(page.locator('canvas[aria-hidden="true"]')).toBeAttached();
  await page.getByRole('radio', { name: 'Original' }).click();
  await expect(page.getByRole('button', { name: 'Start coloring' })).toBeEnabled();
  await page.getByRole('radio', { name: 'Lines' }).click();
  await page.getByRole('button', { name: 'Start coloring' }).click();
  await expect(page).toHaveURL(/edit\?id=/);
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Choose a pen' }).first().click();
  await page.getByPlaceholder('Code, name or hex').fill('Y13');
  await page.getByRole('button', { name: 'Y13' }).first().click();
  await expect(page.getByRole('dialog')).toBeHidden();

  const box = (await canvas.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.15, box.y + box.height * 0.5);
  await expect(page.locator('svg text', { hasText: 'Y13' })).toBeVisible();

  await page.getByRole('button', { name: 'Pens used' }).click();
  await expect(page.getByText('Lemon Yellow')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('svg text', { hasText: 'Y13' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('svg text', { hasText: 'Y13' })).toBeVisible();

  // Replace a pen everywhere from the pens used list, then undo it
  await page.getByRole('button', { name: 'Pens used' }).click();
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByText('Replace Y13 with')).toBeVisible();
  await page.getByPlaceholder('Code, name or hex').fill('R81');
  await page.getByRole('button', { name: 'R81', exact: true }).first().click();
  await expect(page.locator('svg text', { hasText: 'R81' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  // Undo from the toast
  await page.locator('[data-button]', { hasText: 'Undo' }).click();
  await expect(page.locator('svg text', { hasText: 'Y13' })).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const file = testInfo.outputPath('export.png');
  await (await download).saveAs(file);
  const bytes = await readFile(file);
  expect(bytes.includes(Buffer.from('tpLn'))).toBe(true);

  // Reimport opens the page with its fills, without the cleanup step
  await page.goto('/');
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose image' }).click();
  await (await chooser2).setFiles(file);
  await expect(page).toHaveURL(/edit\?id=/);
  await expect(page.locator('svg text', { hasText: 'Y13' })).toBeVisible({ timeout: 15_000 });
});
