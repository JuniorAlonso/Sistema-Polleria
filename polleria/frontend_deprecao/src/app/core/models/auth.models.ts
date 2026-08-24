export type Role = 'CLIENTE' | 'MOZO' | 'COCINA' | 'ADMIN' | 'REPARTIDOR';

export interface RegisterRequest {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface TwoFactorRequest {
  email: string;
  code: string;
}

export interface AuthResponse {
  token?: string;
  name?: string;
  email: string;
  role: Role;
  requiresTwoFactor: boolean;
  message: string;
}

export interface UserSession {
  token: string;
  name: string;
  email: string;
  role: Role;
}
