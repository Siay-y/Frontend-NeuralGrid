import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideArrowRight,
  LucideArrowUpRight,
  LucideCircleAlert,
  LucideEye,
  LucideEyeOff,
  LucideKeyRound,
  LucideLoaderCircle,
  LucideLock,
  LucideUser,
} from '@lucide/angular';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { AUTHOR } from '../../../core/release/credits';
import { APP_VERSION } from '../../../core/release/release-notes';
import { BrandMark } from '../../../shared/ui/brand-mark/brand-mark';
import { ThemeToggle } from '../../../shared/ui/theme-toggle/theme-toggle';
import { describeLoginError } from './login-error';

interface LoginForm {
  username: FormControl<string>;
  password: FormControl<string>;
}

type LoginField = keyof LoginForm;

const SLOW_SERVER_THRESHOLD_MS = 4_000;

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    BrandMark,
    ThemeToggle,
    LucideArrowRight,
    LucideArrowUpRight,
    LucideCircleAlert,
    LucideEye,
    LucideEyeOff,
    LucideKeyRound,
    LucideLoaderCircle,
    LucideLock,
    LucideUser,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordInput =
    viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  protected readonly form: FormGroup<LoginForm> = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required, Validators.maxLength(32)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected readonly version = APP_VERSION;
  protected readonly versionTag = `NG/${APP_VERSION.split('.').slice(0, 2).join('.')}`;
  protected readonly author = AUTHOR;
  protected readonly year = new Date().getFullYear();

  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly slowServer = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly sessionExpired = computed(
    () => this.auth.signOutReason() === 'expired' && !this.error(),
  );

  constructor() {
    inject(HttpClient)
      .get(`${environment.apiUrl}/health/db`)
      .subscribe({ error: () => undefined });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.error.set(null));
  }

  protected showError(field: LoginField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.loading()) {
      return;
    }

    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const credentials = this.form.getRawValue();
    const slowTimer = setTimeout(() => this.slowServer.set(true), SLOW_SERVER_THRESHOLD_MS);
    this.loading.set(true);
    this.error.set(null);
    this.form.disable({ emitEvent: false });

    this.auth
      .login(credentials)
      .pipe(
        finalize(() => {
          clearTimeout(slowTimer);
          this.loading.set(false);
          this.slowServer.set(false);
          this.form.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/tabletop'),
        error: (error: unknown) => {
          this.submitted.set(false);
          this.form.controls.password.reset('', { emitEvent: false });
          this.error.set(describeLoginError(error));
          queueMicrotask(() => this.passwordInput().nativeElement.focus());
        },
      });
  }
}
