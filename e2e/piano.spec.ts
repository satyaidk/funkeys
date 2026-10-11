/**
 * The keyboard in a real browser: computer keys, touch, multi-touch chords,
 * octave controls, and a layout that fits every screen.
 */

import { expect, Page, test } from '@playwright/test';

const key = (page: Page, note: string) => page.locator(`[data-note-id="${note}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('plays notes from the computer keyboard (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones have no computer keyboard');
  await page.keyboard.down('KeyQ'); // F4
  await expect(key(page, 'F4')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Now playing')).toContainText('F4');
  await page.keyboard.up('KeyQ');
  await expect(key(page, 'F4')).toHaveAttribute('aria-pressed', 'false');
});

test('plays a chord from the computer keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones have no computer keyboard');
  for (const code of ['KeyZ', 'KeyC', 'KeyB']) await page.keyboard.down(code); // C3 E3 G3
  for (const note of ['C3', 'E3', 'G3']) await expect(key(page, note)).toHaveAttribute('aria-pressed', 'true');
  for (const code of ['KeyZ', 'KeyC', 'KeyB']) await page.keyboard.up(code);
  await expect(key(page, 'C3')).toHaveAttribute('aria-pressed', 'false');
});

test('plays and releases a key under a finger or the mouse', async ({ page }) => {
  const c4 = key(page, 'C4');
  const box = (await c4.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
  await page.mouse.down();
  await expect(c4).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(c4).toHaveAttribute('aria-pressed', 'false');
});

test('plays a three-finger chord on a touch screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'multi-touch is a phone feature');
  const notes = ['C4', 'E4', 'G4'];
  const points = [];
  for (const note of notes) {
    const box = (await key(page, note).boundingBox())!;
    points.push({ x: box.x + box.width / 2, y: box.y + box.height * 0.85 });
  }
  // Playwright's touchscreen API taps one finger; the DevTools protocol can put down several
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: points.map((p, id) => ({ ...p, id })),
  });
  for (const note of notes) await expect(key(page, note)).toHaveAttribute('aria-pressed', 'true');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  for (const note of notes) await expect(key(page, note)).toHaveAttribute('aria-pressed', 'false');
});

test('slides from key to key (glissando)', async ({ page }) => {
  const from = (await key(page, 'C4').boundingBox())!;
  const to = (await key(page, 'G4').boundingBox())!;
  const y = from.y + from.height * 0.85; // low on the keys: white keys only
  await page.mouse.move(from.x + from.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, y, { steps: 12 });
  await expect(key(page, 'G4')).toHaveAttribute('aria-pressed', 'true');
  await expect(key(page, 'C4')).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.up();
  await expect(key(page, 'G4')).toHaveAttribute('aria-pressed', 'false');
});

test('shifts the octave from the on-screen buttons', async ({ page }) => {
  const range = page.getByLabel('Keyboard range');
  await expect(range).toContainText('C3–C6');
  await page.getByRole('button', { name: 'Octave up' }).click();
  await expect(range).toContainText('C4–C7');
  await expect(key(page, 'C7')).toBeAttached();
  await page.getByRole('button', { name: 'Octave down' }).click();
  await page.getByRole('button', { name: 'Octave down' }).click();
  await expect(range).toContainText('C2–C5');
});

test('keeps the whole keyboard on screen on a phone, with a minimap to move along it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  const keys = (await page.getByRole('group', { name: 'Piano keyboard' }).boundingBox())!;
  const viewport = page.viewportSize()!;
  // Docked at the bottom of the screen, fully visible without scrolling
  expect(keys.y + keys.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(keys.y).toBeGreaterThan(0);
  // Keys keep a playable size instead of shrinking to fit
  const white = (await key(page, 'C4').boundingBox())!;
  expect(white.width).toBeGreaterThanOrEqual(40);
  const minimap = page.getByRole('slider', { name: 'Keyboard position' });
  await expect(minimap).toBeVisible();
  const before = await minimap.getAttribute('aria-valuetext');
  await page.getByRole('button', { name: 'Show higher keys' }).click();
  await expect(minimap).not.toHaveAttribute('aria-valuetext', before!);
});

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440];

test('never scrolls sideways, on any page, at any width', async ({ page, isMobile }) => {
  test.skip(isMobile, 'runs once, resizing through every width');
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 740 : 900 });
    for (const tab of ['Voice', 'Layer & split', 'Sound', 'Tuning', 'Metronome', 'Notes', 'Audio to Piano']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${tab} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('opens the shortcuts help and closes it with Escape', async ({ page }) => {
  await page.getByRole('button', { name: /Shortcuts|Keyboard shortcuts/ }).click();
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Octave down / up');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
