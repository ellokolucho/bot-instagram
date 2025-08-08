// =================================================================
// === ARCHIVO COMPLETO Y FINAL: index.js para Instagram ===
// =================================================================

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
app.use(bodyParser.json());

// 🌐 --- TOKENS Y CLAVES ---
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🔹 --- INICIALIZACIÓN DE OPENAI ---
const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// 📥 --- LECTURA DE DATOS ---
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const promoData = JSON.parse(fs.readFileSync('./promoData.json', 'utf8'));
const systemPrompt = fs.readFileSync('./SystemPrompt.txt', 'utf8');

// 🗂 --- VARIABLES DE CONTROL DE ESTADO ---
let estadoUsuario = {};
let memoriaConversacion = {};
let primerMensaje = {};
let timersInactividad = {};
let contadorMensajesAsesor = {};

// 🌐 --- CONFIGURACIÓN DEL WEBHOOK (VERIFICACIÓN) ---
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ Webhook verificado correctamente para Instagram');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 📩 --- MANEJO DE MENSAJES ENTRANTES (ADAPTADO PARA INSTAGRAM) ---
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'instagram') {
        body.entry.forEach(entry => {
            if (entry.messaging) {
                entry.messaging.forEach(async (event) => {
                    const senderId = event.sender.id;

                    if (event.message && event.message.is_echo) {
                        return;
                    }

                    if (event.message && event.message.quick_reply) {
                        await manejarQuickReply(senderId, event.message.quick_reply.payload);
                    } else if (event.message && event.message.text) {
                        await manejarMensajeDeTexto(senderId, event.message.text);
                    } else if (event.postback) {
                        await manejarPostback(senderId, event.postback.payload);
                    }
                });
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// --- MANEJO DE TIPOS DE EVENTOS ---
async function manejarQuickReply(senderId, payload) {
    if (payload.startsWith('COMPRAR_')) {
        await enviarPreguntaUbicacion(senderId);
        return;
    }
    if (payload === 'UBICACION_LIMA') {
        estadoUsuario[senderId] = 'ESPERANDO_DATOS_LIMA';
        await enviarMensajeTexto(senderId, "😊 Claro que sí. Por favor, para enviar su pedido indíquenos los siguientes datos:\n\n" + "✅ Nombre completo ✍️\n" + "✅ Número de WhatsApp 📱\n" + "✅ Dirección exacta 📍\n" + "✅ Una referencia de cómo llegar a su domicilio 🏠");
        return;
    }
    if (payload === 'UBICACION_PROVINCIA') {
        estadoUsuario[senderId] = 'ESPERANDO_DATOS_PROVINCIA';
        await enviarMensajeTexto(senderId, "😊 Claro que sí. Por favor, permítanos los siguientes datos para programar su pedido:\n\n" + "✅ Nombre completo ✍️\n" + "✅ DNI 🪪\n" + "✅ Número de WhatsApp 📱\n" + "✅ Agencia Shalom que le queda más cerca 🚚");
        return;
    }
}

async function manejarMensajeDeTexto(senderId, mensajeTexto) {
    reiniciarTimerInactividad(senderId);
    const mensaje = mensajeTexto.trim().toLowerCase();

    if (estadoUsuario[senderId] === 'ASESOR') {
        if (mensaje === 'salir') {
            delete estadoUsuario[senderId];
            delete memoriaConversacion[senderId];
            delete contadorMensajesAsesor[senderId];
            await enviarMensajeTexto(senderId, "🚪 Has salido del chat con asesor. Volviendo al menú principal...");
            await enviarMenuPrincipal(senderId);
            return;
        }
        await enviarConsultaChatGPT(senderId, mensaje);
        return;
    }
    
    if (/^(gracias|muchas gracias|mil gracias|gracias!|gracias :\))$/i.test(mensaje)) {
        await enviarMensajeTexto(senderId, "😄 ¡Gracias a usted! Estamos para servirle.");
        return;
    }

    if (estadoUsuario[senderId] === 'ESPERANDO_DATOS_LIMA' || estadoUsuario[senderId] === 'ESPERANDO_DATOS_PROVINCIA') {
        await manejarFlujoCompra(senderId, mensajeTexto); // Enviamos el texto original para validaciones
        return;
    }
    
    if (mensaje.includes('me interesa este reloj exclusivo')) {
        await enviarInfoPromo(senderId, promoData.reloj1);
        return;
    }
    if (mensaje.includes('me interesa este reloj de lujo')) {
        await enviarInfoPromo(senderId, promoData.reloj2);
        return;
    }
    if (mensaje.includes('ver otros modelos') || mensaje.includes('hola')) {
        await enviarMenuPrincipal(senderId);
        return;
    }

    if (primerMensaje[senderId]) {
        await enviarConsultaChatGPT(senderId, mensaje);
    } else {
        primerMensaje[senderId] = true;
        await enviarMenuPrincipal(senderId); // Enviamos el menú en la primera interacción si no entendemos
    }
}

async function manejarPostback(senderId, payload) {
    switch (payload) {
        case "CABALLEROS":
        case "DAMAS":
            await enviarSubmenuTipoReloj(senderId, payload);
            break;
        case "ASESOR":
            estadoUsuario[senderId] = 'ASESOR';
            memoriaConversacion[senderId] = [];
            contadorMensajesAsesor[senderId] = 0;
            await enviarMensajeConBotonSalir(senderId, "😊 ¡Claro que sí! Estamos listos para responder todas sus dudas y consultas. Por favor, escríbenos qué te gustaría saber ✍️");
            break;
        case "CABALLEROS_AUTO":
            await enviarCatalogo(senderId, "caballeros_automaticos");
            break;
        case "CABALLEROS_CUARZO":
            await enviarCatalogo(senderId, "caballeros_cuarzo");
            break;
        case "DAMAS_AUTO":
            await enviarCatalogo(senderId, "damas_automaticos");
            break;
        case "DAMAS_CUARZO":
            await enviarCatalogo(senderId, "damas_cuarzo");
            break;
        case "VER_MODELOS":
            await enviarMenuPrincipal(senderId);
            break;
        case "SALIR_ASESOR":
            delete estadoUsuario[senderId];
            delete memoriaConversacion[senderId];
            delete contadorMensajesAsesor[senderId];
            await enviarMensajeTexto(senderId, "🚪 Has salido del chat con asesor.");
            await enviarMenuPrincipal(senderId);
            break;
        default:
            if (payload.startsWith("COMPRAR_")) {
                await enviarPreguntaUbicacion(senderId);
            } else {
                await enviarMensajeTexto(senderId, "❓ No entendí su selección, por favor intente de nuevo.");
            }
    }
}


// --- LÓGICA DE CHATGPT ---
async function enviarConsultaChatGPT(senderId, mensajeCliente) {
    try {
        if (!memoriaConversacion[senderId]) memoriaConversacion[senderId] = [];
        memoriaConversacion[senderId].push({ role: "user", content: mensajeCliente });

        if (!contadorMensajesAsesor[senderId]) contadorMensajesAsesor[senderId] = 0;
        contadorMensajesAsesor[senderId]++;

        const contexto = [{ role: "system", content: `${systemPrompt}\n\nAquí tienes los datos del catálogo: ${JSON.stringify(data, null, 2)}` }, ...memoriaConversacion[senderId]];

        const completion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: contexto
        });

        const respuesta = completion.choices[0].message.content.trim();
        memoriaConversacion[senderId].push({ role: "assistant", content: respuesta });

        if (respuesta.startsWith("MOSTRAR_MODELO:")) {
            const codigo = respuesta.split(":")[1].trim();
            const producto = Object.values(data).flat().find(p => p.codigo === codigo);
            if (producto) await enviarInfoPromo(senderId, producto);
            else await enviarMensajeTexto(senderId, "😔 Lo siento, no encontramos ese modelo.");
        } else if (respuesta.startsWith("MOSTRAR_CATALOGO:")) {
            const categoria = respuesta.split(":")[1].trim();
            await enviarCatalogo(senderId, categoria);
        } else if (respuesta === "PEDIR_CATALOGO") {
            await enviarMenuPrincipal(senderId); // Simplificado para reusar el menú
        } else if (respuesta.startsWith("PREGUNTAR_TIPO:")) {
            const genero = respuesta.split(":")[1].trim().toUpperCase();
            await enviarSubmenuTipoReloj(senderId, genero);
        } else {
            await enviarMensajeConBotonSalir(senderId, respuesta);
        }
    } catch (error) {
        console.error('❌ Error en consulta a ChatGPT:', error);
        await enviarMensajeTexto(senderId, "⚠️ Lo siento, hubo un problema al conectarme con el asesor. Intente nuevamente.");
    }
}


// --- FLUJO DE COMPRA ---
async function manejarFlujoCompra(senderId, mensaje) {
    // ... (La lógica de validación se mantiene igual que en tu bot de Messenger)
    const tieneCelular = /\b9\d{8}\b/.test(mensaje);
    const tieneNombre = mensaje.split(' ').length >= 2;
    const tieneDireccion = /(jirón|jr|avenida|av|calle|pasaje|mz|mza|lote|urb)/i.test(mensaje);
    const tieneDNI = /\b\d{8}\b/.test(mensaje);

    if (estadoUsuario[senderId] === 'ESPERANDO_DATOS_PROVINCIA') {
        if (!tieneNombre || !tieneDNI || !tieneCelular) {
             await enviarMensajeTexto(senderId, "📌 Por favor, asegúrese de enviar su nombre completo, DNI de 8 dígitos y número de WhatsApp que empiece con 9.");
             return;
        }
        await enviarMensajeTexto(senderId, "✅ Su orden ha sido confirmada ✔\nEnvío de: 1 Reloj Premium\n" + "👉 Forma: Envío a recoger en Agencia Shalom\n" + "👉 Datos recibidos correctamente.\n");
        await enviarMensajeTexto(senderId, "😊 Estimado cliente, para enviar su pedido necesitamos un adelanto simbólico de 20 soles por motivo de seguridad.\n\n" + "📱 YAPE: 979 434 826 (Paulina Gonzales Ortega)\n" + "🏦 BCP: 19303208489096\n" + "🏦 CCI: 00219310320848909613\n\n" + "📤 Envíe la captura de su pago aquí para registrar su adelanto.");
        delete estadoUsuario[senderId];
    } else if (estadoUsuario[senderId] === 'ESPERANDO_DATOS_LIMA') {
        if (!tieneNombre || !tieneDireccion || !tieneCelular) {
            await enviarMensajeTexto(senderId, "📌 Por favor, asegúrese de enviar su nombre completo, dirección (con calle/av/jr) y número de WhatsApp que empiece con 9.");
            return;
        }
        await enviarMensajeTexto(senderId, "✅ Su orden ha sido confirmada ✔\nEnvío de: 1 Reloj Premium\n" + "👉 Forma: Envío express a domicilio\n" + "👉 Datos recibidos correctamente.\n" + "💰 El costo incluye S/10 adicionales por envío a domicilio.");
        delete estadoUsuario[senderId];
    }
}


// --- FUNCIONES PARA ENVIAR MENSAJES ---
// Todas usan una versión de API consistente (v19.0)
const API_VERSION = "v19.0";

async function enviarMensaje(senderId, messageData) {
    try {
        await axios.post(`https://graph.facebook.com/${API_VERSION}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            recipient: { id: senderId },
            ...messageData
        });
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
    }
}

async function enviarMensajeTexto(senderId, text) {
    await enviarMensaje(senderId, { message: { text } });
}

async function enviarMensajeConBotonSalir(senderId, text) {
    if (!contadorMensajesAsesor[senderId] || contadorMensajesAsesor[senderId] < 6) {
        await enviarMensajeTexto(senderId, text);
        return;
    }
    const messageData = {
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: text,
                    buttons: [{ type: "postback", title: "↩️ Volver al inicio", payload: "SALIR_ASESOR" }]
                }
            }
        }
    };
    await enviarMensaje(senderId, messageData);
}

async function enviarInfoPromo(senderId, producto) {
    await enviarMensaje(senderId, { message: { attachment: { type: "image", payload: { url: producto.imagen, is_reusable: true } } } });
    
    const messageData = {
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: `${producto.nombre}\n${producto.descripcion}\n💰 Precio: S/${producto.precio}`,
                    buttons: [
                        { type: "postback", title: "🛍️ Comprar ahora", payload: `COMPRAR_${producto.codigo}` },
                        { type: "web_url", url: "https://wa.me/51904805167?text=Hola%20quiero%20comprar%20este%20modelo", title: "📞 Comprar por WhatsApp" },
                        { type: "postback", title: "📖 Ver otros modelos", payload: "VER_MODELOS" }
                    ]
                }
            }
        }
    };
    await enviarMensaje(senderId, messageData);
}

async function enviarMenuPrincipal(senderId) {
    const messageData = {
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "👋 ¡Hola! Bienvenido a Tiendas Megan\n⌚💎 Descubre tu reloj ideal o el regalo perfecto 🎁\nElige una opción para ayudarte 👇",
                    buttons: [
                        { type: "postback", title: "⌚ Para Caballeros", payload: "CABALLEROS" },
                        { type: "postback", title: "🕒 Para Damas", payload: "DAMAS" },
                        { type: "postback", title: "💬 Hablar con Asesor", payload: "ASESOR" }
                    ]
                }
            }
        }
    };
    await enviarMensaje(senderId, messageData);
}

async function enviarSubmenuTipoReloj(senderId, genero) {
    const texto = genero === "CABALLEROS" ? "🔥 ¡Excelente elección! ¿Qué tipo de reloj para caballeros le interesa?" : "🔥 ¡Excelente elección! ¿Qué tipo de reloj para damas le interesa?";
    const payloadAuto = genero === "CABALLEROS" ? "CABALLEROS_AUTO" : "DAMAS_AUTO";
    const payloadCuarzo = genero === "CABALLEROS" ? "CABALLEROS_CUARZO" : "DAMAS_CUARZO";

    const messageData = {
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: texto,
                    buttons: [
                        { type: "postback", title: "⌚ Automáticos ⚙️", payload: payloadAuto },
                        { type: "postback", title: "🕑 De cuarzo ✨", payload: payloadCuarzo }
                    ]
                }
            }
        }
    };
    await enviarMensaje(senderId, messageData);
}

async function enviarCatalogo(senderId, categoria) {
    const listaProductos = data[categoria];
    if (!listaProductos || listaProductos.length === 0) {
        await enviarMensajeTexto(senderId, "❌ No tenemos productos en esta categoría por ahora.");
        return;
    }
    for (const producto of listaProductos) {
        await enviarInfoPromo(senderId, producto); // Reutilizamos la función para mostrar cada producto
    }
}

async function enviarPreguntaUbicacion(senderId) {
    const messageData = {
        message: {
            text: "😊 Por favor indíquenos, ¿su pedido es para Lima o para Provincia?",
            quick_replies: [
                { content_type: "text", title: "🏙 Lima", payload: "UBICACION_LIMA" },
                { content_type: "text", title: "🏞 Provincia", payload: "UBICACION_PROVINCIA" }
            ]
        }
    };
    await enviarMensaje(senderId, messageData);
}


// --- GESTIÓN DE INACTIVIDAD ---
function reiniciarTimerInactividad(senderId) {
    limpiarTimers(senderId);
    const timer10 = setTimeout(() => enviarAvisoInactividad(senderId), 10 * 60 * 1000);
    const timer12 = setTimeout(() => finalizarSesion(senderId), 12 * 60 * 1000);
    timersInactividad[senderId] = { timer10, timer12 };
}

function limpiarTimers(senderId) {
    if (timersInactividad[senderId]) {
        clearTimeout(timersInactividad[senderId].timer10);
        clearTimeout(timersInactividad[senderId].timer12);
        delete timersInactividad[senderId];
    }
}

async function enviarAvisoInactividad(senderId) {
    const messageData = {
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "¿Podemos ayudarte en algo más? 😊 También puedes continuar tu pedido por WhatsApp:",
                    buttons: [{ type: "web_url", url: "https://wa.me/51904805167", title: "📞 Continuar por WhatsApp" }]
                }
            }
        }
    };
    await enviarMensaje(senderId, messageData);
}

async function finalizarSesion(senderId) {
    delete estadoUsuario[senderId];
    delete memoriaConversacion[senderId];
    await enviarMensajeTexto(senderId, "⏳ Tu sesión ha terminado. ¡Gracias por visitar Tiendas Megan!");
}


// 🚀 --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));