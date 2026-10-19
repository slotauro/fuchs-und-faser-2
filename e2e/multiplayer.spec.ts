import { expect, test } from '@playwright/test';
import { face, gameState, interactUntil, waitForGame } from './helpers';

test('Zwei Spieler bearbeiten über einen Raumcode dieselbe Baustelle', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('/');
  await host.locator('#player-name').fill('Anna', { timeout: 60_000 });
  await host.getByTestId('create-room').click();
  await host.getByTestId('start').click();
  await expect(host.getByTestId('lobby')).toBeVisible();
  const code = (await host.getByTestId('lobby-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await guest.goto(`/?room=${code}`);
  await expect(guest.getByTestId('room-code')).toHaveValue(code, { timeout: 60_000 });
  await guest.getByTestId('animal-beaver').click();
  await guest.getByTestId('join').click();
  await expect(guest.getByTestId('lobby')).toBeVisible();
  await expect(host.getByTestId('lobby')).toContainText('Biber');

  await host.getByTestId('lobby-start').click();
  await waitForGame(host);
  await waitForGame(guest);

  // Der Gast läuft; der Host sieht die Bewegung.
  const guestId = (await gameState(guest)).me.id;
  const startZ = (await gameState(host)).players.find((p) => p.id === guestId)!.z;
  await guest.keyboard.down('KeyW');
  await guest.waitForTimeout(400);
  await guest.keyboard.up('KeyW');
  await expect
    .poll(async () => (await gameState(host)).players.find((p) => p.id === guestId)!.z, { timeout: 10_000 })
    .toBeLessThan(startZ - 0.3);

  // Der Host gräbt; beide sehen denselben Graben.
  await face(host, 'right');
  await interactUntil(host, (s) => s.cells.some((c) => c.dug));
  const dugHost = (await gameState(host)).cells.findIndex((c) => c.dug);
  await expect.poll(async () => (await gameState(guest)).cells.findIndex((c) => c.dug), { timeout: 10_000 }).toBe(dugHost);

  // Neuladen beim Gast: Wiederbeitritt in die laufende Runde mit demselben Zustand.
  await guest.reload();
  await waitForGame(guest);
  await expect.poll(async () => (await gameState(guest)).cells[dugHost]!.dug, { timeout: 15_000 }).toBe(true);
  expect((await gameState(guest)).me.id).toBe(guestId);
});
