import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NgIf,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './navbar.html',
  styles: [`
    .logo {
      font-size: 1.3rem;
      font-weight: 700;
      text-decoration: none;
      color: white;
      margin-right: 1rem;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .nav-link {
      margin: 0 4px;
      color: white !important;
    }
    .nav-link.active-link {
      background: rgba(255,255,255,0.2);
      border-radius: 4px;
    }
    .user-name {
      margin-right: 8px;
      font-size: 0.9rem;
    }
  `],
})
export class Navbar {
  readonly auth = inject(AuthService);

  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  readonly role = computed(() => this.auth.role());
  readonly userName = computed(() => this.auth.userName());

  readonly showCliente = computed(() => {
    const r = this.role();
    return r === 'CLIENTE';
  });

  readonly showMozoAdmin = computed(() => {
    const r = this.role();
    return r === 'MOZO' || r === 'ADMIN';
  });

  readonly showCocinaAdmin = computed(() => {
    const r = this.role();
    return r === 'COCINA' || r === 'ADMIN';
  });

  readonly showAdmin = computed(() => this.role() === 'ADMIN');

  logout(): void {
    this.auth.logout();
  }
}
