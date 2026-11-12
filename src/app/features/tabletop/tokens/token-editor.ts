import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  LucideArrowLeft,
  LucideChevronDown,
  LucideLoaderCircle,
  LucideScrollText,
} from '@lucide/angular';
import { map } from 'rxjs';
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
import { sheetTokenLabel } from '../sheets/sheet-model';
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
  emitsLight: FormControl<boolean>;
  ownerId: FormControl<string | null>;
  sheetId: FormControl<string | null>;
  size: FormControl<number>;
}

const KINDS = Object.keys(TOKEN_KIND_LABEL) as TokenKind[];
const SEXES = Object.keys(TOKEN_SEX_LABEL) as TokenSex[];

@Component({
  selector: 'app-token-editor',
  imports: [
    ReactiveFormsModule,
    TokenGlyph,
    TokenIconPicker,
    LucideArrowLeft,
    LucideChevronDown,
    LucideLoaderCircle,
    LucideScrollText,
  ],
  templateUrl: './token-editor.html',
  styleUrl: './token-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenEditor implements OnInit {
  protected readonly table = inject(TableState);
  protected readonly store = inject(TabletopStore);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly token = input.required<TableToken>();
  readonly closed = output<void>();

  protected readonly kinds = KINDS;
  protected readonly kindLabel = TOKEN_KIND_LABEL;
  protected readonly sexes = SEXES;
  protected readonly sexLabel = TOKEN_SEX_LABEL;
  protected readonly sizes = TOKEN_SIZES;
  protected readonly maxLabel = TOKEN_LABEL_MAX_LENGTH;
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);

  protected readonly form: FormGroup<TokenForm> = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(TOKEN_LABEL_MAX_LENGTH)]],
    kind: this.fb.control<TokenKind>('agent'),
    icon: this.fb.control<string | null>(null),
    sex: this.fb.control<TokenSex | null>(null),
    hidden: this.fb.control(false),
    nameHidden: this.fb.control(false),
    emitsLight: this.fb.control(true),
    ownerId: this.fb.control<string | null>(null),
    sheetId: this.fb.control<string | null>(null),
    size: this.fb.control(1),
  });

  protected readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );
  protected readonly linkedSheet = computed(() => this.table.sheet(this.value().sheetId));
  protected readonly preview = computed(() => {
    const sheet = this.linkedSheet();
    const value = this.value();
    return sheet
      ? { label: sheetTokenLabel(sheet.data), kind: sheet.kind }
      : { label: value.label.trim(), kind: value.kind };
  });
  protected readonly ownerId = computed(() => {
    const sheet = this.linkedSheet();
    return sheet ? sheet.ownerId : this.value().ownerId;
  });
  protected readonly meta = computed(() => {
    const sheet = this.linkedSheet();
    const kind = sheet?.kind ?? this.value().kind;
    const owner = this.table.member(this.ownerId())?.displayName ?? 'Sem dono';
    return [this.kindLabel[kind], owner, sheet ? 'Com ficha' : 'Sem ficha'].join(' · ');
  });

  ngOnInit(): void {
    const token = this.token();
    this.form.setValue({
      label: token.label,
      kind: token.kind,
      icon: token.icon,
      sex: token.sex,
      hidden: token.hidden,
      nameHidden: token.nameHidden,
      emitsLight: token.emitsLight !== false,
      ownerId: token.ownerId,
      sheetId: this.table.sheet(token.sheetId) ? token.sheetId : null,
      size: token.size,
    });
  }

  protected showLabelError(): boolean {
    const control = this.form.controls.label;
    return !this.linkedSheet() && control.invalid && (control.touched || this.submitted());
  }

  protected pickSex(sex: TokenSex): void {
    const control = this.form.controls.sex;
    control.setValue(control.value === sex ? null : sex);
    control.markAsDirty();
  }

  protected openSheet(id: string): void {
    this.store.openSheet(id);
  }

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.submitted.set(true);
    if (!this.linkedSheet() && this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const draft: TokenDraft = this.form.getRawValue();
    this.saving.set(true);
    const saved = await this.table.updateToken(this.token().id, draft);
    this.saving.set(false);
    if (saved) {
      this.closed.emit();
    }
  }
}
