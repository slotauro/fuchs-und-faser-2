import * as THREE from 'three';
import { cellCoords, type Cell, type GameState, type House } from '@ff/shared';
import type { AssetManager } from '../assets/AssetManager';

type TileKey =
  | 'tile_grass'
  | 'tile_grass_alt'
  | 'tile_roots'
  | 'tile_gravel'
  | 'tile_road'
  | 'tile_road_plain'
  | 'tile_water'
  | 'tile_trench'
  | 'tile_conduit'
  | 'tile_paving';

const TILE_KEYS: TileKey[] = [
  'tile_grass',
  'tile_grass_alt',
  'tile_roots',
  'tile_gravel',
  'tile_road',
  'tile_road_plain',
  'tile_water',
  'tile_trench',
  'tile_conduit',
  'tile_paving',
];

/** Breite des dekorativen Rands um die Karte, in Kacheln. */
const BORDER = 3;

/** Deterministischer Zufall je Kachel, damit eine Karte immer gleich aussieht. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Zeichnet Bodenkacheln (instanziert) und die festen Objekte der Karte.
 * `update` gleicht nur ab, was sich seit dem letzten Aufruf geändert hat.
 */
export class TerrainView {
  readonly group = new THREE.Group();
  private readonly tiles = new Map<TileKey, THREE.InstancedMesh[]>();
  private readonly rocks = new Map<number, THREE.Object3D>();
  private readonly manholes = new Map<number, THREE.Object3D>();
  private readonly windowMaterials = new Map<string, THREE.MeshStandardMaterial[]>();
  private readonly socketLeds = new Map<string, THREE.MeshStandardMaterial[]>();
  private readonly onlineHouses = new Set<string>();
  /** Hohe Objekte, die Figuren verdecken können, mit eigenen (ausblendbaren) Materialien. */
  private readonly occluders: { object: THREE.Object3D; materials: THREE.Material[]; opacity: number; depth: number; halfWidth: number }[] = [];
  private lastVersion = -1;
  private readonly matrix = new THREE.Matrix4();

