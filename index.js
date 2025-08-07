// Importar las librerías necesarias
const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

// Crear la aplicación Express
const app = express();
// Middleware para parsear el cuerpo de las solicitudes como JSON
app.use(express.json());

// Obtener las "llaves" y el puerto desde las variables de entorno
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000; // Railway asignará el puerto automáticamente

// Endpoint para la verificación del Webhook (Paso inicial de Meta)
app.get('/webhook', (req, res) => {
    /**
     * Meta envía una solicitud GET a esta URL para verificar que es tuya.
     * Debes responder correctamente al "desafío" (challenge).
     */
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Responde con '403 Forbidden' si los tokens de verificación no coinciden
            res.sendStatus(403);
        }
    }
});

// Endpoint para recibir los mensajes de Instagram
app.post('/webhook', (req, res) => {
    /**
     * Aquí es donde Meta envía la información de los mensajes (payloads).
     */
    const body = req.body;

    if (body.object === 'instagram') {
        body.entry.forEach(entry => {
            entry.messaging.forEach(event => {
                if (event.message && event.message.text) {
                    const senderId = event.sender.id;
                    const messageText = event.message.text;

                    // --- TU LÓGICA EMPIEZA AQUÍ ---
                    if (messageText.toLowerCase() === 'hola') {
                        const responseText = 'Hola, ¿cómo estás? Estoy para ayudarte';
                        sendMessage(senderId, responseText);
                    }
                    // --- TU LÓGICA TERMINA AQUÍ ---
                }
            });
        });

        // Responde '200 OK' para notificar a Meta que recibiste el evento
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Responde '404 Not Found' si el evento no es de la API de Instagram
        res.sendStatus(404);
    }
});

// Función para enviar un mensaje de texto de vuelta al usuario
async function sendMessage(recipientId, text) {
    /**
     * Función para enviar un mensaje de texto de vuelta al usuario usando la Graph API.
     */
    const messageData = {
        recipient: { id: recipientId },
        message: { text: text },
        messaging_type: 'RESPONSE',
    };

    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${ACCESS_TOKEN}`;

    try {
        await axios.post(url, messageData);
        console.log('Message sent successfully!');
    } catch (error) {
        console.error('Error sending message:', error.response ? error.response.data : error.message);
    }
}

// Iniciar el servidor para que escuche las solicitudes
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});