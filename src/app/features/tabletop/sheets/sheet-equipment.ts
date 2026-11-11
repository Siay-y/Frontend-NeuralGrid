import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideChevronDown, LucideDices, LucidePlus, LucideX } from '@lucide/angular';
import { TableState } from '../realtime/table-state';
import {
  type Attribute,
  ATTRIBUTES,
  carriedWeight,
  clampInteger,
  clampWeight,
  d20Roll,
  formatWeight,
  isValidDamage,
  modifier,
  rollLabel,
  SHEET_LIMITS,
  type SheetData,
  type SheetEquipment,
  type SheetWeapon,
  signed,
} from './sheet-model';
import { injectSheetRoll } from './sheet-roller';

type ListKey = keyof SheetEquipment;
type Entry<K extends ListKey> = SheetEquipment[K][number];

const BLANK: { [K in ListKey]: () => Entry<K> } = {
  weapons: () => ({
    id: crypto.randomUUID(),
    name: '',
    attribute: 'strength',
    bonus: 0,
    damage: '',
    weight: 0,
  }),
  armors: () => ({ id: crypto.randomUUID(), name: '', defense: 0, bonus: 0, weight: 0 }),
  items: () => ({ id: crypto.randomUUID(), name: '', quantity: 1, weight: 0 }),
};

const LIMIT: Record<ListKey, number> = {
  weapons: SHEET_LIMITS.weapons,
  armors: SHEET_LIMITS.armors,
  items: SHEET_LIMITS.items,
};

@Component({
  selector: 'app-sheet-equipment',
  imports: [LucideChevronDown, LucideDices, LucidePlus, LucideX],
  templateUrl: './sheet-equipment.html',
  styleUrl: './sheet-equipment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetEquipmentEditor {
  readonly value = input.required<SheetEquipment>();
  readonly attributes = input.required<SheetData['attributes']>();
  readonly carry = input.required<number>();
  readonly character = input.required<string>();
  readonly changed = output<SheetEquipment>();

  protected readonly limits = SHEET_LIMITS;
  protected readonly listLimit = LIMIT;
  protected readonly attributeOptions = ATTRIBUTES;
  protected readonly canRoll = isValidDamage;
  protected readonly signed = signed;
  protected readonly formatWeight = formatWeight;
  protected readonly cooldown = inject(TableState).diceCooldown;
  private readonly roll = injectSheetRoll();

  protected readonly load = computed(() => carriedWeight(this.value()));
  protected readonly loadRatio = computed(() =>
    this.carry() <= 0 ? 1 : Math.min(1, this.load() / this.carry()),
  );
  protected readonly overloaded = computed(() => this.load() > this.carry());
  protected readonly armorTotal = computed(() =>
    this.value().armors.reduce((sum, armor) => sum + armor.defense + armor.bonus, 0),
  );

  protected attack(weapon: SheetWeapon): number {
    return modifier(this.attributes()[weapon.attribute]) + weapon.bonus;
  }

  protected add(key: ListKey): void {
    const list = this.value()[key] as Entry<ListKey>[];
    if (list.length < LIMIT[key]) {
      this.changed.emit({ ...this.value(), [key]: [...list, BLANK[key]()] });
    }
  }

  protected remove(key: ListKey, id: string): void {
    const list = this.value()[key] as Entry<ListKey>[];
    this.changed.emit({ ...this.value(), [key]: list.filter((entry) => entry.id !== id) });
  }

  protected rename(key: ListKey, entry: Entry<ListKey>, event: Event): void {
    this.patch(key, entry.id, { name: (event.target as HTMLInputElement).value });
  }

  protected setWeight(key: ListKey, entry: Entry<ListKey>, event: Event): void {
    const element = event.target as HTMLInputElement;
    const weight = clampWeight(element.value, entry.weight);
    element.value = String(weight);
    this.patch(key, entry.id, { weight });
  }

  protected setNumber(
    key: ListKey,
    entry: Entry<ListKey>,
    field: 'bonus' | 'defense' | 'quantity',
    event: Event,
  ): void {
    const element = event.target as HTMLInputElement;
    const [min, max] =
      field === 'bonus'
        ? [-SHEET_LIMITS.bonus, SHEET_LIMITS.bonus]
        : [0, field === 'defense' ? SHEET_LIMITS.armor : SHEET_LIMITS.quantity];
    const current = (entry as unknown as Record<string, number>)[field] ?? 0;
    const next = clampInteger(element.value, min, max, current);
    element.value = String(next);
    this.patch(key, entry.id, { [field]: next });
  }

  protected setAttribute(weapon: SheetWeapon, event: Event): void {
    const attribute = (event.target as HTMLSelectElement).value as Attribute;
    this.patch('weapons', weapon.id, { attribute });
  }

  protected setDamage(weapon: SheetWeapon, event: Event): void {
    const element = event.target as HTMLInputElement;
    const damage = element.value.replace(/[^0-9dDkKhHlL+\-\s]/g, '');
    if (damage !== element.value) {
      element.value = damage;
    }
    this.patch('weapons', weapon.id, { damage });
  }

  protected rollAttack(weapon: SheetWeapon): void {
    this.roll(
      d20Roll(this.attack(weapon)),
      rollLabel(this.character(), `${weapon.name || 'Arma'}, ataque`),
    );
  }

  protected rollDamage(weapon: SheetWeapon): void {
    this.roll(
      weapon.damage.replace(/\s+/g, ''),
      rollLabel(this.character(), `${weapon.name || 'Arma'}, dano`),
    );
  }

  private patch(key: ListKey, id: string, changes: Record<string, unknown>): void {
    const list = this.value()[key] as Entry<ListKey>[];
    this.changed.emit({
      ...this.value(),
      [key]: list.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
    });
  }
}
