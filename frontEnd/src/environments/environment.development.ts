export const environment = {
  production: false,
  apiGatewayUrl: 'http://localhost:8080/api/v1',
  services: {
    auth: 'http://localhost:8081/api/v1/auth',          // ms-autenticacion (RF01 - RF05)
    products: 'http://localhost:8082/api/v1/products',  // ms-carta-productos (RF06 - RF10)
    orders: 'http://localhost:8083/api/v1/orders',      // ms-pedidos (RF13 - RF18)
    payments: 'http://localhost:8084/api/v1/payments',  // ms-pagos (RF19 - RF22)
    tables: 'http://localhost:8085/api/v1/tables',      // ms-mesas (RF11 - RF12)
    notifications: 'http://localhost:8086/api/v1/ws',  // ms-notificaciones (WebSockets & WhatsApp RF30-RF33)
    feedback: 'http://localhost:8087/api/v1/feedback',  // ms-feedback (RF26 - RF29)
    inventory: 'http://localhost:8088/api/v1/inventory' // ms-inventario (RF23 - RF25)
  }
};
