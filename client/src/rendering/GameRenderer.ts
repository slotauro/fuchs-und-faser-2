import * as THREE from 'three';

/** Kamerawinkel: von vorne oben, schräg orthografisch. Spiel-+Z zeigt zum Betrachter. */
const CAMERA_PITCH = THREE.MathUtils.degToRad(36);
const CAMERA_DISTANCE = 30;

/**
 * Szene, feste schräge Orthokamera, Licht und Schatten.
 * Die Welt nutzt Kachelkoordinaten direkt: Kachel (cx, cz) liegt bei x = cx, z = cz.
 */
export class GameRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  readonly renderer: THREE.WebGLRenderer;
  private readonly sun: THREE.DirectionalLight;
  private center = new THREE.Vector3();
  private extent = { width: 10, height: 10 };

  constructor(
    private readonly container: HTMLElement,
    lowGraphics = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: !lowGraphics, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(lowGraphics ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !lowGraphics;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#bfe3f2');
    this.scene.add(new THREE.HemisphereLight('#fff6e0', '#5a7a3a', 1.6));
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  /** Richtet Kamera und Schattenbereich auf eine Karte aus. */
  frame(width: number, height: number): void {
    this.extent = { width, height };
    this.center.set((width - 1) / 2, 0, (height - 1) / 2);
    const dir = new THREE.Vector3(0, Math.sin(CAMERA_PITCH), Math.cos(CAMERA_PITCH));
    this.camera.position.copy(this.center).addScaledVector(dir, CAMERA_DISTANCE);
    this.camera.lookAt(this.center);

    this.sun.position.copy(this.center).add(new THREE.Vector3(-6, 14, 8));
    this.sun.target.position.copy(this.center);
    const s = Math.max(width, height) * 0.75 + 2;
    const cam = this.sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 1;
    cam.far = 50;
    cam.updateProjectionMatrix();
    this.resize();
  }

  readonly resize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    // Karte inklusive Rand und perspektivischer Stauchung der Tiefe einpassen.
    const needW = this.extent.width + 1.5;
    const needH = this.extent.height * Math.sin(CAMERA_PITCH) + 2.6;
    const halfH = Math.max(needH / 2, needW / 2 / aspect);
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  };

  /** Bildschirmposition (CSS-Pixel) eines Weltpunkts, für HTML-Beschriftungen. */
  toScreen(point: THREE.Vector3): { x: number; y: number } {
    const p = point.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
