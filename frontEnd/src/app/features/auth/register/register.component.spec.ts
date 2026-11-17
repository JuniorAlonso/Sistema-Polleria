import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let auth: { isLoading: () => boolean; register: jasmine.Spy };
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    auth = {
      isLoading: () => false,
      register: jasmine.createSpy('register').and.returnValue(of({ token: 'jwt' }))
    };
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['showError', 'showSuccess']);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notify }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('strips non-numeric characters, optional +51 prefix, and limits phone to 9 digits', () => {
    const input = document.createElement('input');
    input.value = '+51 987-654-321';

    component.onCelularInput({ target: input } as unknown as Event);

    expect(component.celular).toBe('987654321');
    expect(input.value).toBe('987654321');

    input.value = '98abc7654321999';
    component.onCelularInput({ target: input } as unknown as Event);

    expect(component.celular).toBe('987654321');
    expect(input.value).toBe('987654321');
  });

  it('rejects phone numbers shorter than 9 digits or not starting with 9', () => {
    component.nombre = 'Ana Perez';
    component.correo = 'ana@example.com';
    component.password = 'Clave123';

    component.celular = '98765432';
    component.handleRegister();
    expect(notify.showError).toHaveBeenCalledWith(
      'Número de celular inválido',
      'Debe tener 9 dígitos numéricos y empezar con 9 (ej. 987654321).'
    );
    expect(auth.register).not.toHaveBeenCalled();

    notify.showError.calls.reset();
    component.celular = '887654321';
    component.handleRegister();
    expect(notify.showError).toHaveBeenCalledWith(
      'Número de celular inválido',
      'Debe tener 9 dígitos numéricos y empezar con 9 (ej. 987654321).'
    );
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only name and invalid email format', () => {
    component.nombre = '   ';
    component.celular = '987654321';
    component.correo = 'ana@example.com';
    component.password = 'Clave123';
    component.handleRegister();
    expect(notify.showError).toHaveBeenCalledWith('Por favor completa todos los campos para tu registro');
    expect(auth.register).not.toHaveBeenCalled();

    notify.showError.calls.reset();
    component.nombre = 'Ana Perez';
    component.correo = 'correo-invalido';
    component.handleRegister();
    expect(notify.showError).toHaveBeenCalledWith(
      'Correo electrónico inválido',
      'Ingresa un correo con formato válido (ej. tu@email.com).'
    );
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('submits trimmed and normalized payload when all fields are valid', () => {
    component.nombre = '  Ana Perez  ';
    component.celular = '987654321';
    component.correo = '  ana@example.com  ';
    component.password = 'Clave123';

    component.handleRegister();

    expect(auth.register).toHaveBeenCalledWith({
      nombre: 'Ana Perez',
      celular: '987654321',
      correo: 'ana@example.com',
      password: 'Clave123'
    });
    expect(notify.showSuccess).toHaveBeenCalled();
  });
});
