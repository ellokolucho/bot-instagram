// Reemplaza tu bloque app.post actual con este
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'instagram') {
        body.entry.forEach(entry => {
            
            // --- INICIO DE LA CORRECCIÓN ---
            // Añadimos esta línea para asegurarnos de que el array 'messaging' existe antes de intentar leerlo
            if (entry.messaging) {
                entry.messaging.forEach(event => {
                    // Verificamos que sea un mensaje de texto
                    if (event.message && event.message.text) {
                        const senderId = event.sender.id;
                        const messageText = event.message.text;

                        // Tu lógica original
                        if (messageText.toLowerCase() === 'hola') {
                            const responseText = 'Hola, ¿cómo estás? Estoy para ayudarte';
                            sendMessage(senderId, responseText);
                        }
                    }
                });
            }
            // --- FIN DE LA CORRECCIÓN ---

        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});