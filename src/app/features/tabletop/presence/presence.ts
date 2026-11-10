import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ROLE_LABEL } from '../../../core/auth/auth.models';
import type { ConnectionStatus } from '../realtime/table-connection';
import { TableState } from '../realtime/table-state';

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Conectando',
  online: 'Ao vivo',
  reconnecting: 'Reconectando',
  offline: 'Desconectado',
};

@Component({
  selector: 'app-presence',
  templateUrl: './presence.html',
  styleUrl: './presence.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Presence {
  protected readonly table = inject(TableState);
  protected readonly statusLabel = computed(() => STATUS_LABEL[this.table.status()]);
  protected readonly people = computed(() => {
    const online = this.table.onlineIds();
    return this.table.members().map((member) => ({
      id: member.id,
      initial: member.displayName.trim().charAt(0).toUpperCase() || '?',
      online: online.has(member.id),
      title: `${member.displayName} · ${ROLE_LABEL[member.role]} · ${
        online.has(member.id) ? 'na mesa' : 'ausente'
      }`,
    }));
  });
  protected readonly onlineCount = computed(() => this.people().filter((p) => p.online).length);
}
