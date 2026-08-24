const client = require('./src/whatsapp/client');
const handleMessage = require('./src/whatsapp/handler');

client.on('message', handleMessage);

client.initialize();