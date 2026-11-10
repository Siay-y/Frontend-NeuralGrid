import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tabletop' },
  {
    path: 'login',
    title: 'Entrar | NeuralGrid',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'tabletop',
    title: 'Mesa | NeuralGrid',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tabletop/tabletop').then((m) => m.TabletopPage),
  },
  { path: '**', redirectTo: 'tabletop' },
];
