import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideShield } from '@lucide/angular';
import { SheetHpBar } from './sheet-hp';
import {
  clampInteger,
  formatWeight,
  type Gauge,
  METERS_PER_CELL,
  modifier,
  SHEET_LIMITS,
  type SheetData,
  type SheetStatus,
  signed,
} from './sheet-model';

type NumberField = 'xp' | 'movement' | 'money' | 'armor' | 'carry';

const FIELD_MAX: Record<NumberField, number> = {
  xp: SHEET_LIMITS.xp,
  movement: SHEET_LIMITS.movement,
  money: SHEET_LIMITS.money,
  armor: SHEET_LIMITS.armor,
  carry: SHEET_LIMITS.weight,
};

@Component({
  selector: 'app-sheet-status',
  imports: [LucideShield, SheetHpBar],
  templateUrl: './sheet-status.html',
  styleUrl: './sheet-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetStatusEditor {
  readonly value = input.required<SheetStatus>();
  readonly attributes = input.required<SheetData['attributes']>();
  readonly changed = output<SheetStatus>();

  protected readonly signed = signed;
  protected readonly resistance = computed(() => modifier(this.attributes().resistance));
  protected readonly defense = computed(() => this.value().armor + this.resistance());
  protected readonly cells = computed(() => formatWeight(this.value().movement / METERS_PER_CELL));

  protected setHp(hp: Gauge): void {
    this.changed.emit({ ...this.value(), hp });
  }

  protected type(field: NumberField, event: Event): void {
    const element = event.target as HTMLInputElement;
    const next = clampInteger(element.value, 0, FIELD_MAX[field], this.value()[field]);
    element.value = String(next);
    this.changed.emit({ ...this.value(), [field]: next });
  }
}
