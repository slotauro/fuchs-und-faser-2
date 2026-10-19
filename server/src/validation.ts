import { ANIMAL_IDS, MAX_NAME_LENGTH, ROOM_CODE_LENGTH, isMapId, type AnimalId, type PlayerInput } from '@ff/shared';

/** Prüft alle Nutzdaten vom Client, bevor sie den Spielzustand erreichen. */
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // Steuerzeichen entfernen, Leerraum zusammenfassen.
  const name = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

export function parseAnimal(v: unknown): AnimalId | null {
  return typeof v === 'string' && (ANIMAL_IDS as string[]).includes(v) ? (v as AnimalId) : null;
}

export function parseMapId(v: unknown): string | null {
  return typeof v === 'string' && v !== 'test' && isMapId(v) ? v : null;
}

export function parseCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const code = v.trim().toUpperCase();
  return new RegExp(`^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`).test(code) ? code : null;
}

export function parseToken(v: unknown): string | null {
  return typeof v === 'string' && /^[a-f0-9]{32}$/.test(v) ? v : null;
}

export function parseActionId(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= 64 && /^[\w-]+$/.test(v) ? v : null;
}

export function parseInput(v: unknown): PlayerInput | null {
  if (!isRecord(v) || typeof v.x !== 'number' || typeof v.z !== 'number') return null;
  if (!Number.isFinite(v.x) || !Number.isFinite(v.z)) return null;
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  return { x: clamp(v.x), z: clamp(v.z) };
}

/** Blickrichtung: endlicher Vektor, wird auf Länge 1 gebracht. */
export function parseFacing(v: unknown): { x: number; z: number } | null {
  const input = parseInput(v);
  if (!input) return null;
  const len = Math.hypot(input.x, input.z);
  return len > 0.1 ? { x: input.x / len, z: input.z / len } : null;
}