  constructor(
    private readonly assets: AssetManager,
    private readonly state: GameState,
  ) {
    const capacity = (state.width + 2 * BORDER) * (state.height + 2 * BORDER);
    for (const key of TILE_KEYS) {
      const meshes = assets.tileParts(key).map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
        mesh.receiveShadow = true;
        mesh.castShadow = key === 'tile_roots' || key === 'tile_trench';
        mesh.count = 0;
        this.group.add(mesh);
        return mesh;
      });
      this.tiles.set(key, meshes);
    }
    this.placeStatics();
  }

  private tileFor(cell: Cell, index: number): { key: TileKey; rotation: number } {
    const { cx, cz } = cellCoords(this.state, index);
    const checker: TileKey = (cx + cz) % 2 === 0 ? 'tile_grass' : 'tile_grass_alt';
    switch (cell.kind) {
      case 'grass':
      case 'roots':
      case 'gravel':
        if (cell.dug) return { key: 'tile_trench', rotation: 0 };
        return { key: cell.kind === 'grass' ? checker : cell.kind === 'roots' ? 'tile_roots' : 'tile_gravel', rotation: 0 };
      case 'road': {
        const horizontal = this.isRoad(cx - 1, cz) || this.isRoad(cx + 1, cz);
        const vertical = this.isRoad(cx, cz - 1) || this.isRoad(cx, cz + 1);
        if (horizontal && vertical) return { key: 'tile_road_plain', rotation: 0 };
        return { key: 'tile_road', rotation: vertical ? Math.PI / 2 : 0 };
      }
      case 'water':
        return { key: 'tile_water', rotation: 0 };
      case 'conduit':
        return { key: cell.hidden ? checker : 'tile_conduit', rotation: 0 };
      case 'socket':
      case 'distributor':
      case 'station':
        return { key: 'tile_paving', rotation: 0 };
      default:
        return { key: checker, rotation: 0 };
    }
  }

  private isRoad(cx: number, cz: number): boolean {
    if (cx < 0 || cz < 0 || cx >= this.state.width || cz >= this.state.height) return false;
    return this.state.cells[cz * this.state.width + cx]!.kind === 'road';
  }

  /** Häuser, Verteiler, Kabeltrommel, Bäume und Randdekoration. */
  private placeStatics(): void {
    const { state, assets } = this;
    for (const house of state.houses) this.placeHouse(house);
    state.cells.forEach((cell, i) => {
      const { cx, cz } = cellCoords(state, i);
      let obj: THREE.Object3D | null = null;
      if (cell.kind === 'distributor') obj = assets.instance('distributor');
      else if (cell.kind === 'station') obj = assets.instance('cableSpool');
      else if (cell.kind === 'tree') {
        obj = assets.instance('tree');
        obj.rotation.y = hash(i) * Math.PI * 2;
        obj.scale.setScalar(0.85 + hash(i + 7) * 0.35);
      }
      if (obj) {
        obj.position.set(cx, 0, cz);
        this.group.add(obj);
        if (cell.kind === 'tree') this.addOccluder(obj, 2.4, 0.8);
      }
    });
    // Rand: Bäume in lockerer, deterministischer Verteilung.
    for (let cz = -BORDER; cz < state.height + BORDER; cz++) {
      for (let cx = -BORDER; cx < state.width + BORDER; cx++) {
        if (cx >= 0 && cz >= 0 && cx < state.width && cz < state.height) continue;
        const seed = (cz + 50) * 997 + cx + 50;
        // Unten (zur Kamera) weniger Bäume, damit nichts das Spielfeld verdeckt.
        const density = cz >= state.height ? 0.12 : 0.45;
        if (hash(seed) > density || this.borderKind(cx, cz) !== null || this.nearHouse(cx, cz)) continue;
        const tree = assets.instance('tree');
        tree.position.set(cx + (hash(seed + 1) - 0.5) * 0.4, 0, cz + (hash(seed + 2) - 0.5) * 0.4);
        tree.rotation.y = hash(seed + 3) * Math.PI * 2;
        tree.scale.setScalar(0.8 + hash(seed + 4) * 0.5);
        this.group.add(tree);
        this.addOccluder(tree, 2.4, 0.8);
      }
    }
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: '#6fa64a', roughness: 1 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(state.width / 2, -0.26, state.height / 2);
    plane.receiveShadow = true;
    this.group.add(plane);
  }

  private placeHouse(house: House): void {
    const { state, assets } = this;
    const coords = house.cells.map((i) => cellCoords(state, i));
    const cx = coords.reduce((s, c) => s + c.cx, 0) / coords.length;
    const cz = coords.reduce((s, c) => s + c.cz, 0) / coords.length;
    const socket = cellCoords(state, house.socket);
    // Die Hausfront (Modell-+Z) zeigt zum Anschlusspunkt.
    const dx = socket.cx - cx;
    const dz = socket.cz - cz;
    const facing = Math.abs(dx) > Math.abs(dz) ? Math.atan2(Math.sign(dx), 0) : Math.atan2(0, Math.sign(dz));

    const model = assets.instance('house');
    model.position.set(cx, 0, cz);
    model.rotation.y = facing;
    this.group.add(model);
    // Erst ausblendbare Kopien anlegen, dann die Fenster je Haus eigenständig machen.
    this.addOccluder(model, 3.2, 1.2);
    const windows = this.cloneMaterials(model, 'ff_window');
    this.windowMaterials.set(house.id, windows);
    this.occluders.at(-1)!.materials.push(...windows);

    const box = assets.instance('socket');
    const ax = Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0;
    const az = Math.abs(dx) > Math.abs(dz) ? 0 : Math.sign(dz);
    // Der Kasten steht an der hausnahen Kante der Anschlusskachel und lässt Platz für das Kabel.
    box.position.set(socket.cx - ax * 0.3 + az * 0.28, 0, socket.cz - az * 0.3 + ax * 0.28);
    box.rotation.y = facing;
    this.group.add(box);
    this.socketLeds.set(house.id, this.cloneMaterials(box, 'ff_socket_led'));
  }

  /**
   * Merkt sich ein hohes Objekt, das Figuren dahinter verdecken kann. `depth` ist, wie weit
   * hinter dem Objekt (in -Z) eine Figur noch verdeckt wird, `halfWidth` die halbe Breite.
   */
  private addOccluder(object: THREE.Object3D, depth: number, halfWidth: number): void {
    const materials: THREE.Material[] = [];
    object.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m: THREE.Material) => {
        const copy = m.clone();
        copy.transparent = true;
        materials.push(copy);
        return copy;
      });
      o.material = Array.isArray(o.material) ? mats : mats[0]!;
    });
    this.occluders.push({ object, materials, opacity: 1, depth, halfWidth });
  }

  /** Blendet Bäume und Häuser halbtransparent aus, solange sie eine Figur verdecken. */
  fadeOccluders(players: { x: number; z: number }[], dt: number): void {
    for (const occ of this.occluders) {
      const { x, z } = occ.object.position;
      const hides = players.some((p) => Math.abs(p.x - x) < occ.halfWidth + 0.3 && z - p.z > -0.2 && z - p.z < occ.depth);
      const target = hides ? 0.3 : 1;
      if (Math.abs(occ.opacity - target) < 0.01) continue;
      occ.opacity += (target - occ.opacity) * Math.min(1, dt * 8);
      for (const m of occ.materials) {
        m.opacity = occ.opacity;
        // Undurchsichtig zeichnen, sobald voll sichtbar (spart Sortierprobleme).
        m.depthWrite = occ.opacity > 0.95;
      }
    }
  }

  /** Gibt einem Modell eigene Kopien der Materialien mit diesem Namen. */
  private cloneMaterials(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial[] {
    const result: THREE.MeshStandardMaterial[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const replaced = mats.map((m: THREE.Material) => {
        if (m.name !== name) return m;
        const copy = (m as THREE.MeshStandardMaterial).clone();
        result.push(copy);
        return copy;
      });
      o.material = Array.isArray(o.material) ? replaced : replaced[0]!;
    });
    return result;
  }

  update(state: GameState): void {
    for (const house of state.houses) {
      if (house.online && !this.onlineHouses.has(house.id)) this.setOnline(house.id);
    }
    if (state.cellsVersion === this.lastVersion) return;
    this.lastVersion = state.cellsVersion;
    // Der Zustand kann ein neues Objekt sein (Netzwerk); Kacheln immer aus dem übergebenen lesen.
    Object.assign(this.state, { cells: state.cells });

    const counts = new Map<TileKey, number>(TILE_KEYS.map((k) => [k, 0]));
    const put = (key: TileKey, x: number, z: number, rotation: number) => {
      const index = counts.get(key)!;
      this.matrix.makeRotationY(rotation).setPosition(x, 0, z);
      for (const mesh of this.tiles.get(key)!) mesh.setMatrixAt(index, this.matrix);
      counts.set(key, index + 1);
    };

    state.cells.forEach((cell, i) => {
      const { cx, cz } = cellCoords(state, i);
      const { key, rotation } = this.tileFor(cell, i);
      put(key, cx, cz, rotation);
      this.syncRock(cell, i, cx, cz);
      this.syncManhole(cell, i, cx, cz, rotation);
    });
    for (let cz = -BORDER; cz < state.height + BORDER; cz++) {
      for (let cx = -BORDER; cx < state.width + BORDER; cx++) {
        if (cx >= 0 && cz >= 0 && cx < state.width && cz < state.height) continue;
        const kind = this.borderKind(cx, cz);
        if (kind === 'water') put('tile_water', cx, cz, 0);
        else if (kind === 'road') put('tile_road', cx, cz, cx < 0 || cx >= state.width ? 0 : Math.PI / 2);
        else put((cx + cz) % 2 === 0 ? 'tile_grass' : 'tile_grass_alt', cx, cz, 0);
      }
    }
    for (const [key, meshes] of this.tiles) {
      for (const mesh of meshes) {
        mesh.count = counts.get(key)!;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }

  private syncRock(cell: Cell, i: number, cx: number, cz: number): void {
    const existing = this.rocks.get(i);
    if (cell.kind === 'rock' && !existing) {
      const rock = this.assets.instance('rock');
      rock.position.set(cx, 0, cz);
      rock.rotation.y = Math.floor(hash(i) * 4) * (Math.PI / 2) + 0.3;
      this.group.add(rock);
      this.rocks.set(i, rock);
    } else if (cell.kind !== 'rock' && existing) {
      existing.removeFromParent();
      this.rocks.delete(i);
    }
  }

  private syncManhole(cell: Cell, i: number, cx: number, cz: number, rotation: number): void {
    if (!cell.shaft || this.manholes.has(i)) return;
    const manhole = this.assets.instance('manhole');
    manhole.position.set(cx, -0.02, cz);
    manhole.rotation.y = rotation;
    this.group.add(manhole);
    this.manholes.set(i, manhole);
  }

  /** Fenster leuchten warm, die LED am Anschlusskasten wird grün. */
  setOnline(houseId: string): void {
    this.onlineHouses.add(houseId);
    for (const m of this.windowMaterials.get(houseId) ?? []) {
      m.color.set('#fff2b0');
      m.emissive.set('#ffc94a');
      m.emissiveIntensity = 1.6;
    }
    for (const m of this.socketLeds.get(houseId) ?? []) {
      m.color.set('#5dff8a');
      m.emissive.set('#3dff6a');
      m.emissiveIntensity = 3;
    }
  }

  /** Wasser und Straßen laufen über den Kartenrand hinaus weiter, damit sie nicht abrupt enden. */
  private borderKind(cx: number, cz: number): 'water' | 'road' | null {
    const { width, height } = this.state;
    const ex = Math.min(width - 1, Math.max(0, cx));
    const ez = Math.min(height - 1, Math.max(0, cz));
    // Nur gerade Fortsetzungen, keine Ecken.
    if ((cx < 0 || cx >= width) && (cz < 0 || cz >= height)) return null;
    const kind = this.state.cells[ez * width + ex]!.kind;
    return kind === 'water' || kind === 'road' ? kind : null;
  }

  private nearHouse(cx: number, cz: number): boolean {
    return this.state.houses.some((h) => {
      const c = this.houseCenter(h);
      return Math.abs(c.x - cx) < 2.2 && cz - c.z > -1.5 && cz - c.z < 4.5;
    });
  }

  /** Weltposition der Mitte eines Hauses (für Effekte). */
  houseCenter(house: House): THREE.Vector3 {
    const coords = house.cells.map((i) => cellCoords(this.state, i));
    return new THREE.Vector3(
      coords.reduce((s, c) => s + c.cx, 0) / coords.length,
      0,
      coords.reduce((s, c) => s + c.cz, 0) / coords.length,
    );
  }
}
