import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LucideDices, LucideDynamicIcon } from '@lucide/angular';
import { TableState } from '../realtime/table-state';
import { ATTRIBUTE_ICONS } from './attribute-icons';
import {
  type Attribute,
  ATTRIBUTES,
  clampInteger,
  d20Roll,
  modifier,
  rollLabel,
  SHEET_LIMITS,
  type SheetData,
  signed,
} from './sheet-model';
import { injectSheetRoll } from './sheet-roller';

@Component({
  selector: 'app-sheet-attributes',
  imports: [LucideDices, LucideDynamicIcon],
  templateUrl: './sheet-attributes.html',
  styleUrl: './sheet-attributes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetAttributesEditor {
  readonly value = input.required<SheetData['attributes']>();
  readonly character = input.required<string>();
  readonly changed = output<SheetData['attributes']>();

  protected readonly attributes = ATTRIBUTES;
  protected readonly icons = ATTRIBUTE_ICONS;
  protected readonly signed = signed;
  protected readonly cooldown = inject(TableState).diceCooldown;
  private readonly roll = injectSheetRoll();

  protected mod(attribute: Attribute): number {
    return modifier(this.value()[attribute]);
  }

  protected formula(attribute: Attribute): string {
    return d20Roll(this.mod(attribute));
  }

  protected type(attribute: Attribute, event: Event): void {
    const element = event.target as HTMLInputElement;
    const next = clampInteger(element.value, 0, SHEET_LIMITS.attribute, this.value()[attribute]);
    element.value = String(next);
    this.changed.emit({ ...this.value(), [attribute]: next });
  }

  protected test(attribute: (typeof ATTRIBUTES)[number]): void {
    this.roll(this.formula(attribute.id), rollLabel(this.character(), attribute.label));
  }
}
