import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TableState } from '../realtime/table-state';
import {
  ATTRIBUTE_SHORT,
  clampInteger,
  d20Roll,
  modifier,
  rollLabel,
  SHEET_LIMITS,
  type SheetData,
  signed,
  type SkillDefinition,
  SKILLS,
} from './sheet-model';
import { injectSheetRoll } from './sheet-roller';

@Component({
  selector: 'app-sheet-skills',
  templateUrl: './sheet-skills.html',
  styleUrl: './sheet-skills.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetSkillsEditor {
  readonly value = input.required<SheetData['skills']>();
  readonly attributes = input.required<SheetData['attributes']>();
  readonly character = input.required<string>();
  readonly changed = output<SheetData['skills']>();

  protected readonly skills = SKILLS;
  protected readonly attributeShort = ATTRIBUTE_SHORT;
  protected readonly signed = signed;
  protected readonly cooldown = inject(TableState).diceCooldown;
  private readonly roll = injectSheetRoll();

  protected bonus(skill: SkillDefinition): number {
    return this.value()[skill.id] ?? 0;
  }

  protected total(skill: SkillDefinition): number {
    return modifier(this.attributes()[skill.attribute]) + this.bonus(skill);
  }

  protected formula(skill: SkillDefinition): string {
    return d20Roll(this.total(skill));
  }

  protected setBonus(skill: SkillDefinition, event: Event): void {
    const element = event.target as HTMLInputElement;
    const next = clampInteger(
      element.value,
      -SHEET_LIMITS.bonus,
      SHEET_LIMITS.bonus,
      this.bonus(skill),
    );
    element.value = String(next);
    this.changed.emit({ ...this.value(), [skill.id]: next });
  }

  protected test(skill: SkillDefinition): void {
    this.roll(this.formula(skill), rollLabel(this.character(), skill.label));
  }
}
