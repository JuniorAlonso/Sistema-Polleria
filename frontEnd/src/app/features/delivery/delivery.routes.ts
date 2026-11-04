import { Routes } from '@angular/router';

export const DELIVERY_ROUTES: Routes = [
  {
    path: '',
    title: 'Hoja de Ruta & Reparto - San Pollo Delivery',
    loadComponent: () => import('./repartidor-delivery.component').then(m => m.RepartidorDeliveryComponent)
  }
];
