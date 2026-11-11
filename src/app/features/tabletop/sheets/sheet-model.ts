import { TOKEN_LABEL_MAX_LENGTH, type TokenKind, type TokenSex } from '../realtime/table.protocol';

export type Attribute =
  'strength' | 'agility' | 'resistance' | 'perception' | 'intelligence' | 'charisma' | 'luck';

export type Skill =
  | 'acrobacia'
  | 'arcana'
  | 'atletismo'
  | 'percepcao'
  | 'historia'
  | 'intimidacao'
  | 'investigacao'
  | 'medicina'
  | 'performance'
  | 'persuasao'
  | 'furtividade';

export interface SheetIdentity {
  name: string;
  codename: string;
  age: number | null;
  sex: TokenSex | null;
  className: string;
}

export interface Gauge {
  current: number;
  max: number;
}

export interface SheetStatus {
  hp: Gauge;
  xp: number;
  movement: number;
  money: number;
  armor: number;
  carry: number;
}

export type SheetSkills = Record<Skill, number>;

export interface SheetWeapon {
  id: string;
  name: string;
  attribute: Attribute;
  bonus: number;
  damage: string;
  weight: number;
}

export interface SheetArmor {
  id: string;
  name: string;
  defense: number;
  bonus: number;
  weight: number;
}

export interface SheetItem {
  id: string;
  name: string;
  quantity: number;
  weight: number;
}

export interface SheetEquipment {
  weapons: SheetWeapon[];
  armors: SheetArmor[];
  items: SheetItem[];
}

export interface SheetData {
  identity: SheetIdentity;
  status: SheetStatus;
  attributes: Record<Attribute, number>;
  skills: SheetSkills;
  equipment: SheetEquipment;
}

export type SheetSection = keyof SheetData;

export interface CharacterSheet {
  id: string;
  ownerId: string | null;
  kind: TokenKind;
  data: SheetData;
  version: number;
}

export const SHEET_LIMITS = {
  name: 48,
  short: 64,
  itemName: 48,
  damage: 24,
  age: 999,
  attribute: 30,
  bonus: 20,
  gauge: 9_999,
  armor: 99,
  movement: 999,
  quantity: 999,
  weight: 9_999,
  money: 9_999_999,
  xp: 9_999_999,
  weapons: 20,
  armors: 10,
  items: 40,
} as const;

export const SHEETS_PER_PLAYER = 5;
export const METERS_PER_CELL = 1.5;

export const ATTRIBUTES: readonly { id: Attribute; short: string; label: string }[] = [
  { id: 'strength', short: 'FOR', label: 'Força' },
  { id: 'agility', short: 'AGI', label: 'Agilidade' },
  { id: 'resistance', short: 'RES', label: 'Resistência' },
  { id: 'perception', short: 'PER', label: 'Percepção' },
  { id: 'intelligence', short: 'INT', label: 'Inteligência' },
  { id: 'charisma', short: 'CAR', label: 'Carisma' },
  { id: 'luck', short: 'SOR', label: 'Sorte' },
];

export const ATTRIBUTE_SHORT = Object.fromEntries(
  ATTRIBUTES.map(({ id, short }) => [id, short]),
) as Record<Attribute, string>;

export const ATTRIBUTE_LABEL = Object.fromEntries(
  ATTRIBUTES.map(({ id, label }) => [id, label]),
) as Record<Attribute, string>;

export interface SkillDefinition {
  id: Skill;
  label: string;
  attribute: Attribute;
}

export const SKILLS: readonly SkillDefinition[] = [
  { id: 'acrobacia', label: 'Acrobacia', attribute: 'agility' },
  { id: 'arcana', label: 'Arcana', attribute: 'intelligence' },
  { id: 'atletismo', label: 'Atletismo', attribute: 'strength' },
  { id: 'percepcao', label: 'Percepção', attribute: 'perception' },
  { id: 'historia', label: 'História', attribute: 'intelligence' },
  { id: 'intimidacao', label: 'Intimidação', attribute: 'charisma' },
  { id: 'investigacao', label: 'Investigação', attribute: 'intelligence' },
  { id: 'medicina', label: 'Medicina', attribute: 'intelligence' },
  { id: 'performance', label: 'Performance', attribute: 'charisma' },
  { id: 'persuasao', label: 'Persuasão', attribute: 'charisma' },
  { id: 'furtividade', label: 'Furtividade', attribute: 'agility' },
];

export const ROLL_LABEL_MAX_LENGTH = 48;

export function newSheetData(name: string): SheetData {
  return {
    identity: { name, codename: '', age: null, sex: null, className: '' },
    status: {
      hp: { current: 10, max: 10 },
      xp: 0,
      movement: 9,
      money: 0,
      armor: 10,
      carry: 50,
    },
    attributes: Object.fromEntries(ATTRIBUTES.map(({ id }) => [id, 10])) as Record<
      Attribute,
      number
    >,
    skills: Object.fromEntries(SKILLS.map(({ id }) => [id, 0])) as SheetSkills,
    equipment: { weapons: [], armors: [], items: [] },
  };
}

export function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function clampWeight(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.round(Math.min(SHEET_LIMITS.weight, Math.max(0, parsed)) * 10) / 10;
}

export function modifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function signed(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return value < 0 ? `−${Math.abs(value)}` : '0';
}

export function d20Roll(bonus: number): string {
  if (bonus === 0) {
    return '1d20';
  }
  return bonus > 0 ? `1d20+${bonus}` : `1d20-${Math.abs(bonus)}`;
}

export function skillBonus(data: SheetData, skill: SkillDefinition): number {
  return modifier(data.attributes[skill.attribute]) + (data.skills[skill.id] ?? 0);
}

export function attackBonus(data: SheetData, weapon: SheetWeapon): number {
  return modifier(data.attributes[weapon.attribute]) + weapon.bonus;
}

export function defense(data: SheetData): number {
  return data.status.armor + modifier(data.attributes.resistance);
}

export function carriedWeight(equipment: SheetEquipment): number {
  const total =
    equipment.weapons.reduce((sum, weapon) => sum + weapon.weight, 0) +
    equipment.armors.reduce((sum, armor) => sum + armor.weight, 0) +
    equipment.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  return Math.round(total * 10) / 10;
}

export function formatWeight(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

export function rollLabel(character: string, subject: string): string {
  const label = `${character} · ${subject}`;
  return label.length <= ROLL_LABEL_MAX_LENGTH ? label : subject.slice(0, ROLL_LABEL_MAX_LENGTH);
}

export function gaugeRatio(gauge: Gauge): number {
  return gauge.max <= 0 ? 0 : Math.min(1, Math.max(0, gauge.current / gauge.max));
}

export function sheetSummary(data: SheetData): string {
  return [data.identity.className || 'Sem classe', `Defesa ${defense(data)}`].join(' · ');
}

export function sheetTokenLabel(data: SheetData): string {
  const { codename, name } = data.identity;
  const label = (codename.trim() || name.trim()).slice(0, TOKEN_LABEL_MAX_LENGTH).trim();
  return label || 'Sem nome';
}

export function isValidDamage(damage: string): boolean {
  return /^\s*\d{0,3}d\d{1,3}(\s*[+-]\s*(\d{1,3}d\d{1,3}|\d{1,3}))*\s*$/i.test(damage);
}
