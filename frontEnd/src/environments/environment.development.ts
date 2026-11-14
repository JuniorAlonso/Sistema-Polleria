export const environment = {
  production: false,
  authApiUrl: 'http://localhost:8081',
  ordersApiUrl: 'http://localhost:8082',
  paymentsApiUrl: 'http://localhost:8083',
  feedbackApiUrl: 'http://localhost:8085',
  financeApiUrl: 'http://localhost:8087',
  incidentApiUrl: 'http://localhost:8088',
  notificationApiUrl: 'http://localhost:3001/api/notificaciones',
  wsUrl: 'http://localhost:8082/ws-polleria',
  appBaseUrl: 'http://localhost:4200',
  services: {
    auth: 'http://localhost:8081/auth',
    products: 'http://localhost:8082/productos',
    orders: 'http://localhost:8082/ordenes',
    payments: 'http://localhost:8083/pagos',
    feedback: 'http://localhost:8085',
    finance: 'http://localhost:8087',
    incidents: 'http://localhost:8088'
  },
  mercadoPagoPublicKey: 'APP_USR-1e2c7aa8-8e71-477a-b639-fcfa499a7897',
  mercadoPago: {
    publicKey: 'APP_USR-1e2c7aa8-8e71-477a-b639-fcfa499a7897'
    // Sin accessToken: el cobro real se crea en el backend. El navegador nunca lo maneja.
  }
};
