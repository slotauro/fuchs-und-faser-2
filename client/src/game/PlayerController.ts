import type { PlayerInput } from '@ff/shared';

export interface InputHandlers {
  onInput(input: PlayerInput): void;
  onInteract(): void;
  onAbility(): void;
  onPause(): void;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Tastatur: WASD/Pfeile bewegen, E oder Leertaste interagiert, F Fähigkeit, Esc Pause. */
export class PlayerController {
  private readonly held = new Set<string>();
  private enabled = true;

  constructor(private readonly handlers: InputHandlers) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.onBlur();
  }

  private emit(): void {
    let x = 0;
    let z = 0;
    for (const code of this.held) {
      const dir = MOVE_KEYS[code];
      if (!dir) continue;
      x += dir[0];
      z += dir[1];
    }
    const len = Math.hypot(x, z);
    this.handlers.onInput(len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 });
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Escape') {
      this.handlers.onPause();
      return;
    }
    if (!this.enabled) return;
    if (MOVE_KEYS[e.code]) {
      e.preventDefault();
      this.held.add(e.code);
      this.emit();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.handlers.onInteract();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      this.handlers.onAbility();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (this.held.delete(e.code)) this.emit();
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.emit();
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
