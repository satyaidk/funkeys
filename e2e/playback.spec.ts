/**
 * Songs and Audio to Piano in a real browser: audio-clock playback lighting
 * the keys, and a full transcription with Spotify's Basic Pitch model,
 * checked against the notes that were actually played.
 */

import { readFileSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';

const FIXTURE = 'e2e/fixtures/piano-fixture.wav';
const TRUTH = JSON.parse(readFileSync('e2e/fixtures/piano-fixture.json', 'utf8')) as {
  duration: number;
  notes: Array<{ midi: number; startTime: number; endTime: number }>;
};

const litKeys = (page: Page) =>
  page.locator('[data-note-id][aria-pressed=true]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.noteId));

test('plays a song from the Notes library, lighting its keys', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Notes' }).click();
  await page.getByRole('button', { name: 'Play Ode to Joy' }).first().click();
  // The melody opens on E4 over a C3 bass
  await expect.poll(() => litKeys(page)).toEqual(expect.arrayContaining(['E4']));
  await expect(page.getByRole('group', { name: 'Display' })).toContainText('Ode to Joy');
  await page.getByRole('button', { name: 'Pause Ode to Joy' }).first().click();
  await expect.poll(() => litKeys(page)).toEqual([]);
});

test('transcribes a piano recording, plays it on the FunKeys piano and exports MIDI', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the model is slow without a GPU; one run is enough');
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Audio to Piano' }).click();
  await page.getByLabel('Choose a recording').setInputFiles(FIXTURE);
  await expect(page.getByRole('progressbar', { name: 'Transcription progress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'piano-fixture.wav' })).toBeVisible({ timeout: 110_000 });

  // Compare the detected notes with the ones that were played
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save notes' }).click()]);
  const result = JSON.parse(readFileSync((await download.path())!, 'utf8')) as typeof TRUTH;
  expect(result.duration).toBeCloseTo(TRUTH.duration, 1); // the whole recording, silence included
  const used = new Set<number>();
  const matched = TRUTH.notes.filter((t) => {
    const i = result.notes.findIndex((n, j) => !used.has(j) && n.midi === t.midi && Math.abs(n.startTime - t.startTime) < 0.08);
    if (i >= 0) used.add(i);
    return i >= 0;
  });
  testInfo.annotations.push({
    type: 'transcription',
    description: `matched ${matched.length}/${TRUTH.notes.length} played notes; ${result.notes.length} detected`,
  });
  expect(matched.length / TRUTH.notes.length).toBeGreaterThanOrEqual(0.9); // recall
  expect(matched.length / result.notes.length).toBeGreaterThanOrEqual(0.8); // precision

  // Play: the first chord (C3 C4 E4 G4 at 4.5 s) lights its keys
  await page.getByRole('group', { name: 'Transcription playback' }).getByRole('slider', { name: 'Seek' }).fill('4.4');
  await page.getByRole('group', { name: 'Transcription playback' }).getByRole('button', { name: /Play|Resume/ }).click();
  await expect.poll(() => litKeys(page), { timeout: 5000 }).toEqual(expect.arrayContaining(['C3', 'C4', 'E4', 'G4']));
  await page.getByRole('group', { name: 'Transcription playback' }).getByRole('button', { name: 'Stop' }).click();

  const [midi] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export MIDI' }).click()]);
  expect(midi.suggestedFilename()).toBe('piano-fixture.mid');
  expect(readFileSync((await midi.path())!).subarray(0, 4).toString()).toBe('MThd');
});

test('explains a file that is not audio', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Audio to Piano' }).click();
  await page.getByLabel('Choose a recording').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByRole('region', { name: 'Functions' }).getByRole('alert')).toContainText('isn’t an audio file');
});
