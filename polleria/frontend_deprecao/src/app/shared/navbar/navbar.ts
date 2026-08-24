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
    mat-toolbar {
      background-color: #bf360c !important;
      color: white !important;
    }
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
      --mdc-text-button-label-text-color: white;
    }
    .nav-link.active-link {
      background: rgba(255,255,255,0.2) !important;
      border-radius: 4px;
    }
    .user-name {
      margin-right: 8px;
      font-size: 0.9rem;
      color: white;
    }
    button.mat-mdc-button {
      --mdc-text-button-label-text-color: white;
      color: white !important;
    }
    button.mat-mdc-button .mat-icon {
      color: white !important;
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
