import { expect, test } from '@playwright/test';
import { face, gameState, index, interactUntil, walk, waitForGame } from './helpers';

test('Asset-Seite lädt alle Blender-Modelle ohne Fehler', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?view=assets');
  await expect(page.getByTestId('asset-report')).toContainText('fox:', { timeout: 60_000 });
  await expect(page.getByTestId('asset-report')).toContainText('Animationen: Dig');
  expect(errors).toEqual([]);
});

test('Hauptmenü startet eine Runde mit gewähltem Tier', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('play').click({ timeout: 60_000 });
  await page.getByTestId('animal-mole').click();
  await page.getByTestId('start').click();
  await waitForGame(page);
  await expect(page.getByTestId('ability')).toContainText('Schnellbuddeln');
});

test('Singleplayer: graben, Kabel holen, verlegen und Haus anschließen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Testkarte: Verteiler (1,2), Anschluss (3,2), Kabeltrommel (3,3), Start (1,3).
  await page.goto('/?map=test&animal=fox');
  await waitForGame(page);
  const { width } = await gameState(page);
  const trench = index(width, 2, 2);
  const socket = index(width, 3, 2);

  await walk(page, 'right', 2);
  await face(page, 'up');
  await expect(page.getByTestId('action-hint')).toContainText('Graben');
  await interactUntil(page, (s) => s.cells[trench]!.dug);

  // Ohne Kabel wird das Verlegen abgelehnt.
  await page.keyboard.press('KeyE');
  await expect(page.getByTestId('toast').last()).toContainText('kein Kabel');

  await face(page, 'right');
  await interactUntil(page, (s) => s.me.carrying === 6);
  await expect(page.getByTestId('carrying')).toHaveText('6 / 6 Kabel');

  await face(page, 'up');
  await interactUntil(page, (s) => s.cells[trench]!.cable);
  await walk(page, 'up', 2);
  await face(page, 'right');
  await interactUntil(page, (s) => s.cells[socket]!.cable);
  await expect(page.getByTestId('carrying')).toHaveText('4 / 6 Kabel');

  await interactUntil(page, (s) => s.online === 1);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('result')).toContainText('Alle Häuser online!');
  expect(Number(await page.getByTestId('final-score').textContent())).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('Pause hält den Timer an', async ({ page }) => {
  await page.goto('/?map=test&animal=fox');
  await waitForGame(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause')).toBeVisible();
  const t1 = await page.evaluate(() => (window as any).__ff.state().time);
  await page.waitForTimeout(800);
  const t2 = await page.evaluate(() => (window as any).__ff.state().time);
  expect(t2).toBe(t1);
});
