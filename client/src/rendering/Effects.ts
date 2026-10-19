import * as THREE from 'three';
import { cellCoords, type GameState } from '@ff/shared';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: number;
}

const PARTICLE_COLORS = {
  dirt: ['#7a4f2c', '#5e3b20', '#9a6a3e'],
  rock: ['#8f8c88', '#6d6b68', '#b3afa9'],
  spark: ['#ffd23f', '#fff2a8', '#ff9f1c'],
  fiber: ['#ff7a12', '#ffb347', '#fff2a8'],
  confetti: ['#ff7a12', '#ffd23f', '#5dd39e', '#4ea8de', '#ef476f'],
} as const;

export type ParticleKind = keyof typeof PARTICLE_COLORS;

/** Partikel, Zielmarkierung und Fuchs-Spur. Alles ohne Physik, nur kurze Bewegungen. */
export class Effects {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private readonly particleGeometry = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly target: THREE.Mesh;
  private readonly reject: THREE.Mesh;
  private rejectTime = 0;
  private readonly hint = new THREE.Group();
  private hintKey = '';

  constructor() {
    const frame = new THREE.Shape();
    frame.moveTo(-0.5, -0.5).lineTo(0.5, -0.5).lineTo(0.5, 0.5).lineTo(-0.5, 0.5).lineTo(-0.5, -0.5);
    const hole = new THREE.Path();
    hole.moveTo(-0.42, -0.42).lineTo(-0.42, 0.42).lineTo(0.42, 0.42).lineTo(0.42, -0.42).lineTo(-0.42, -0.42);
    frame.holes.push(hole);
    const frameGeometry = new THREE.ShapeGeometry(frame);
    this.target = new THREE.Mesh(
      frameGeometry,
      new THREE.MeshBasicMaterial({ color: '#fff4dc', transparent: true, opacity: 0.75, depthWrite: false }),
    );
    this.target.rotation.x = -Math.PI / 2;
    this.target.renderOrder = 3;
    this.reject = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96),
      new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.reject.rotation.x = -Math.PI / 2;
    this.reject.renderOrder = 3;
    this.group.add(this.target, this.reject, this.hint);
  }

  private material(color: string): THREE.MeshStandardMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      if (color.startsWith('#ff') || color.startsWith('#ffd')) m.emissive.set(color).multiplyScalar(0.3);
      this.materials.set(color, m);
    }
    return m;
  }

  burst(kind: ParticleKind, at: THREE.Vector3, count = 14, power = 1): void {
    const colors = PARTICLE_COLORS[kind];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, this.material(colors[i % colors.length]!));
      mesh.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3));
      const scale = kind === 'confetti' ? 0.8 : 0.6 + Math.random() * 0.8;
      mesh.scale.set(scale, kind === 'confetti' ? 0.25 : scale, scale);
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.6 + Math.random() * 1.2) * power;
      const velocity = new THREE.Vector3(Math.cos(angle) * speed, (2 + Math.random() * 2) * power, Math.sin(angle) * speed);
      const life = 0.6 + Math.random() * 0.5 + (kind === 'confetti' ? 0.8 : 0);
      this.group.add(mesh);
      this.particles.push({ mesh, velocity, life, maxLife: life, spin: (Math.random() - 0.5) * 12 });
    }
  }

  /** Markiert die Kachel, auf die die nächste Interaktion wirkt. */
  showTarget(state: GameState, cell: number | null, ok: boolean): void {
    this.target.visible = cell !== null;
    if (cell === null) return;
    const { cx, cz } = cellCoords(state, cell);
    this.target.position.set(cx, 0.03, cz);
    (this.target.material as THREE.MeshBasicMaterial).color.set(ok ? '#fff4dc' : '#ffffff');
    (this.target.material as THREE.MeshBasicMaterial).opacity = ok ? 0.85 : 0.25;
  }

  flashReject(state: GameState, cell: number): void {
    const { cx, cz } = cellCoords(state, cell);
    this.reject.position.set(cx, 0.035, cz);
    this.rejectTime = 0.6;
  }

  /** Pfotenspur der Fuchs-Spürnase entlang der vorgeschlagenen Trasse. */
  showHint(state: GameState): void {
    const key = state.hint ? state.hint.cells.join(',') : '';
    if (key === this.hintKey) return;
    this.hintKey = key;
    this.hint.clear();
    if (!state.hint) return;
    const geometry = new THREE.CircleGeometry(0.1, 16);
    const material = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false });
    state.hint.cells.forEach((cell, i) => {
      const { cx, cz } = cellCoords(state, cell);
      for (const offset of [-0.12, 0.12]) {
        const dot = new THREE.Mesh(geometry, material);
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(cx + offset * (i % 2 ? 1 : -1), 0.05, cz + offset);
        dot.userData.delay = i * 0.06;
        this.hint.add(dot);
      }
    });
  }

  tick(dt: number, reduceMotion: boolean): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.velocity.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.velocity.multiplyScalar(0.4);
      }
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.z += p.spin * dt;
      const s = Math.max(0.01, p.life / p.maxLife);
      p.mesh.scale.multiplyScalar(s > 0.3 ? 1 : 0.9);
    }
    this.particles = this.particles.filter((p) => {
      if (p.life > 0) return true;
      p.mesh.removeFromParent();
      return false;
    });
    this.rejectTime = Math.max(0, this.rejectTime - dt);
    (this.reject.material as THREE.MeshBasicMaterial).opacity = this.rejectTime * 0.9;
    const t = performance.now() / 1000;
    for (const dot of this.hint.children) {
      const pulse = reduceMotion ? 1 : 0.75 + Math.sin(t * 5 - (dot.userData.delay as number) * 10) * 0.25;
      dot.scale.setScalar(pulse);
    }
  }
}
