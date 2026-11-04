import { Routes } from '@angular/router';

export const KITCHEN_ROUTES: Routes = [
  {
    path: '',
    title: 'KDS Cocina & Horno - San Pollo de Ica',
    loadComponent: () => import('./kitchen-kds.component').then(m => m.KitchenKdsComponent)
  }
];
