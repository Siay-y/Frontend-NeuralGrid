import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideEllipsis } from '@lucide/angular';

let nextId = 0;
const GAP_PX = 4;
const EDGE_PX = 8;

@Component({
  selector: 'app-action-menu',
  imports: [LucideEllipsis],
  templateUrl: './action-menu.html',
  styleUrl: './action-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ActionMenu {
  readonly label = input.required<string>();

  protected readonly menuId = `action-menu-${++nextId}`;
  protected readonly open = signal(false);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  private readonly closeOnScroll = () => this.close();

  constructor() {
    inject(DestroyRef).onDestroy(() =>
      window.removeEventListener('scroll', this.closeOnScroll, true),
    );
  }

  close(): void {
    const menu = this.menu().nativeElement;
    if (menu.matches(':popover-open')) {
      menu.hidePopover();
    }
  }

  protected toggled(event: Event): void {
    const opened = (event as ToggleEvent).newState === 'open';
    this.open.set(opened);
    if (!opened) {
      window.removeEventListener('scroll', this.closeOnScroll, true);
      return;
    }
    this.place();
    window.addEventListener('scroll', this.closeOnScroll, { capture: true, passive: true });
    this.items()[0]?.focus();
  }

  protected navigate(event: KeyboardEvent): void {
    const items = this.items();
    if (items.length === 0) {
      return;
    }
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step !== undefined) {
      event.preventDefault();
      items[(current + step + items.length) % items.length].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1].focus();
    } else if (event.key === 'Tab') {
      this.close();
    }
  }

  private items(): HTMLElement[] {
    return [...this.menu().nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  }

  private place(): void {
    const anchor = this.trigger().nativeElement.getBoundingClientRect();
    const menu = this.menu().nativeElement;
    const { height } = menu.getBoundingClientRect();
    const below = anchor.bottom + GAP_PX;
    const top =
      below + height > window.innerHeight - EDGE_PX ? anchor.top - GAP_PX - height : below;
    menu.style.top = `${Math.max(EDGE_PX, top)}px`;
    menu.style.right = `${Math.max(EDGE_PX, window.innerWidth - anchor.right)}px`;
  }
}
