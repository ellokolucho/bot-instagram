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
const PORT = process.env.PORT || 3000;

// Endpoint para la verificación del Webhook (Paso inicial de Meta)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Endpoint para recibir los mensajes de Instagram
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'instagram') {
        body.entry.forEach(entry => {
            // VERIFICACIÓN DE SEGURIDAD AÑADIDA
            if (entry.messaging) {
                entry.messaging.forEach(event => {
                    // Verificamos que sea un mensaje de texto
                    if (event.message && event.message.text) {
                        const senderId = event.sender.id;
                        const messageText = event.message.text;
                        
                        // Tu lógica para responder
                        if (messageText.toLowerCase() === 'hola') {
                            const responseText = 'Hola, ¿cómo estás? Estoy para ayudarte';
                            sendMessage(senderId, responseText);
                        }
                    }
                });
            }
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
    const messageData = {
        recipient: { id: recipientId },
        message: { text: text },
        messaging_type: 'RESPONSE',
    };

    const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${ACCESS_TOKEN}`;

    try {
        await axios.post(url, messageData);
        console.log('Message sent successfully!');
    } catch (error) {
        // Imprime el error completo si la API de Meta falla al enviar el mensaje
        console.error('Error sending message:', error.response ? error.response.data : error.message);
    }
}

// Iniciar el servidor para que escuche las solicitudes
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});