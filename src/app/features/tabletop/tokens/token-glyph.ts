import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { tokenInitials } from '../board/token-geometry';
import type { TokenKind } from '../realtime/table.protocol';
import { tokenIcon, TOKEN_ICON_VIEWBOX } from './token-icons';

@Component({
  selector: 'app-token-glyph',
  templateUrl: './token-glyph.html',
  styleUrl: './token-glyph.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-kind]': "masked() ? 'unknown' : kind()",
    '[class.is-hidden]': 'hidden()',
    'aria-hidden': 'true',
  },
})
export class TokenGlyph {
  readonly kind = input<TokenKind>('npc');
  readonly label = input('');
  readonly icon = input<string | null>(null);
  readonly hidden = input(false);
  readonly masked = input(false);

  protected readonly viewBox = `0 0 ${TOKEN_ICON_VIEWBOX} ${TOKEN_ICON_VIEWBOX}`;
  protected readonly paths = computed(() =>
    this.masked() ? null : (tokenIcon(this.icon())?.paths ?? null),
  );
  protected readonly initials = computed(() => (this.masked() ? '?' : tokenInitials(this.label())));
}
