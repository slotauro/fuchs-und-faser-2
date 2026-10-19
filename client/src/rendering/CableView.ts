import * as THREE from 'three';
import { cellCoords, neighbors, type Cell, type GameState } from '@ff/shared';

const RADIUS = 0.055;

/** Höhe des Kabels je nach Untergrund: im Graben tiefer, auf dem Schachtdeckel höher. */
function cableHeight(cell: Cell): number {
  if (cell.kind === 'road') return 0.09;
  if (cell.kind === 'conduit') return 0.05;
  if (cell.kind === 'socket') return 0.04;
  if (cell.kind === 'distributor') return 0.06;
  return -0.02;
}

interface Pulse {
  points: THREE.Vector3[];
  t: number;
  duration: number;
  head: THREE.Mesh;
}

/**
 * Orangefarbene Glasfaser als Röhren zwischen den Mitten verkabelter Nachbarkacheln.
 * Beim Hausanschluss läuft ein Lichtimpuls vom Verteiler zum Haus.
 */
export class CableView {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#ff7a12',
    emissive: '#ff5a00',
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  private readonly segment = new THREE.CylinderGeometry(RADIUS, RADIUS, 1, 10, 1);
  private readonly joint = new THREE.SphereGeometry(RADIUS * 1.25, 12, 8);
  private readonly cables = new THREE.Group();
  private lastVersion = -1;
  private flash = 0;
  private pulses: Pulse[] = [];

  constructor() {
    this.group.add(this.cables);
  }

  update(state: GameState): void {
    if (state.cellsVersion === this.lastVersion) return;
    this.lastVersion = state.cellsVersion;
    this.cables.clear();
    state.cells.forEach((cell, i) => {
      if (!cell.cable) return;
      const from = this.point(state, i);
      const joint = new THREE.Mesh(this.joint, this.material);
      joint.position.copy(from);
      joint.castShadow = true;
      this.cables.add(joint);
      for (const n of neighbors(state, i)) {
        const other = state.cells[n]!;
        if (!other.cable && other.kind !== 'distributor') continue;
        // Jede Verbindung nur einmal zeichnen: halbe Strecke je Seite.
        const to = this.point(state, n);
        const mid = from.clone().lerp(to, other.kind === 'distributor' ? 0.75 : 0.5);
        mid.y = (from.y + to.y) / 2;
        this.cables.add(this.tube(from, mid));
      }
    });
  }

  point(state: GameState, index: number): THREE.Vector3 {
    const { cx, cz } = cellCoords(state, index);
    return new THREE.Vector3(cx, cableHeight(state.cells[index]!), cz);
  }

  private tube(a: THREE.Vector3, b: THREE.Vector3): THREE.Mesh {
    const mesh = new THREE.Mesh(this.segment, this.material);
    const length = a.distanceTo(b);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, length, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    mesh.castShadow = true;
    return mesh;
  }

  /** Lichtimpuls entlang eines Wegs (Kachelindizes vom Verteiler zum Anschluss). */
  pulse(state: GameState, path: number[]): void {
    if (path.length === 0) return;
    const points = path.map((i) => this.point(state, i).add(new THREE.Vector3(0, 0.03, 0)));
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0.95 }),
    );
    // Kein PointLight: Ein zusätzliches Licht würde alle Shader neu kompilieren und ruckeln.
    this.group.add(head);
    this.pulses.push({ points, t: 0, duration: Math.min(2.2, 0.25 + path.length * 0.12), head });
    this.flash = 1;
  }

  tick(dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 0.6);
    this.material.emissiveIntensity = 0.45 + this.flash * 2.2;
    for (const p of this.pulses) {
      p.t += dt;
      const f = Math.min(1, p.t / p.duration) * (p.points.length - 1);
      const i = Math.floor(f);
      const a = p.points[i]!;
      const b = p.points[Math.min(i + 1, p.points.length - 1)]!;
      p.head.position.copy(a).lerp(b, f - i);
    }
    this.pulses = this.pulses.filter((p) => {
      if (p.t < p.duration + 0.3) return true;
      p.head.removeFromParent();
      return false;
    });
  }
}
