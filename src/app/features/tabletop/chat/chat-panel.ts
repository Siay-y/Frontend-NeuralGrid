import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  LucideEraser,
  LucideLoaderCircle,
  LucideSendHorizontal,
  LucideTrash2,
} from '@lucide/angular';
import { parseChatInput } from '../dice/dice-rules';
import { TableState } from '../realtime/table-state';
import { MESSAGE_TEXT_MAX_LENGTH } from '../realtime/table.protocol';
import { TabletopStore } from '../tabletop.store';
import { toAudience } from './audience';
import { AudienceSelect } from './audience-select';
import { MessageLog } from './message-log';

const CONFIRM_WINDOW_MS = 3_000;

interface ComposerForm {
  text: FormControl<string>;
}

@Component({
  selector: 'app-chat-panel',
  imports: [
    ReactiveFormsModule,
    AudienceSelect,
    MessageLog,
    LucideEraser,
    LucideLoaderCircle,
    LucideSendHorizontal,
    LucideTrash2,
  ],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanel {
  protected readonly table = inject(TableState);
  private readonly store = inject(TabletopStore);

  protected readonly maxLength = MESSAGE_TEXT_MAX_LENGTH;
  protected readonly pending = signal(0);
  protected readonly confirmingClear = signal(false);
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly form: FormGroup<ComposerForm> = inject(NonNullableFormBuilder).group({
    text: ['', [Validators.required, Validators.maxLength(MESSAGE_TEXT_MAX_LENGTH)]],
  });

  constructor() {
    this.table.markChatRead();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  protected clearForMe(): void {
    this.table.clearChatForMe();
  }

  protected async clearForEveryone(): Promise<void> {
    if (!this.confirmingClear()) {
      this.confirmingClear.set(true);
      this.confirmTimer = setTimeout(() => this.confirmingClear.set(false), CONFIRM_WINDOW_MS);
      return;
    }
    clearTimeout(this.confirmTimer);
    this.confirmingClear.set(false);
    await this.table.clearChatForEveryone();
  }

  protected onEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey || (event as KeyboardEvent).isComposing) {
      return;
    }
    event.preventDefault();
    void this.submit();
  }

  protected async submit(): Promise<void> {
    const raw = this.form.controls.text.value;
    const command = parseChatInput(raw);
    if (!command) {
      return;
    }
    if (command.kind === 'roll' && command.expression === '') {
      this.store.notify('Use /r seguido dos dados, como /r 1d20+5 Luta.');
      return;
    }

    const audience = toAudience(this.store.chatAudience());
    this.form.reset();
    this.pending.update((count) => count + 1);
    const done =
      command.kind === 'roll'
        ? (await this.table.rollDice(command.expression, command.label, audience)) !== null
        : await this.table.sendMessage(command.text, audience);
    this.pending.update((count) => count - 1);

    if (!done && this.form.controls.text.value === '') {
      this.form.controls.text.setValue(raw);
    }
  }
}
