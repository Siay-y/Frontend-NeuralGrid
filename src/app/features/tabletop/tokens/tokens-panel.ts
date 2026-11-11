import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  LucideChevronDown,
  LucideEye,
  LucideEyeOff,
  LucideLocateFixed,
  LucideLoaderCircle,
  LucidePlus,
  LucideSquarePen,
  LucideTrash,
} from '@lucide/angular';
import { findFreeCell } from '../board/token-geometry';
import { TableState } from '../realtime/table-state';
import {
  TOKEN_KIND_LABEL,
  TOKEN_LABEL_MAX_LENGTH,
  TOKEN_SEX_LABEL,
  TOKEN_SIZES,
  type TableToken,
  type TokenDraft,
  type TokenKind,
  type TokenSex,
} from '../realtime/table.protocol';
import { Collapsible } from '../panel/collapsible';
import { TabletopStore } from '../tabletop.store';
import { TokenGlyph } from './token-glyph';
import { TokenIconPicker } from './token-icon-picker';

interface TokenForm {
  label: FormControl<string>;
  kind: FormControl<TokenKind>;
  icon: FormControl<string | null>;
  sex: FormControl<TokenSex | null>;
  hidden: FormControl<boolean>;
  nameHidden: FormControl<boolean>;
  ownerId: FormControl<string | null>;
  size: FormControl<number>;
}

const DELETE_CONFIRM_MS = 3_000;
const KINDS = Object.keys(TOKEN_KIND_LABEL) as TokenKind[];
const SEXES = Object.keys(TOKEN_SEX_LABEL) as TokenSex[];

@Component({
  selector: 'app-tokens-panel',
  imports: [
    ReactiveFormsModule,
    Collapsible,
    TokenGlyph,
    TokenIconPicker,
    LucideChevronDown,
    LucideEye,
    LucideEyeOff,
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
  protected readonly editorSection = 'token-editor';
  protected readonly kindLabel = TOKEN_KIND_LABEL;
  protected readonly sexes = SEXES;
  protected readonly sexLabel = TOKEN_SEX_LABEL;
  protected readonly sizes = TOKEN_SIZES;
  protected readonly maxLabel = TOKEN_LABEL_MAX_LENGTH;

  protected readonly form: FormGroup<TokenForm> = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(TOKEN_LABEL_MAX_LENGTH)]],
    kind: this.fb.control<TokenKind>('agent'),
    icon: this.fb.control<string | null>(null),
    sex: this.fb.control<TokenSex | null>(null),
    hidden: this.fb.control(false),
    nameHidden: this.fb.control(false),
    ownerId: this.fb.control<string | null>(null),
    size: this.fb.control(1),
  });

  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly draftLabel = signal('');
  protected readonly draftKind = signal<TokenKind>('agent');

  protected readonly tokens = computed(() =>
    [...this.table.tokens()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
  );

  constructor() {
    const { label, kind } = this.form.controls;
    label.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.draftLabel.set(value));
    kind.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.draftKind.set(value));
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
    this.store.openSection(this.editorSection);
    this.editingId.set(token.id);
    this.submitted.set(false);
    this.form.setValue({
      label: token.label,
      kind: token.kind,
      icon: token.icon,
      sex: token.sex,
      hidden: token.hidden,
      nameHidden: token.nameHidden,
      ownerId: token.ownerId,
      size: token.size,
    });
    this.locate(token);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  protected pickSex(sex: TokenSex): void {
    const control = this.form.controls.sex;
    control.setValue(control.value === sex ? null : sex);
    control.markAsDirty();
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
    void this.table.updateToken(token.id, { hidden: !token.hidden });
    if (this.editingId() === token.id) {
      this.form.controls.hidden.setValue(!token.hidden);
    }
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
    this.form.reset({
      label: '',
      kind,
      icon: null,
      sex: null,
      hidden: false,
      nameHidden: false,
      ownerId: null,
      size: 1,
    });
  }
}
