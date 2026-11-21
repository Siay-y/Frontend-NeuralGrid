import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TableState } from '../realtime/table-state';
import {
  DEBUFF_KINDS,
  type DebuffKind,
  STATUS_LIMITS,
  type StatusKind,
  type TableStatus,
} from '../realtime/table.protocol';
import { AMOUNT_LABEL, STATUS_INFO } from './status-catalog';
import { StatusIcon } from './status-icon';

const AMOUNT_PLACEHOLDER = { damage: '1d6', heal: '1d4', value: '2' } as const;

export function parseTurns(raw: string): number | null | undefined {
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  const value = Number(text);
  return Number.isInteger(value) && value >= 1 && value <= STATUS_LIMITS.turns ? value : undefined;
}

@Component({
  selector: 'app-status-form',
  imports: [StatusIcon],
  templateUrl: './status-form.html',
  styleUrl: './status-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusForm {
  private readonly table = inject(TableState);

  readonly tokenId = input.required<string>();
  readonly kind = input.required<StatusKind>();
  readonly current = input<TableStatus | undefined>();
  readonly done = output();

  protected readonly maxTurns = STATUS_LIMITS.turns;
  protected readonly maxAmount = STATUS_LIMITS.amount;
  protected readonly immunities = DEBUFF_KINDS.map((kind) => ({
    kind,
    label: STATUS_INFO[kind].label,
  }));
  protected readonly info = computed(() => STATUS_INFO[this.kind()]);
  protected readonly amountLabel = computed(() => {
    const amount = this.info().amount;
    return amount ? AMOUNT_LABEL[amount] : '';
  });
  protected readonly amountPlaceholder = computed(() => {
    const amount = this.info().amount;
    return amount ? AMOUNT_PLACEHOLDER[amount] : '';
  });

  protected readonly turns = linkedSignal({
    source: this.kind,
    computation: () => untracked(this.current)?.turns?.toString() ?? '',
  });
  protected readonly amount = linkedSignal({
    source: this.kind,
    computation: () => untracked(this.current)?.amount ?? '',
  });
  protected readonly immuneTo = linkedSignal<StatusKind, ReadonlySet<DebuffKind>>({
    source: this.kind,
    computation: () => new Set(untracked(this.current)?.immuneTo ?? []),
  });
  protected readonly error = linkedSignal<StatusKind, string | null>({
    source: this.kind,
    computation: () => null,
  });
  protected readonly busy = signal(false);

  protected toggleImmunity(kind: DebuffKind): void {
    this.immuneTo.update((kinds) => {
      const next = new Set(kinds);
      if (!next.delete(kind)) {
        next.add(kind);
      }
      return next;
    });
    this.error.set(null);
  }

  protected async apply(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) {
      return;
    }
    const info = this.info();
    const turns = parseTurns(this.turns());
    if (turns === undefined) {
      this.error.set(`Use de 1 a ${STATUS_LIMITS.turns} turnos, ou deixe vazio`);
      return;
    }
    const immuneTo = DEBUFF_KINDS.filter((kind) => this.immuneTo().has(kind));
    if (info.kind === 'immune' && immuneTo.length === 0) {
      this.error.set('Escolha ao menos um efeito');
      return;
    }
    const status: TableStatus = {
      kind: info.kind,
      turns,
      amount: info.amount ? this.amount().trim() || null : null,
      immuneTo,
    };
    await this.run(() => this.table.applyStatus(this.tokenId(), status));
  }

  protected async remove(): Promise<void> {
    if (!this.busy()) {
      await this.run(() => this.table.removeStatus(this.tokenId(), this.kind()));
    }
  }

  private async run(action: () => Promise<boolean>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const done = await action();
    this.busy.set(false);
    if (done) {
      this.done.emit();
    }
  }
}
