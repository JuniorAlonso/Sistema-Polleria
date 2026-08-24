import {
  BackendAuthResponse,
  BackendLoginRequest,
  BackendRegisterRequest,
  BackendRole
} from '../models/api-contracts.model';
import { AuthResponse, LoginRequest, RegisterRequest, User, UserRole } from '../models/user.model';

export class AuthAdapter {
  /**
   * Mapea Rol del backend al rol del frontend (ej: COCINA -> CHEF)
   */
  static toUserRole(backendRole: BackendRole | string): UserRole {
    if (!backendRole) return 'CLIENTE';
    const roleUpper = backendRole.toUpperCase();
    if (roleUpper === 'COCINA' || roleUpper === 'CHEF') return 'CHEF';
    if (roleUpper === 'ADMIN') return 'ADMIN';
    if (roleUpper === 'MOZO') return 'MOZO';
    if (roleUpper === 'REPARTIDOR') return 'REPARTIDOR';
    return 'CLIENTE';
  }

  /**
   * Mapea Rol del frontend al rol del backend (ej: CHEF -> COCINA)
   */
  static toBackendRole(frontendRole: UserRole | string): BackendRole {
    if (!frontendRole) return 'CLIENTE';
    const roleUpper = frontendRole.toUpperCase();
    if (roleUpper === 'CHEF' || roleUpper === 'COCINA') return 'COCINA';
    if (roleUpper === 'ADMIN') return 'ADMIN';
    if (roleUpper === 'MOZO') return 'MOZO';
    if (roleUpper === 'REPARTIDOR') return 'REPARTIDOR';
    return 'CLIENTE';
  }

  /**
   * Transforma la respuesta del Backend Auth a los modelos del Frontend
   */
  static toAuthResponse(dto: BackendAuthResponse): AuthResponse {
    const rol = this.toUserRole(dto.role);
    const user: User = {
      id: dto.email ? `usr-${dto.email.split('@')[0]}` : 'usr-current',
      nombre: dto.name || (dto.email ? dto.email.split('@')[0] : 'Usuario San Pollo'),
      correo: dto.email || '',
      celular: '',
      rol: rol,
      token: dto.token || undefined
    };

    return {
      user,
      token: dto.token || '',
      requires2FA: dto.requiresTwoFactor
    };
  }

  /**
   * Transforma el login del frontend al formato del backend
   */
  static toBackendLogin(req: LoginRequest): BackendLoginRequest {
    return {
      identifier: req.correoOrCelular.trim(),
      password: req.password
    };
  }

  /**
   * Transforma el registro del frontend al formato del backend
   */
  static toBackendRegister(req: RegisterRequest, role: UserRole = 'CLIENTE'): BackendRegisterRequest {
    return {
      name: req.nombre.trim(),
      email: req.correo.trim().toLowerCase(),
      phone: req.celular ? req.celular.trim() : undefined,
      password: req.password,
      role: this.toBackendRole(role)
    };
  }
}
