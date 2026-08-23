export type UserRole = 'CLIENTE' | 'ADMIN' | 'CHEF' | 'MOZO' | 'REPARTIDOR';

export interface User {
  id: string;
  nombre: string;
  correo: string;
  celular: string;
  rol: UserRole;
  token?: string;
  createdAt?: string;
}

export interface LoginRequest {
  correoOrCelular: string;
  password: string;
}

export interface RegisterRequest {
  nombre: string;
  correo: string;
  celular: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  requires2FA?: boolean;
}
