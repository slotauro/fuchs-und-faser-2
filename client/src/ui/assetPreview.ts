import * as THREE from 'three';
import { AssetManager, MODEL_PATHS, type ModelKey } from '../assets/AssetManager';
import { h } from './dom';

/**
 * Prüfseite (?view=assets): alle GLB-Modelle aus Blender nebeneinander auf einem
 * 1×1-Kachelraster, damit Größe, Ausrichtung (Front = +Z, zur Kamera), Materialien
 * und Animationen im Browser kontrolliert werden können.
 */
export async function showAssetPreview(stage: HTMLElement, overlay: HTMLElement): Promise<void> {
  const assets = new AssetManager();
  await assets.loadAll();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe3f2');
  scene.add(new THREE.HemisphereLight('#fff6e0', '#5a7a3a', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
  sun.position.set(-4, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  scene.add(sun);
  scene.add(new THREE.GridHelper(24, 24, '#2b4a1f', '#4c7a35'));

  const keys = (Object.keys(MODEL_PATHS) as ModelKey[]).filter((k) => k !== 'ground');
  const mixers: THREE.AnimationMixer[] = [];
  const report: string[] = [];
  keys.forEach((key, i) => {
    const model = assets.instance(key);
    // Gebäude brauchen 2×2 Kacheln, alles andere eine.
    model.position.set((i - (keys.length - 1) / 2) * 2, 0, key === 'house' ? 0.5 : 0);
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    report.push(`${key}: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m, Boden ${box.min.y.toFixed(2)}`);
    const clips = assets.animations(key);
    if (clips.length > 0) {
      const mixer = new THREE.AnimationMixer(model);
      const walk = clips.find((c) => c.name === 'Walk') ?? clips[0]!;
      mixer.clipAction(walk).play();
      mixers.push(mixer);
      report.push(`  Animationen: ${clips.map((c) => `${c.name} ${c.duration.toFixed(2)} s`).join(', ')}`);
    }
  });
  const tileNames = ['tile_grass', 'tile_grass_alt', 'tile_roots', 'tile_gravel', 'tile_road', 'tile_water', 'tile_trench', 'tile_conduit', 'tile_paving'];
  tileNames.forEach((name, i) => {
    for (const part of assets.tileParts(name)) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.set((i - (tileNames.length - 1) / 2) * 1.1, 0, 3);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  });
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });

  const camera = new THREE.OrthographicCamera();
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    const halfW = 10.5;
    const halfH = halfW / (innerWidth / innerHeight);
    Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH, near: 0.1, far: 100 });
    camera.position.set(0, 9, 11);
    camera.lookAt(0, 0.3, 1.2);
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);
  overlay.replaceChildren(h('pre', { class: 'asset-report', 'data-testid': 'asset-report' }, report.join('\n')));

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    for (const m of mixers) m.update(dt);
    renderer.render(scene, camera);
  });
}
