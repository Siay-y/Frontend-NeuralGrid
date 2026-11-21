import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideX } from '@lucide/angular';
import { TableState } from '../realtime/table-state';
import type { StatusKind, TableStatus } from '../realtime/table.protocol';
import { TabletopStore } from '../tabletop.store';
import { TokenGlyph } from '../tokens/token-glyph';
import {
  STATUS_GROUPS,
  STATUS_INFO,
  type StatusGroup,
  type StatusGroupInfo,
  turnsLabel,
} from './status-catalog';
import { StatusForm } from './status-form';
import { StatusIcon } from './status-icon';

export interface StatusAnchor {
  left: number;
  right: number;
  top: number;
}

type MenuView =
  | { step: 'home' }
  | { step: 'list'; group: StatusGroup }
  | { step: 'form'; kind: StatusKind; back: MenuView };

const HOME: MenuView = { step: 'home' };
const EDGE_PX = 8;
const GAP_PX = 10;

@Component({
  selector: 'app-status-menu',
  imports: [LucideChevronLeft, LucideChevronRight, LucideX, StatusForm, StatusIcon, TokenGlyph],
  templateUrl: './status-menu.html',
  styleUrl: './status-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'onOutside($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class StatusMenu {
  private readonly table = inject(TableState);
  private readonly store = inject(TabletopStore);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly anchor = input<StatusAnchor | null>(null);

  protected readonly groups = STATUS_GROUPS;
  protected readonly info = STATUS_INFO;
  protected readonly turnsLabel = turnsLabel;
  protected readonly view = signal<MenuView>(HOME);
  protected readonly confirmingKill = signal(false);
  protected readonly token = computed(() => {
    const request = this.store.statusMenu();
    return request ? this.table.token(request.tokenId) : undefined;
  });
  protected readonly statuses = computed(() => {
    const token = this.token();
    return token ? this.table.statusesOf(token.id) : [];
  });
  protected readonly active = computed(
    () => new Map(this.statuses().map((status) => [status.kind, status])),
  );
  protected readonly group = computed(() => {
    const view = this.view();
    return view.step === 'list' ? STATUS_GROUPS.find(({ id }) => id === view.group) : undefined;
  });
  protected readonly title = computed(() => {
    const view = this.view();
    if (view.step === 'list') {
      return this.group()?.title ?? '';
    }
    return view.step === 'form' ? STATUS_INFO[view.kind].label : (this.token()?.label ?? '');
  });
  private readonly open = computed(() => !!this.token() && !!this.anchor());
  private readonly tokenId = computed(() => this.store.statusMenu()?.tokenId);

  constructor() {
    effect(() => {
      this.tokenId();
      untracked(() => {
        this.view.set(HOME);
        this.confirmingKill.set(false);
      });
    });
    effect(() => {
      const open = this.open();
      untracked(() => this.toggle(open));
    });
    afterRenderEffect(() => {
      const anchor = this.anchor();
      this.view();
      this.statuses();
      if (anchor && this.open()) {
        this.place(anchor);
      }
    });
  }

  protected countIn(group: StatusGroupInfo): number {
    return this.statuses().filter(({ kind }) => STATUS_INFO[kind].group === group.id).length;
  }

  protected detail(status: TableStatus | undefined): string {
    return status ? turnsLabel(status.turns) : '';
  }

  protected revive(tokenId: string): void {
    void this.table.removeStatus(tokenId, 'death');
  }

  protected kill(tokenId: string): void {
    if (!this.confirmingKill()) {
      this.confirmingKill.set(true);
      return;
    }
    this.confirmingKill.set(false);
    void this.table.applyStatus(tokenId, {
      kind: 'death',
      turns: null,
      amount: null,
      immuneTo: [],
    });
  }

  protected openGroup(group: StatusGroupInfo): void {
    this.view.set({ step: 'list', group: group.id });
  }

  protected edit(kind: StatusKind): void {
    this.view.set({ step: 'form', kind, back: this.view() });
  }

  protected back(): void {
    const view = this.view();
    this.view.set(view.step === 'form' ? view.back : HOME);
  }

  protected formKind(): StatusKind | null {
    const view = this.view();
    return view.step === 'form' ? view.kind : null;
  }

  protected close(): void {
    if (this.store.statusMenu()) {
      this.store.closeStatusMenu();
    }
  }

  protected onOutside(event: PointerEvent): void {
    if (!this.open() || !(event.target instanceof Node)) {
      return;
    }
    if (this.panel().nativeElement.contains(event.target)) {
      return;
    }
    const onBoard = event.target instanceof HTMLCanvasElement;
    const panning = event.button !== 0 || this.store.activeTool() === 'pan';
    if (!(onBoard && panning)) {
      this.close();
    }
  }

  private toggle(open: boolean): void {
    const panel = this.panel().nativeElement;
    const shown = panel.matches(':popover-open');
    if (open && !shown) {
      panel.showPopover();
    } else if (!open && shown) {
      panel.hidePopover();
    }
  }

  private place(anchor: StatusAnchor): void {
    const panel = this.panel().nativeElement;
    const { width, height } = panel.getBoundingClientRect();
    const right = anchor.right + GAP_PX;
    const left =
      right + width <= window.innerWidth - EDGE_PX ? right : anchor.left - GAP_PX - width;
    const top = Math.min(anchor.top, window.innerHeight - height - EDGE_PX);
    panel.style.left = `${Math.max(EDGE_PX, left)}px`;
    panel.style.top = `${Math.max(EDGE_PX, top)}px`;
  }
}
