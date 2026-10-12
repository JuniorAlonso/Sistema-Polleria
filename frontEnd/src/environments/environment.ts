export const environment = {
  production: true,
  authApiUrl: '/api',
  ordersApiUrl: '/api',
  paymentsApiUrl: '/api',
  // Todas las bases son '/api': los servicios concatenan despues la ruta del modulo del
  // backend (/feedback, /inventario, /finanzas, /incidentes). Con '/api/inventory' el
  // resultado era '/api/inventory/inventario/...' y ninguna peticion resolvia.
  feedbackApiUrl: '/api',
  inventoryApiUrl: '/api',
  financeApiUrl: '/api',
  incidentApiUrl: '/api',
  notificationApiUrl: '/api/notificaciones',
  wsUrl: '/ws-polleria',
  appBaseUrl: 'https://polleria.app',
  services: {
    auth: '/api/auth',
    products: '/api/productos',
    orders: '/api/ordenes',
    payments: '/api/pagos',
    feedback: '/api/feedback',
    inventory: '/api/inventario',
    finance: '/api/finanzas',
    incidents: '/api/incidentes'
  },
  mercadoPagoPublicKey: 'APP_USR-c425e605-dfe3-4ce3-bf50-aa60558e02b9',
  mercadoPago: {
    publicKey: 'APP_USR-c425e605-dfe3-4ce3-bf50-aa60558e02b9'
    // Sin accessToken: el cobro real se crea en el backend. El navegador nunca lo maneja.
  }
};
