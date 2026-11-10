export interface DiceColors {
  body: string;
  ink: string;
  critical: string;
  criticalInk: string;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function readDiceColors(scope: Element = document.documentElement): DiceColors {
  const styles = getComputedStyle(scope);
  return {
    body: styles.getPropertyValue('--color-inverse').trim() || '#ffffff',
    ink: styles.getPropertyValue('--color-inverse-text').trim() || '#000000',
    critical: styles.getPropertyValue('--color-critical').trim() || '#e5484d',
    criticalInk: styles.getPropertyValue('--color-critical-text').trim() || '#ffffff',
  };
}

export async function loadDiceFont(): Promise<void> {
  await document.fonts?.load('600 48px "Geist Mono Variable"').catch(() => undefined);
}
