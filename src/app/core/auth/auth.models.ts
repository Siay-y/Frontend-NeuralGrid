export type UserRole = 'master' | 'player';

export const ROLE_LABEL: Record<UserRole, string> = {
  master: 'Mestre',
  player: 'Jogador',
};

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SessionUser;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number;
  user: SessionUser;
}

export type SignOutReason = 'manual' | 'expired';
