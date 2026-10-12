export const environment = {
  production: false,
  authApiUrl: 'http://localhost:8081',
  ordersApiUrl: 'http://localhost:8082',
  paymentsApiUrl: 'http://localhost:8083',
  feedbackApiUrl: 'http://localhost:8085',
  inventoryApiUrl: 'http://localhost:8086',
  financeApiUrl: 'http://localhost:8087',
  incidentApiUrl: 'http://localhost:8088',
  notificationApiUrl: 'http://localhost:3001/api/notificaciones',
  wsUrl: 'http://localhost:8082/ws-polleria',
  services: {
    auth: 'http://localhost:8081/auth',
    products: 'http://localhost:8082/productos',
    orders: 'http://localhost:8082/ordenes',
    payments: 'http://localhost:8083/pagos',
    feedback: 'http://localhost:8085',
    inventory: 'http://localhost:8086',
    finance: 'http://localhost:8087',
    incidents: 'http://localhost:8088'
  },
  mercadoPagoPublicKey: 'APP_USR-c425e605-dfe3-4ce3-bf50-aa60558e02b9'
};
