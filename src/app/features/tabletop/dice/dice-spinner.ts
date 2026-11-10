import {
  DirectionalLight,
  type Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { dieModel, restingHeight, restingOrientation } from './dice-geometry';
import {
  clamp01,
  type DiceColors,
  DiceKit,
  random,
  randomTumble,
  type Tumble,
  tumbleAt,
} from './dice-mesh';
import { type AnimatedDie, previewColumns } from './dice-rules';

interface Spin {
  die: AnimatedDie;
  colors: DiceColors;
  revealed: boolean;
  object: Group;
  rest: number;
  hop: number;
  delay: number;
  tumble: Tumble;
}

export const SPIN_SETTLE_S = 1.5;

const DIE_RADIUS = 1;
const SPACING = 2.35;
const CAMERA_HOME = new Vector3(0, 6, 1.1);
const HALF_FOV = (30 * Math.PI) / 360;

export class DiceSpinner {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 100);
  private readonly kit = new DiceKit();
  private spins: Spin[] = [];
  private frame = 0;
  private run = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const sky = new HemisphereLight(0xffffff, 0x777777, 1.7);
    const sun = new DirectionalLight(0xffffff, 2.1);
    sun.position.set(4, 10, 6);
    this.scene.add(sky, sun);
  }

  async spin(dice: AnimatedDie[], colors: DiceColors): Promise<void> {
    cancelAnimationFrame(this.frame);
    this.clear();
    this.resize();
    const run = ++this.run;

    const columns = previewColumns(dice.length);
    const stagger = Math.min(0.05, 0.6 / dice.length);
    const rows = Math.ceil(dice.length / columns);
    this.fitCamera(columns, rows);

    this.spins = dice.map((die, index) => {
      const model = dieModel(die.shape);
      const target = restingOrientation(model, die.resultIndex, random(-0.25, 0.25));
      const object = this.kit.build({ ...die, outcome: null }, colors, DIE_RADIUS);
      const column = index % columns;
      const row = Math.floor(index / columns);
      const rest = restingHeight(model, target) * DIE_RADIUS;
      object.position.set(
        (column - (columns - 1) / 2) * SPACING,
        rest,
        (row - (rows - 1) / 2) * SPACING,
      );
      this.scene.add(object);
      return {
        die,
        colors,
        revealed: die.outcome === null,
        object,
        rest,
        hop: random(0.5, 0.9),
        delay: index * stagger,
        tumble: randomTumble(target),
      };
    });

    await this.kit
      .warmUp(dice, colors, this.renderer, this.scene, this.camera)
      .catch(() => undefined);
    if (run !== this.run) {
      return;
    }

    return new Promise((resolve) => {
      const started = performance.now();
      const step = (now: number) => {
        const elapsed = (now - started) / 1000;
        let done = true;
        for (const spin of this.spins) {
          const t = Math.min(SPIN_SETTLE_S, Math.max(0, elapsed - spin.delay));
          done &&= t >= SPIN_SETTLE_S;
          const lift = Math.sin(Math.PI * clamp01(t / 0.55)) * spin.hop * Math.exp(-2 * t);
          spin.object.position.y = spin.rest + lift;
          spin.object.quaternion.copy(tumbleAt(spin.tumble, t, SPIN_SETTLE_S));
          if (t >= SPIN_SETTLE_S - 0.1) {
            this.reveal(spin);
          }
        }
        this.renderer.render(this.scene, this.camera);
        if (done) {
          resolve();
          return;
        }
        this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  private reveal(spin: Spin): void {
    if (spin.revealed) {
      return;
    }
    spin.revealed = true;
    const painted = this.kit.build(spin.die, spin.colors, DIE_RADIUS);
    painted.position.copy(spin.object.position);
    painted.quaternion.copy(spin.object.quaternion);
    this.scene.remove(spin.object);
    this.scene.add(painted);
    spin.object = painted;
  }

  dispose(): void {
    this.run++;
    cancelAnimationFrame(this.frame);
    this.clear();
    this.kit.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private fitCamera(columns: number, rows: number): void {
    const halfWidth = ((columns - 1) * SPACING) / 2 + DIE_RADIUS * 1.6;
    const halfDepth = ((rows - 1) * SPACING) / 2 + DIE_RADIUS * 1.5;
    const distance = CAMERA_HOME.length();
    const visibleHalfHeight = Math.tan(HALF_FOV) * distance;
    const visibleHalfWidth = visibleHalfHeight * this.camera.aspect;
    const zoomOut = Math.max(1, halfWidth / visibleHalfWidth, halfDepth / visibleHalfHeight);
    this.camera.position.copy(CAMERA_HOME).multiplyScalar(zoomOut);
    this.camera.lookAt(0, 0.4, 0);
  }

  private clear(): void {
    for (const spin of this.spins) {
      this.scene.remove(spin.object);
    }
    this.spins = [];
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
