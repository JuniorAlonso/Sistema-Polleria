const FRONTEND = 'https://else-wires-procurement-aqua.trycloudflare.com';

export const environment = {
  production: true,
  authApiUrl: FRONTEND,
  ordersApiUrl: FRONTEND,
  paymentsApiUrl: FRONTEND,
  feedbackApiUrl: FRONTEND,
  financeApiUrl: FRONTEND,
  incidentApiUrl: FRONTEND,
  notificationApiUrl: FRONTEND,
  wsUrl: `wss://else-wires-procurement-aqua.trycloudflare.com/ws-polleria`,
  appBaseUrl: FRONTEND,
  services: {
    auth: `${FRONTEND}/auth`,
    products: `${FRONTEND}/productos`,
    orders: `${FRONTEND}/ordenes`,
    payments: `${FRONTEND}/pagos`,
    feedback: `${FRONTEND}/feedback`,
    finance: `${FRONTEND}/finanzas`,
    incidents: `${FRONTEND}/incidentes`
  },
  mercadoPagoPublicKey: 'APP_USR-1c0df301-ca64-4e8f-824b-ada8da860e0b',
  mercadoPago: {
    publicKey: 'APP_USR-1c0df301-ca64-4e8f-824b-ada8da860e0b'
  }
};
