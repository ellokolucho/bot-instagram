// Importar las librerías necesarias
const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

// Crear la aplicación Express
const app = express();
app.use(express.json());

// Obtener las "llaves" y el puerto desde las variables de entorno
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ID = process.env.PAGE_ID; // <--- NUEVA LÍNEA
const PORT = process.env.PORT || 3000;

// Endpoint para la verificación del Webhook
app.get('/webhook', (req, res) => {
    // ... (esta función no cambia)
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else { res.sendStatus(403); }
    }
});

// Endpoint para recibir los mensajes de Instagram
app.post('/webhook', (req, res) => {
    // ... (esta función no cambia)
    const body = req.body;
    if (body.object === 'instagram') {
        body.entry.forEach(entry => {
            if (entry.messaging) {
                entry.messaging.forEach(event => {
                    if (event.message && event.message.text) {
                        const senderId = event.sender.id;
                        const messageText = event.message.text;
                        if (messageText.toLowerCase() === 'hola') {
                            const responseText = 'Hola, ¿cómo estás? Estoy para ayudarte';
                            sendMessage(senderId, responseText);
                        }
                    }
                });
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else { res.sendStatus(404); }
});

// Función para enviar un mensaje de texto de vuelta al usuario
async function sendMessage(recipientId, text) {
    const messageData = {
        recipient: { id: recipientId },
        message: { text: text },
        messaging_type: 'RESPONSE',
    };

    // --- INICIO DE LA CORRECCIÓN ---
    // Reemplazamos 'me' con el ID de la página y usamos la API v19.0
    const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/messages?access_token=${ACCESS_TOKEN}`;
    // --- FIN DE LA CORRECCIÓN ---

    try {
        await axios.post(url, messageData);
        console.log('Message sent successfully!');
    } catch (error) {
        console.error('Error sending message:', error.response ? error.response.data : error.message);
    }
}

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});