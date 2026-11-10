import {
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { dieModel, restingHeight, restingOrientation } from './dice-geometry';
import {
  clamp01,
  type DiceColors,
  DiceKit,
  easeOutCubic,
  random,
  randomTumble,
  type Tumble,
  tumbleAt,
} from './dice-mesh';
import type { AnimatedDie } from './dice-rules';

export type { DiceColors } from './dice-mesh';

interface Throw {
  die: AnimatedDie;
  colors: DiceColors;
  revealed: boolean;
  object: Group;
  start: Vector3;
  end: Vector3;
  rest: number;
  drop: number;
  firstImpact: number;
  tumble: Tumble;
}

const DIE_RADIUS = 1.1;
const SETTLE_S = 1.6;
const HOLD_S = 1.4;
const FADE_S = 0.45;
const GRAVITY_BOUNCE = 0.42;
const SPACING = 2.9;
const CAMERA_HOME = new Vector3(0, 27, 5);
const HALF_FOV = (30 * Math.PI) / 360;

function heightAt(t: number, drop: number, firstImpact: number, rest: number): number {
  const gravity = (2 * (drop - rest)) / firstImpact ** 2;
  if (t < firstImpact) {
    return drop - 0.5 * gravity * t * t;
  }
  let elapsed = t - firstImpact;
  let speed = gravity * firstImpact * GRAVITY_BOUNCE;
  while (speed > 0.8) {
    const flight = (2 * speed) / gravity;
    if (elapsed < flight) {
      return rest + speed * elapsed - 0.5 * gravity * elapsed * elapsed;
    }
    elapsed -= flight;
    speed *= GRAVITY_BOUNCE;
  }
  return rest;
}

function landingSpots(count: number, paired: boolean): Vector3[] {
  const square = Math.ceil(Math.sqrt(count));
  const columns = paired && square % 2 === 1 ? square + 1 : square;
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return new Vector3(
      (column - (columns - 1) / 2) * SPACING + random(-0.3, 0.3),
      0,
      (row - (rows - 1) / 2) * SPACING + random(-0.3, 0.3),
    );
  });
}

export class DiceScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 100);
  private readonly kit = new DiceKit();
  private throws: Throw[] = [];
  private frame = 0;
  private finish: (() => void) | null = null;
  private run = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    const sky = new HemisphereLight(0xffffff, 0x777777, 1.6);
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(6, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.radius = 4;

    const floor = new Mesh(new PlaneGeometry(80, 80), new ShadowMaterial({ opacity: 0.22 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    this.scene.add(sky, sun, floor);
  }

  async play(dice: AnimatedDie[], colors: DiceColors, blockedLeftPx: number): Promise<void> {
    this.stop();
    this.resize();
    const run = this.run;

    const spots = landingSpots(
      dice.length,
      dice.some((die) => die.paired),
    );
    this.frameLayout(spots, blockedLeftPx);
    this.throws = dice.map((die, index) => {
      const object = this.kit.build({ ...die, critical: false }, colors, DIE_RADIUS);
      const model = dieModel(die.shape);
      const target = restingOrientation(model, die.resultIndex, random(-0.35, 0.35));
      const end = spots[index];
      const throwItem: Throw = {
        die,
        colors,
        revealed: !die.critical,
        object,
        start: new Vector3(end.x + random(-2, 2), 0, end.z - random(7, 10)),
        end,
        rest: restingHeight(model, target) * DIE_RADIUS,
        drop: random(9, 12),
        firstImpact: random(0.4, 0.5),
        tumble: randomTumble(target),
      };
      this.scene.add(object);
      return throwItem;
    });

    await this.kit
      .warmUp(dice, colors, this.renderer, this.scene, this.camera)
      .catch(() => undefined);
    if (run !== this.run) {
      return;
    }

    return new Promise((resolve) => {
      const started = performance.now();
      this.finish = () => {
        this.finish = null;
        this.clear();
        resolve();
      };

      const step = (now: number) => {
        const t = (now - started) / 1000;
        for (const item of this.throws) {
          this.pose(item, Math.min(t, SETTLE_S));
          if (t >= SETTLE_S - 0.1) {
            this.reveal(item);
          }
        }
        const fade = clamp01((t - SETTLE_S - HOLD_S) / FADE_S);
        this.canvas.style.opacity = String(1 - fade);
        this.renderer.render(this.scene, this.camera);

        if (fade >= 1) {
          this.finish?.();
          return;
        }
        this.frame = requestAnimationFrame(step);
      };
      this.canvas.style.opacity = '1';
      this.frame = requestAnimationFrame(step);
    });
  }

  stop(): void {
    this.run++;
    cancelAnimationFrame(this.frame);
    const finish = this.finish;
    this.finish = null;
    if (finish) {
      finish();
    } else {
      this.clear();
    }
  }

  dispose(): void {
    this.stop();
    this.kit.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private pose(item: Throw, t: number): void {
    const travel = easeOutCubic(clamp01(t / (SETTLE_S * 0.85)));
    item.object.position.set(
      item.start.x + (item.end.x - item.start.x) * travel,
      heightAt(t, item.drop, item.firstImpact, item.rest),
      item.start.z + (item.end.z - item.start.z) * travel,
    );

    item.object.quaternion.copy(tumbleAt(item.tumble, t, SETTLE_S));
  }

  private reveal(item: Throw): void {
    if (item.revealed) {
      return;
    }
    item.revealed = true;
    const painted = this.kit.build(item.die, item.colors, DIE_RADIUS);
    painted.position.copy(item.object.position);
    painted.quaternion.copy(item.object.quaternion);
    this.scene.remove(item.object);
    this.scene.add(painted);
    item.object = painted;
  }

  private frameLayout(spots: Vector3[], blockedLeftPx: number): void {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const blocked = blockedLeftPx < width * 0.5 ? Math.max(0, blockedLeftPx) : 0;
    const freeWidth = width - blocked;

    const halfWidth = Math.max(...spots.map((spot) => Math.abs(spot.x))) + DIE_RADIUS * 2;
    const halfDepth = Math.max(...spots.map((spot) => Math.abs(spot.z))) + DIE_RADIUS * 2;
    const distance = CAMERA_HOME.length();
    const visibleHalfHeight = Math.tan(HALF_FOV) * distance;
    const visibleHalfWidth = visibleHalfHeight * (freeWidth / height);
    const zoomOut = Math.max(1, halfWidth / visibleHalfWidth, halfDepth / visibleHalfHeight);

    const worldPerPx = (2 * visibleHalfHeight * zoomOut) / height;
    const shift = (blocked / 2) * worldPerPx;
    this.camera.position.copy(CAMERA_HOME).multiplyScalar(zoomOut);
    this.camera.position.x -= shift;
    this.camera.lookAt(-shift, 0, 0);
  }

  private clear(): void {
    for (const item of this.throws) {
      this.scene.remove(item.object);
    }
    this.throws = [];
    this.canvas.style.opacity = '0';
    this.renderer.clear();
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
