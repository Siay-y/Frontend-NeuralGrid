export const MAP_UPLOAD = {
  types: ['image/png', 'image/jpeg', 'image/webp'],
  maxInputBytes: 40 * 1024 * 1024,
  maxInputPixels: 64_000_000,
  maxSide: 4096,
  targetBytes: Math.floor(2.8 * 1024 * 1024),
  thumbnailSide: 320,
  maxMaps: 40,
  maxAreas: 12,
  maxTotalBytes: 300 * 1024 * 1024,
  nameLength: 48,
  cellMin: 8,
  cellMax: 1024,
} as const;

const QUALITY_STEPS = [0.85, 0.75, 0.65] as const;
const SHRINK_STEP = 0.8;

export interface PreparedMap {
  name: string;
  image: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export class MapImageError extends Error {}

export function fitWithin(size: Size, maxSide: number): Size {
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

export function mapNameFromFile(fileName: string): string {
  const name = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAP_UPLOAD.nameLength)
    .trim();
  return name || 'Mapa';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toLocaleString('pt-BR', { maximumFractionDigits: megabytes < 10 ? 1 : 0 })} MB`;
}

export function uploadProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(MAP_UPLOAD.types as readonly string[]).includes(file.type)) {
    return 'Envie uma imagem PNG, JPEG ou WebP.';
  }
  if (file.size > MAP_UPLOAD.maxInputBytes) {
    return `A imagem pode ter até ${formatBytes(MAP_UPLOAD.maxInputBytes)}.`;
  }
  return null;
}

export async function prepareMapUpload(file: File): Promise<PreparedMap> {
  const problem = uploadProblem(file);
  if (problem) {
    throw new MapImageError(problem);
  }
  const source = await loadImage(file);
  if (source.naturalWidth * source.naturalHeight > MAP_UPLOAD.maxInputPixels) {
    throw new MapImageError('A imagem é grande demais. Use uma de até 64 megapixels.');
  }

  let size = fitWithin(
    { width: source.naturalWidth, height: source.naturalHeight },
    MAP_UPLOAD.maxSide,
  );
  let canvas = draw(source, size);
  let image = await encode(canvas, QUALITY_STEPS[0]);
  for (const quality of QUALITY_STEPS.slice(1)) {
    if (image.size <= MAP_UPLOAD.targetBytes) {
      break;
    }
    image = await encode(canvas, quality);
  }
  while (image.size > MAP_UPLOAD.targetBytes && Math.max(size.width, size.height) > 512) {
    size = fitWithin(size, Math.max(size.width, size.height) * SHRINK_STEP);
    canvas = draw(canvas, size);
    image = await encode(canvas, QUALITY_STEPS.at(-1) ?? 0.65);
  }

  const thumbnail = await encode(
    draw(canvas, fitWithin(size, MAP_UPLOAD.thumbnailSide)),
    QUALITY_STEPS.at(-1) ?? 0.65,
  );
  return { name: mapNameFromFile(file.name), image, thumbnail, ...size };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new MapImageError('Não foi possível ler essa imagem.'));
    image.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

function draw(source: CanvasImageSource, size: Size): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new MapImageError('Seu navegador não conseguiu preparar a imagem.');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp?.type === 'image/webp') {
    return webp;
  }
  const jpeg = await toBlob(canvas, 'image/jpeg', quality);
  if (!jpeg) {
    throw new MapImageError('Seu navegador não conseguiu preparar a imagem.');
  }
  return jpeg;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
