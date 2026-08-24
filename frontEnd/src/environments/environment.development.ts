export const environment = {
  production: false,
  authApiUrl: 'http://localhost:8081',
  ordersApiUrl: 'http://localhost:8082',
  paymentsApiUrl: 'http://localhost:8083',
  services: {
    auth: 'http://localhost:8081/auth',
    products: 'http://localhost:8082/productos',
    orders: 'http://localhost:8082/ordenes',
    payments: 'http://localhost:8083/pagos'
  }
};
