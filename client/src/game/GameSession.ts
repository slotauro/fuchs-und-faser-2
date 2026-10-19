import * as THREE from 'three';
import {
  ANIMALS,
  findPlayer,
  getMap,
  previewInteraction,
  cellCoords,
  type GameEvent,
  type GameState,
  type JobKind,
} from '@ff/shared';
import type { AssetManager } from '../assets/AssetManager';
import type { GameController } from '../controller/GameController';
import { ActorView } from '../rendering/ActorView';
import { CableView } from '../rendering/CableView';
import { Effects } from '../rendering/Effects';
import { GameRenderer } from '../rendering/GameRenderer';
import { TerrainView } from '../rendering/TerrainView';
import { Hud } from '../ui/hud';
import { PlayerController } from './PlayerController';
import type { Settings } from './settings';
import { Sound } from './Sound';

export interface SessionCallbacks {
  onExit(): void;
  onRestart(): void;
  onNext?(): void;
}

const ACTION_LABELS: Record<JobKind | 'pickup', string> = {
  dig: 'Graben',
  break: 'Fels brechen',
  shaft: 'Kabelschacht setzen',
  lay: 'Kabel verlegen',
  connect: 'Haus anschließen',
  pickup: 'Kabel holen',
};

/** Eine laufende Runde: verbindet Controller, 3D-Darstellung, HUD, Sound und Eingabe. */
export class GameSession {
  private readonly renderer: GameRenderer;
  private readonly terrain: TerrainView;
  private readonly cables = new CableView();
  private readonly actors: ActorView;
  private readonly effects = new Effects();
  private readonly hud: Hud;
  private readonly input: PlayerController;
  private readonly sound = new Sound();
  private frame = 0;
  private last = performance.now();
  private paused = false;
  private finished = false;
  private disposed = false;

