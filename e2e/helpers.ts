import { expect, type Page } from '@playwright/test';

export interface PlayerView {
  id: string;
  x: number;
  z: number;
  carrying: number;
  job: string | null;
}

/** Liest den Spielzustand über den Test-Haken `window.__ff` (nur im Dev-Build). */
export async function gameState(page: Page) {
  return page.evaluate(() => {
    const ff = (window as unknown as { __ff: { state(): any; playerId: string } }).__ff;
    const s = ff.state();
    const me = s.players.find((p: any) => p.id === ff.playerId);
    return {
      width: s.width as number,
      status: s.status as string,
      me: { id: me.id, x: me.x, z: me.z, carrying: me.carrying, job: me.job?.kind ?? null } as PlayerView,
      cells: s.cells.map((c: any) => ({ dug: c.dug, cable: c.cable, kind: c.kind })) as { dug: boolean; cable: boolean; kind: string }[],
      online: s.houses.filter((h: any) => h.online).length as number,
      players: s.players.map((p: any) => ({ id: p.id, x: p.x, z: p.z })),
    };
  });
}

export async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __ff?: unknown }).__ff !== undefined, null, { timeout: 60_000 });
  await expect(page.getByTestId('game')).toBeVisible();
}

const KEYS = { right: 'KeyD', left: 'KeyA', up: 'KeyW', down: 'KeyS' } as const;
type Dir = keyof typeof KEYS;

/** Hält eine Richtungstaste, bis die Figur auf der Zielkachel steht. */
export async function walk(page: Page, dir: Dir, target: number): Promise<void> {
  const axis = dir === 'left' || dir === 'right' ? 'x' : 'z';
  await page.keyboard.down(KEYS[dir]);
  try {
    await expect
      .poll(async () => Math.round((await gameState(page)).me[axis]), { timeout: 15_000, intervals: [30] })
      .toBe(target);
  } finally {
    await page.keyboard.up(KEYS[dir]);
  }
}

/** Kurzes Antippen dreht die Figur in eine Richtung. */
export async function face(page: Page, dir: Dir): Promise<void> {
  await page.keyboard.down(KEYS[dir]);
  await page.waitForTimeout(30);
  await page.keyboard.up(KEYS[dir]);
  await page.waitForTimeout(150);
}

/** Interagiert und wartet, bis eine Bedingung im Zustand erfüllt ist. */
export async function interactUntil(page: Page, check: (s: Awaited<ReturnType<typeof gameState>>) => boolean): Promise<void> {
  await page.keyboard.press('KeyE');
  await expect.poll(async () => check(await gameState(page)), { timeout: 15_000, intervals: [50] }).toBe(true);
  // Kurz warten, bis die Figur wieder frei ist.
  await expect.poll(async () => (await gameState(page)).me.job, { timeout: 5_000, intervals: [50] }).toBeNull();
}

export const index = (width: number, x: number, z: number) => z * width + x;
