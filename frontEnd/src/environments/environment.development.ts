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
  },
  mercadoPagoPublicKey: 'APP_USR-c425e605-dfe3-4ce3-bf50-aa60558e02b9'
};