  constructor(
    stage: HTMLElement,
    overlay: HTMLElement,
    private readonly assets: AssetManager,
    private readonly controller: GameController,
    private readonly settings: Settings,
    private readonly callbacks: SessionCallbacks,
  ) {
    const state = controller.state();
    this.sound.enabled = settings.sound;
    this.renderer = new GameRenderer(stage, settings.lowGraphics);
    this.renderer.frame(state.width, state.height);
    this.terrain = new TerrainView(assets, structuredClone(state));
    this.actors = new ActorView(assets, controller.playerId);
    this.renderer.scene.add(this.terrain.group, this.cables.group, this.actors.group, this.effects.group);

    const map = getMap(state.mapId);
    this.hud = new Hud(overlay, {
      mapName: map.name,
      order: map.order,
      mode: controller.mode,
      onPause: () => this.togglePause(),
      onResume: () => this.togglePause(false),
      onRestart: () => callbacks.onRestart(),
      onExit: () => callbacks.onExit(),
      onNext: callbacks.onNext,
      onAbility: () => controller.ability(),
    });

    this.input = new PlayerController({
      onInput: (i) => controller.setInput(i),
      onInteract: () => controller.interact(),
      onAbility: () => controller.ability(),
      onPause: () => (this.finished ? this.hud.toggleResult() : this.togglePause()),
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __ff?: unknown }).__ff = { state: () => controller.state(), playerId: controller.playerId };
    }
    this.frame = requestAnimationFrame(this.loop);
  }

  private togglePause(force?: boolean): void {
    if (this.finished) return;
    this.paused = force ?? !this.paused;
    if (this.paused) this.controller.pause();
    else this.controller.resume();
    this.input.setEnabled(!this.paused);
    this.hud.showPause(this.paused);
  }

  private readonly loop = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const events = this.controller.update(dt);
    const state = this.controller.state();
    for (const event of events) this.handle(event, state);

    this.terrain.update(state);
    this.cables.update(state);
    this.actors.sync(state, this.renderer.camera, dt, this.settings.reduceMotion);
    this.effects.showHint(state);
    this.updateTarget(state);
    this.cables.tick(dt);
    this.effects.tick(dt, this.settings.reduceMotion);
    this.hud.update(state, this.controller.playerId);
    this.hud.positionTags(state, this.controller.playerId, (x, z) =>
      this.renderer.toScreen(new THREE.Vector3(x, 1.25, z)),
    );
    this.renderer.render();
    this.frame = requestAnimationFrame(this.loop);
  };

  private updateTarget(state: GameState): void {
    const player = findPlayer(state, this.controller.playerId);
    if (!player || state.status !== 'playing' || player.job) {
      this.effects.showTarget(state, null, false);
      this.hud.setActionHint(null);
      return;
    }
    const preview = previewInteraction(state, player);
    const ok = preview?.plan.ok ?? false;
    this.effects.showTarget(state, preview?.cell ?? null, ok);
    this.hud.setActionHint(preview && preview.plan.ok ? ACTION_LABELS[preview.plan.kind] : null);
  }

  private cellPoint(state: GameState, cell: number): THREE.Vector3 {
    const { cx, cz } = cellCoords(state, cell);
    return new THREE.Vector3(cx, 0, cz);
  }

  private handle(event: GameEvent, state: GameState): void {
    const self = this.controller.playerId;
    const burst = !this.settings.reduceMotion;
    switch (event.type) {
      case 'dug':
        if (burst) this.effects.burst('dirt', this.cellPoint(state, event.cell));
        this.sound.dig();
        if (event.revealedConduit) this.hud.toast('Leerrohr gefunden! Hier kann direkt Kabel liegen.', 'good');
        break;
      case 'rockBroken':
        if (burst) this.effects.burst('rock', this.cellPoint(state, event.cell), 22, 1.2);
        this.sound.rock();
        break;
      case 'shaftBuilt':
        if (burst) this.effects.burst('spark', this.cellPoint(state, event.cell), 10);
        this.sound.shaft();
        break;
      case 'cableLaid':
        if (burst) this.effects.burst('fiber', this.cellPoint(state, event.cell), 6, 0.6);
        this.sound.lay();
        break;
      case 'pickup':
        if (event.playerId === self) {
          this.sound.pickup();
          this.hud.toast(`${event.amount} Kabel aufgenommen`, 'good');
        }
        break;
      case 'houseOnline': {
        const house = state.houses.find((h) => h.id === event.houseId);
        this.terrain.setOnline(event.houseId);
        this.cables.pulse(state, event.path);
        if (house) {
          const center = this.terrain.houseCenter(house);
          if (burst) this.effects.burst('confetti', center.clone().setY(1.2), 40, 1.3);
          const screen = this.renderer.toScreen(center.clone().setY(1.8));
          this.hud.floatText(`+${event.points}`, screen.x, screen.y);
        }
        this.sound.online();
        this.hud.toast('Haus ist online!', 'good');
        break;
      }
      case 'ability': {
        const info = ANIMALS[event.animal];
        if (event.playerId === self) this.hud.toast(`${info.ability}!`, 'good');
        this.sound.ability();
        const pos = this.actors.position(event.playerId);
        if (pos && burst) this.effects.burst('spark', pos.clone(), 16, 0.8);
        if (event.revealed?.length) {
          for (const cell of event.revealed) if (burst) this.effects.burst('fiber', this.cellPoint(state, cell), 6, 0.5);
        }
        break;
      }
      case 'rejected':
        if (event.playerId !== self) break;
        this.hud.toast(event.message, 'bad');
        if (event.cell !== undefined) this.effects.flashReject(state, event.cell);
        this.sound.reject();
        break;
      case 'roundWon':
      case 'roundLost':
        this.finish(state, event.type === 'roundWon');
        break;
      case 'jobStarted':
        break;
    }
  }

  private finish(state: GameState, won: boolean): void {
    this.finished = true;
    this.input.setEnabled(false);
    this.controller.setInput({ x: 0, z: 0 });
    if (won) this.sound.win();
    else this.sound.lose();
    // Erst den Lichtimpuls zeigen, dann die Ergebniskarte.
    window.setTimeout(() => {
      if (!this.disposed && state.result) this.hud.showResult(state.result, state.mode);
    }, won && !this.settings.reduceMotion ? 1800 : 600);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.input.dispose();
    this.controller.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }
}
