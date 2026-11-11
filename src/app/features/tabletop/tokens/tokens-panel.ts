import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  LucideEye,
  LucideEyeOff,
  LucideLocateFixed,
  LucideLoaderCircle,
  LucidePlus,
  LucideScrollText,
  LucideSquarePen,
  LucideTrash,
} from '@lucide/angular';
import { findFreeCell } from '../board/token-geometry';
import { Collapsible } from '../panel/collapsible';
import { TableState } from '../realtime/table-state';
import {
  TOKEN_KIND_LABEL,
  TOKEN_LABEL_MAX_LENGTH,
  TOKEN_SEX_LABEL,
  TOKEN_SIZES,
  type TableToken,
  type TokenKind,
} from '../realtime/table.protocol';
import { QUICK_TOKEN_SECTION, TabletopStore } from '../tabletop.store';
import { TokenEditor } from './token-editor';
import { TokenGlyph } from './token-glyph';

interface QuickTokenForm {
  label: FormControl<string>;
  kind: FormControl<TokenKind>;
  size: FormControl<number>;
  hidden: FormControl<boolean>;
}

type TokenGroupId = TokenKind | 'unknown';

interface TokenGroup {
  id: TokenGroupId;
  section: string;
  label: string;
  tokens: TableToken[];
}

const DELETE_CONFIRM_MS = 3_000;
const KINDS = Object.keys(TOKEN_KIND_LABEL) as TokenKind[];
const GROUP_LABEL: Record<TokenGroupId, string> = {
  agent: 'Agentes',
  npc: 'NPCs',
  threat: 'Ameaças',
  unknown: 'Desconhecidos',
};
const GROUP_ORDER: readonly TokenGroupId[] = [...KINDS, 'unknown'];

@Component({
  selector: 'app-tokens-panel',
  imports: [
    ReactiveFormsModule,
    Collapsible,
    TokenEditor,
    TokenGlyph,
    LucideEye,
    LucideEyeOff,
    LucideLocateFixed,
    LucideLoaderCircle,
    LucidePlus,
    LucideScrollText,
    LucideSquarePen,
    LucideTrash,
  ],
  templateUrl: './tokens-panel.html',
  styleUrl: './tokens-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokensPanel {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly kinds = KINDS;
  protected readonly quickSection = QUICK_TOKEN_SECTION;
  protected readonly kindLabel = TOKEN_KIND_LABEL;
  protected readonly sexLabel = TOKEN_SEX_LABEL;
  protected readonly sizes = TOKEN_SIZES;
  protected readonly maxLabel = TOKEN_LABEL_MAX_LENGTH;

  protected readonly form: FormGroup<QuickTokenForm> = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(TOKEN_LABEL_MAX_LENGTH)]],
    kind: this.fb.control<TokenKind>('threat'),
    size: this.fb.control(1),
    hidden: this.fb.control(false),
  });

  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly confirmingDeleteId = signal<string | null>(null);

  protected readonly editing = computed(() => {
    const id = this.editingId();
    return id ? this.table.token(id) : undefined;
  });
  protected readonly tokens = computed(() =>
    [...this.table.tokens()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
  );
  protected readonly groups = computed<TokenGroup[]>(() => {
    const buckets = new Map<TokenGroupId, TableToken[]>();
    for (const token of this.tokens()) {
      const id = this.table.isMasked(token) ? 'unknown' : token.kind;
      buckets.set(id, [...(buckets.get(id) ?? []), token]);
    }
    return GROUP_ORDER.flatMap((id) => {
      const tokens = buckets.get(id);
      return tokens ? [{ id, section: `tokens-group-${id}`, label: GROUP_LABEL[id], tokens }] : [];
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  protected ownerName(token: TableToken): string {
    return this.table.member(token.ownerId)?.displayName ?? 'Sem dono';
  }

  protected isOwnerOnline(token: TableToken): boolean {
    return token.ownerId !== null && this.table.onlineIds().has(token.ownerId);
  }

  protected isMine(token: TableToken): boolean {
    return token.ownerId !== null && token.ownerId === this.table.me()?.id;
  }

  protected sheetOf(token: TableToken): string | null {
    return this.table.sheet(token.sheetId) ? token.sheetId : null;
  }

  protected showLabelError(): boolean {
    const control = this.form.controls.label;
    return control.invalid && (control.touched || this.submitted());
  }

  protected locate(token: TableToken): void {
    this.store.selectToken(token.id);
    this.store.focusOn(token.col, token.row, token.size);
  }

  protected startEdit(token: TableToken): void {
    this.editingId.set(token.id);
    this.locate(token);
  }

  protected tokenMeta(token: TableToken): string {
    if (this.table.isMasked(token)) {
      return 'Identidade oculta';
    }
    const parts = [this.kindLabel[token.kind]];
    if (token.sex) {
      parts.push(this.sexLabel[token.sex]);
    }
    parts.push(this.ownerName(token));
    return parts.join(' · ');
  }

  protected toggleHidden(token: TableToken): void {
    const sheetId = this.sheetOf(token);
    if (sheetId) {
      void this.table.updateSheet(sheetId, { hidden: !token.hidden });
      return;
    }
    void this.table.updateToken(token.id, { hidden: !token.hidden });
  }

  protected requestDelete(token: TableToken): void {
    clearTimeout(this.confirmTimer);
    if (this.confirmingDeleteId() !== token.id) {
      this.confirmingDeleteId.set(token.id);
      this.confirmTimer = setTimeout(() => this.confirmingDeleteId.set(null), DELETE_CONFIRM_MS);
      return;
    }
    this.confirmingDeleteId.set(null);
    void this.table.deleteToken(token.id);
  }

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { label, kind, size, hidden } = this.form.getRawValue();
    const cell = findFreeCell(this.table.tokens(), this.store.viewCenter(), size);
    this.saving.set(true);
    const saved = await this.table.createToken(
      { label, kind, size, hidden, icon: null, sex: null, nameHidden: false, ownerId: null },
      cell.col,
      cell.row,
    );
    this.saving.set(false);
    if (!saved) {
      return;
    }
    this.store.selectToken(saved.id);
    this.submitted.set(false);
    this.form.reset({ label: '', kind, size, hidden });
  }
}
