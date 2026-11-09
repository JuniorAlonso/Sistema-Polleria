import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

/** S1: a guest sent to log in from the checkout goes back to the checkout, cart intact. */
describe('LoginComponent — returnUrl', () => {
  let navigate: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;

  function montar(returnUrl: string | null, rol: string) {
    const auth = {
      login: jasmine.createSpy('login').and.returnValue(of({ user: { nombre: 'Ana', rol } })),
      isLoading: () => false
    };
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError', 'showInfo']) },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } }
        }
      ]
    });
    const router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigate').and.resolveTo(true);
    navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const componente = TestBed.createComponent(LoginComponent).componentInstance;
    componente.correo = 'ana@prueba.local';
    componente.password = 'Secreta123!';
    return componente;
  }

  it('a customer coming from the checkout returns to it', () => {
    montar('/checkout', 'CLIENTE').handleLogin();

    expect(navigateByUrl).toHaveBeenCalledWith('/checkout');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('an external returnUrl is ignored: the customer goes to the menu', () => {
    montar('//evil.com', 'CLIENTE').handleLogin();

    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/menu']);
  });

  it('preserves: staff still land on their panel', () => {
    montar('/checkout', 'ADMIN').handleLogin();

    expect(navigate).toHaveBeenCalledWith(['/admin']);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('preserves: without returnUrl a customer goes to the menu', () => {
    montar(null, 'CLIENTE').handleLogin();

    expect(navigate).toHaveBeenCalledWith(['/menu']);
  });
});
