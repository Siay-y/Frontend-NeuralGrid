import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideChevronDown, LucideSearch } from '@lucide/angular';
import type { TokenKind } from '../realtime/table.protocol';
import { TokenGlyph } from './token-glyph';
import { tokenIcon, TOKEN_ICON_GROUPS, TOKEN_ICON_VIEWBOX, TOKEN_ICONS } from './token-icons';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-token-icon-picker',
  imports: [TokenGlyph, LucideChevronDown, LucideSearch],
  templateUrl: './token-icon-picker.html',
  styleUrl: './token-icon-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TokenIconPicker),
      multi: true,
    },
  ],
})
export class TokenIconPicker implements ControlValueAccessor {
  readonly kind = input<TokenKind>('npc');
  readonly label = input('');

  protected readonly viewBox = `0 0 ${TOKEN_ICON_VIEWBOX} ${TOKEN_ICON_VIEWBOX}`;
  protected readonly value = signal<string | null>(null);
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly disabled = signal(false);

  protected readonly current = computed(() => tokenIcon(this.value()));
  protected readonly groups = computed(() => {
    const query = normalize(this.query());
    return TOKEN_ICON_GROUPS.map((group) => ({
      ...group,
      icons: TOKEN_ICONS.filter(
        (icon) =>
          icon.group === group.id && (query === '' || normalize(icon.label).includes(query)),
      ),
    })).filter((group) => group.icons.length > 0);
  });

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? null);
    this.open.set(false);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected toggle(): void {
    this.open.update((open) => !open);
    this.query.set('');
    this.onTouched();
  }

  protected pick(id: string | null): void {
    this.value.set(id);
    this.onChange(id);
    this.open.set(false);
  }

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
