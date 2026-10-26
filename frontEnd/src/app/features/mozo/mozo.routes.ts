import { Routes } from '@angular/router';

export const MOZO_ROUTES: Routes = [
  {
    path: '',
    title: 'Gestión de Salón & Mesas - San Pollo Mozo',
    loadComponent: () => import('./mozo-salon.component').then(m => m.MozoSalonComponent)
  }
];
