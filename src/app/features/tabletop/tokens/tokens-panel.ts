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
  LucideChevronDown,
  LucideLocateFixed,
  LucideLoaderCircle,
  LucidePlus,
  LucideSquarePen,
  LucideTrash,
} from '@lucide/angular';
import { findFreeCell, tokenInitials } from '../board/token-geometry';
import { TableState } from '../realtime/table-state';
import {
  TOKEN_KIND_LABEL,
  TOKEN_LABEL_MAX_LENGTH,
  TOKEN_SIZES,
  type TableToken,
  type TokenDraft,
  type TokenKind,
} from '../realtime/table.protocol';
import { TabletopStore } from '../tabletop.store';

interface TokenForm {
  label: FormControl<string>;
  kind: FormControl<TokenKind>;
  ownerId: FormControl<string | null>;
  size: FormControl<number>;
}

const DELETE_CONFIRM_MS = 3_000;
const KINDS = Object.keys(TOKEN_KIND_LABEL) as TokenKind[];

@Component({
  selector: 'app-tokens-panel',
  imports: [
    ReactiveFormsModule,
    LucideChevronDown,
    LucideLocateFixed,
    LucideLoaderCircle,
    LucidePlus,
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
  protected readonly kindLabel = TOKEN_KIND_LABEL;
  protected readonly sizes = TOKEN_SIZES;
  protected readonly maxLabel = TOKEN_LABEL_MAX_LENGTH;
  protected readonly initials = tokenInitials;

  protected readonly form: FormGroup<TokenForm> = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(TOKEN_LABEL_MAX_LENGTH)]],
    kind: this.fb.control<TokenKind>('agent'),
    ownerId: this.fb.control<string | null>(null),
    size: this.fb.control(1),
  });

  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly confirmingDeleteId = signal<string | null>(null);

  protected readonly tokens = computed(() =>
    [...this.table.tokens()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
  );

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
    this.submitted.set(false);
    this.form.setValue({
      label: token.label,
      kind: token.kind,
      ownerId: token.ownerId,
      size: token.size,
    });
    this.locate(token);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  protected requestDelete(token: TableToken): void {
    clearTimeout(this.confirmTimer);
    if (this.confirmingDeleteId() !== token.id) {
      this.confirmingDeleteId.set(token.id);
      this.confirmTimer = setTimeout(() => this.confirmingDeleteId.set(null), DELETE_CONFIRM_MS);
      return;
    }
    this.confirmingDeleteId.set(null);
    if (this.editingId() === token.id) {
      this.cancelEdit();
    }
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

    const draft: TokenDraft = this.form.getRawValue();
    const editingId = this.editingId();
    this.saving.set(true);

    const saved = editingId
      ? await this.table.updateToken(editingId, draft)
      : await this.createAtViewCenter(draft);

    this.saving.set(false);
    if (!saved) {
      return;
    }
    this.store.selectToken(saved.id);
    this.editingId.set(null);
    this.resetForm(draft.kind);
  }

  private createAtViewCenter(draft: TokenDraft): Promise<TableToken | null> {
    const cell = findFreeCell(this.table.tokens(), this.store.viewCenter(), draft.size);
    return this.table.createToken(draft, cell.col, cell.row);
  }

  private resetForm(kind: TokenKind = 'agent'): void {
    this.submitted.set(false);
    this.form.reset({ label: '', kind, ownerId: null, size: 1 });
  }
}
