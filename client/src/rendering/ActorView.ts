import * as THREE from 'three';
import type { GameState, PlayerState } from '@ff/shared';
import { CHARACTER_MODELS, type AssetManager } from '../assets/AssetManager';

type Clip = 'Idle' | 'Walk' | 'Dig';

/** Farben der Spielerringe; die eigene Figur hat immer den cremefarbenen Ring. */
export const ANIMAL_COLORS = {
  fox: '#ff8a1f',
  mole: '#8a6bd1',
  beaver: '#2f9bd6',
  badger: '#e0476b',
} as const;

class Actor {
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<Clip, THREE.AnimationAction>();
  private current: Clip | null = null;
  private readonly coil: THREE.Object3D;
  private readonly progress: THREE.Mesh;
  private readonly progressBg: THREE.Mesh;
  private readonly aura: THREE.Mesh;
  private yaw = 0;
  private initialized = false;

  constructor(assets: AssetManager, player: PlayerState, isSelf: boolean) {
    const key = CHARACTER_MODELS[player.animal];
    this.model = assets.instance(key);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of assets.animations(key)) {
      if (clip.name === 'Idle' || clip.name === 'Walk' || clip.name === 'Dig') {
        this.actions.set(clip.name, this.mixer.clipAction(clip));
      }
    }

    // Kabelrolle wird vor dem Bauch getragen.
    this.coil = assets.instance('cableCoil');
    this.coil.position.set(0, 0.2, 0.2);
    this.coil.scale.setScalar(0.95);
    this.coil.visible = false;
    this.root.add(this.coil);

    const ringColor = isSelf ? '#fff4dc' : ANIMAL_COLORS[player.animal];
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.38, 40),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.renderOrder = 2;
    this.root.add(ring);
    if (isSelf) {
      const outline = new THREE.Mesh(
        new THREE.RingGeometry(0.38, 0.42, 40),
        new THREE.MeshBasicMaterial({ color: '#ff7a12', transparent: true, opacity: 0.9, depthWrite: false }),
      );
      outline.rotation.x = -Math.PI / 2;
      outline.position.y = 0.013;
      this.root.add(outline);
    }

    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 40),
      new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.014;
    this.root.add(this.aura);

    // Fortschrittsring über dem Kopf, zeigt zur Kamera.
    this.progressBg = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.17, 32),
      new THREE.MeshBasicMaterial({ color: '#2b2118', transparent: true, opacity: 0.55, depthTest: false }),
    );
    this.progress = new THREE.Mesh(
      new THREE.RingGeometry(0.115, 0.165, 32, 1, Math.PI / 2, -Math.PI * 2),
      new THREE.MeshBasicMaterial({ color: '#ffd23f', depthTest: false }),
    );
    for (const m of [this.progressBg, this.progress]) {
      m.position.set(0, 1.12, 0);
      m.renderOrder = 10;
      m.visible = false;
      this.root.add(m);
    }
  }

  private play(clip: Clip, reduceMotion: boolean): void {
    if (this.current === clip) return;
    const next = this.actions.get(clip);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : undefined;
    next.reset().play();
    if (prev && !reduceMotion) next.crossFadeFrom(prev, 0.18, false);
    else prev?.stop();
    this.current = clip;
  }

  sync(player: PlayerState, state: GameState, camera: THREE.Camera, dt: number, reduceMotion: boolean): void {
    const target = new THREE.Vector3(player.x, 0, player.z);
    if (!this.initialized) {
      this.root.position.copy(target);
      this.yaw = Math.atan2(player.facing.x, player.facing.z);
      this.initialized = true;
    }
    // Weiches Nachführen; bei großen Sprüngen (Netzwerkkorrektur) direkt setzen.
    if (this.root.position.distanceTo(target) > 1.5) this.root.position.copy(target);
    else this.root.position.lerp(target, 1 - Math.exp(-dt * 18));

    const targetYaw = Math.atan2(player.facing.x, player.facing.z);
    let delta = targetYaw - this.yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.yaw += delta * (1 - Math.exp(-dt * 14));
    this.model.rotation.y = this.yaw;
    this.coil.position.set(Math.sin(this.yaw) * 0.2, 0.2, Math.cos(this.yaw) * 0.2);
    this.coil.rotation.y = this.yaw;
    this.coil.visible = player.carrying > 0;

    const job = player.job;
    const working = job && (job.kind === 'dig' || job.kind === 'break' || job.kind === 'shaft' || job.kind === 'lay');
    this.play(working ? 'Dig' : player.moving ? 'Walk' : 'Idle', reduceMotion);
    if (working) this.coil.visible = false;

    const showProgress = job !== null && job.duration > 0.3;
    this.progress.visible = showProgress;
    this.progressBg.visible = showProgress;
    if (job && showProgress) {
      const fraction = Math.min(1, job.elapsed / job.duration);
      const geometry = this.progress.geometry;
      const total = geometry.index ? geometry.index.count : 0;
      geometry.setDrawRange(0, Math.floor((fraction * total) / 6) * 6);
      this.progress.quaternion.copy(camera.quaternion);
      this.progressBg.quaternion.copy(camera.quaternion);
    }

    const a = player.ability;
    const empowered = a.armed || state.time < a.activeUntil;
    const material = this.aura.material as THREE.MeshBasicMaterial;
    material.opacity = empowered ? 0.5 + (reduceMotion ? 0 : Math.sin(performance.now() / 150) * 0.3) : 0;

    this.mixer.update(reduceMotion && this.current === 'Idle' ? 0 : dt);
  }
}

/** Alle Tierfiguren; legt Figuren bei Bedarf an und entfernt verschwundene. */
export class ActorView {
  readonly group = new THREE.Group();
  private readonly actors = new Map<string, Actor>();

  constructor(
    private readonly assets: AssetManager,
    private readonly selfId: string,
  ) {}

  sync(state: GameState, camera: THREE.Camera, dt: number, reduceMotion: boolean): void {
    const seen = new Set<string>();
    for (const player of state.players) {
      seen.add(player.id);
      let actor = this.actors.get(player.id);
      if (!actor) {
        actor = new Actor(this.assets, player, player.id === this.selfId);
        this.actors.set(player.id, actor);
        this.group.add(actor.root);
      }
      actor.sync(player, state, camera, dt, reduceMotion);
    }
    for (const [id, actor] of this.actors) {
      if (seen.has(id)) continue;
      actor.root.removeFromParent();
      this.actors.delete(id);
    }
  }

  position(playerId: string): THREE.Vector3 | null {
    return this.actors.get(playerId)?.root.position ?? null;
  }
}
