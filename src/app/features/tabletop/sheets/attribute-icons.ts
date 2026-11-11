import {
  LucideBicepsFlexed,
  LucideBrain,
  LucideClover,
  LucideCrosshair,
  LucideEye,
  LucideShield,
  LucideSparkles,
  LucideWind,
} from '@lucide/angular';
import type { Attribute } from './sheet-model';

export const ATTRIBUTE_ICONS = {
  strength: LucideBicepsFlexed,
  dexterity: LucideCrosshair,
  agility: LucideWind,
  resistance: LucideShield,
  perception: LucideEye,
  intelligence: LucideBrain,
  charisma: LucideSparkles,
  luck: LucideClover,
} as const satisfies Record<Attribute, unknown>;
