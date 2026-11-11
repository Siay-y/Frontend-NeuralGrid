import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TableState } from '../realtime/table-state';
import { TOKEN_KIND_LABEL, TOKEN_SEX_LABEL, type TableToken } from '../realtime/table.protocol';
import { defense, gaugeRatio } from '../sheets/sheet-model';
import { TokenGlyph } from '../tokens/token-glyph';
import { tokenIcon } from '../tokens/token-icons';

const UNKNOWN = '???';

@Component({
  selector: 'app-token-hover-card',
  imports: [TokenGlyph],
  templateUrl: './token-hover-card.html',
  styleUrl: './token-hover-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'tooltip' },
})
export class TokenHoverCard {
  private readonly table = inject(TableState);

  readonly token = input.required<TableToken>();

  protected readonly isMaster = this.table.isMaster;
  protected readonly ratio = gaugeRatio;
  protected readonly sheet = computed(() => this.table.sheet(this.token().sheetId));
  protected readonly vitals = computed(() => {
    const sheet = this.sheet();
    if (sheet) {
      return { hp: sheet.data.status.hp, defense: defense(sheet.data) };
    }
    return this.table.sheetStats(this.token().sheetId) ?? null;
  });
  protected readonly vitalsHidden = computed(
    () => this.vitals() === null && this.token().sheetId !== null,
  );
  protected readonly masked = computed(() => this.table.isMasked(this.token()));
  protected readonly kind = computed(() => {
    const token = this.token();
    if (this.masked()) {
      return 'Identidade oculta';
    }
    const icon = tokenIcon(token.icon);
    return icon ? `${TOKEN_KIND_LABEL[token.kind]} · ${icon.label}` : TOKEN_KIND_LABEL[token.kind];
  });
  protected readonly sex = computed(() => {
    if (this.masked()) {
      return UNKNOWN;
    }
    const { sex } = this.token();
    return sex ? TOKEN_SEX_LABEL[sex] : 'Não informado';
  });
  protected readonly size = computed(() => {
    if (this.masked()) {
      return UNKNOWN;
    }
    const { size } = this.token();
    return size === 1 ? '1 célula' : `${size}×${size} células`;
  });
  protected readonly owner = computed(() =>
    this.masked() ? UNKNOWN : (this.table.member(this.token().ownerId)?.displayName ?? 'Sem dono'),
  );
  protected readonly ownerOnline = computed(() => {
    if (this.masked()) {
      return false;
    }
    const { ownerId } = this.token();
    return ownerId !== null && this.table.onlineIds().has(ownerId);
  });
  protected readonly mine = computed(() => {
    const { ownerId } = this.token();
    return ownerId !== null && ownerId === this.table.me()?.id;
  });
}
