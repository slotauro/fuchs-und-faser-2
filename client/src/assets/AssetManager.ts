import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { AnimalId } from '@ff/shared';

/** Alle GLB-Modelle aus Blender (siehe tools/blender). Pfade relativ zur Basis-URL. */
export const MODEL_PATHS = {
  fox: 'models/characters/fox.glb',
  mole: 'models/characters/mole.glb',
  beaver: 'models/characters/beaver.glb',
  badger: 'models/characters/badger.glb',
  house: 'models/buildings/house.glb',
  distributor: 'models/infrastructure/distributor.glb',
  socket: 'models/infrastructure/socket.glb',
  manhole: 'models/infrastructure/manhole.glb',
  cableCoil: 'models/infrastructure/cable-coil.glb',
  cableSpool: 'models/infrastructure/cable-spool.glb',
  rock: 'models/environment/rock.glb',
  tree: 'models/environment/tree.glb',
  ground: 'models/environment/ground-tiles.glb',
} as const;

export type ModelKey = keyof typeof MODEL_PATHS;

/** Welches Modell eine Tierfigur nutzt. */
export const CHARACTER_MODELS: Record<AnimalId, ModelKey> = {
  fox: 'fox',
  mole: 'mole',
  beaver: 'beaver',
  badger: 'badger',
};

export interface MeshPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export class AssetManager {
  private readonly models = new Map<ModelKey, GLTF>();

  async loadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const keys = Object.keys(MODEL_PATHS) as ModelKey[];
    let loaded = 0;
    await Promise.all(
      keys.map(async (key) => {
        const gltf = await loader.loadAsync(import.meta.env.BASE_URL + MODEL_PATHS[key]);
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        this.models.set(key, gltf);
        onProgress?.(++loaded, keys.length);
      }),
    );
  }

  get(key: ModelKey): GLTF {
    const gltf = this.models.get(key);
    if (!gltf) throw new Error(`Modell nicht geladen: ${key}`);
    return gltf;
  }

  /** Eigenständige Kopie eines Modells; Figuren mit Skelett werden passend geklont. */
  instance(key: ModelKey): THREE.Object3D {
    const source = this.get(key).scene;
    let skinned = false;
    source.traverse((o) => {
      if ((o as THREE.Bone).isBone) skinned = true;
    });
    return skinned ? cloneSkinned(source) : source.clone(true);
  }

  animations(key: ModelKey): THREE.AnimationClip[] {
    return this.get(key).animations;
  }

  /** Geometrie und Material einer Bodenkachel aus ground-tiles.glb, z. B. "tile_grass". */
  tileParts(name: string): MeshPart[] {
    const node = this.get('ground').scene.getObjectByName(name);
    if (!node) throw new Error(`Bodenkachel fehlt: ${name}`);
    const parts: MeshPart[] = [];
    node.traverse((o) => {
      if (o instanceof THREE.Mesh) parts.push({ geometry: o.geometry, material: o.material as THREE.Material });
    });
    return parts;
  }
}
