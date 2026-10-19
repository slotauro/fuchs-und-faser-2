import * as THREE from 'three';
import { ANIMAL_IDS, type AnimalId } from '@ff/shared';
import { CHARACTER_MODELS, type AssetManager } from '../assets/AssetManager';

/**
 * Rendert für jedes Tier ein Porträt aus dem echten 3D-Modell (einmalig beim Start),
 * damit Menü und Lobby dieselben Figuren zeigen wie das Spiel.
 */
export function renderPortraits(assets: AssetManager, size = 256): Record<AnimalId, string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e0', '#7a6a50', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(-1, 2, 3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0.5, 0.75, 2.2);
  camera.lookAt(0, 0.45, 0);

  const result = {} as Record<AnimalId, string>;
  for (const id of ANIMAL_IDS) {
    const key = CHARACTER_MODELS[id];
    const model = assets.instance(key);
    model.rotation.y = 0.35;
    const mixer = new THREE.AnimationMixer(model);
    const idle = assets.animations(key).find((c) => c.name === 'Idle');
    if (idle) {
      mixer.clipAction(idle).play();
      mixer.update(0.3);
    }
    scene.add(model);
    renderer.render(scene, camera);
    result[id] = renderer.domElement.toDataURL('image/png');
    scene.remove(model);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return result;
}
