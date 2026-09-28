const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    normalizeMessageContent
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth');
const BLOQUEADOS_FILE = path.join(__dirname, 'bloqueados.json');
const UI = {
    reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m',
    yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m'
};
const ui = (color, text) => UI[color] + text + UI.reset;
const panel = title => {
    console.log('');
    console.log(ui('cyan', '╔' + '═'.repeat(46) + '╗'));
    console.log(ui('cyan', '║ ' + title));
    console.log(ui('cyan', '╚' + '═'.repeat(46) + '╝'));
};


const activeTimers = new Map();
let currentSock = null; // Referencia global para que los timers sobrevivan a las reconexiones

function cargarBloqueados() {
    try {
        if (!fs.existsSync(BLOQUEADOS_FILE)) {
            fs.writeFileSync(BLOQUEADOS_FILE, '[]', 'utf8');
            return [];
        }
        const datos = JSON.parse(fs.readFileSync(BLOQUEADOS_FILE, 'utf8'));
        return Array.isArray(datos) ? datos : [];
    } catch {
        return [];
    }
}

function guardarBloqueados(lista) {
    try {
        fs.writeFileSync(BLOQUEADOS_FILE, JSON.stringify(lista, null, 2), 'utf8');
    } catch (error) {}
}

function normalizarJid(jid) {
    if (!jid) return null;
    return String(jid).replace(/:\d+(?=@)/, '').trim();
}

function estaBloqueado(chat, usuario) {
    chat = normalizarJid(chat);
    usuario = normalizarJid(usuario);
    if (!chat || !usuario) return false;
    const lista = cargarBloqueados();
    return lista.some(item => normalizarJid(item.chat) === chat && normalizarJid(item.usuario) === usuario);
}

function bloquearUsuario(chat, usuario) {
    chat = normalizarJid(chat);
    usuario = normalizarJid(usuario);
    if (!chat || !usuario) return;
    const lista = cargarBloqueados();
    if (!lista.some(item => normalizarJid(item.chat) === chat && normalizarJid(item.usuario) === usuario)) {
        lista.push({ chat, usuario });
        guardarBloqueados(lista);
    }
}

function desbloquearUsuario(chat, usuario) {
    chat = normalizarJid(chat);
    usuario = normalizarJid(usuario);
    if (!chat || !usuario) return;
    let lista = cargarBloqueados();
    lista = lista.filter(item => !(normalizarJid(item.chat) === chat && normalizarJid(item.usuario) === usuario));
    guardarBloqueados(lista);
}

function obtenerContexto(msg) {
    const contenido = normalizeMessageContent(msg.message) || msg.message;
    return (
        contenido?.extendedTextMessage?.contextInfo ||
        contenido?.imageMessage?.contextInfo ||
        contenido?.videoMessage?.contextInfo ||
        contenido?.documentMessage?.contextInfo ||
        null
    );
}

function obtenerObjetivo(msg) {
    const contexto = obtenerContexto(msg);
    if (!contexto) return null;
    if (contexto.participant) return normalizarJid(contexto.participant);
    if (Array.isArray(contexto.mentionedJid) && contexto.mentionedJid.length > 0) {
        return normalizarJid(contexto.mentionedJid[0]);
    }
    return null;
}

async function eliminarMensaje(sock, key) {
    if (!key?.remoteJid || !key?.id) return false;
    try {
        await sock.sendMessage(key.remoteJid, { delete: key });
        return true;
    } catch {
        return false;
    }
}

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);    

    const sock = makeWASocket({    
        auth: state,    
        logger: pino({ level: 'silent' }),    
        printQRInTerminal: false,    
        browser: ['Chrome', 'Linux', '120.0.0'],    
        markOnlineOnConnect: true    
    });    

    // Actualizamos la referencia global del socket activo
    currentSock = sock;

    function esPropietario(jid) {    
        if (!jid || !sock.user) return false;    
        const sender = normalizarJid(jid);    
        const miNumero = normalizarJid(sock.user.id);    
        const miLid = normalizarJid(sock.user.lid);    
        return sender === miNumero || sender === miLid;    
    }    

    sock.ev.on('connection.update', async update => {    
        const { connection, lastDisconnect, qr } = update;    

        if (qr) {    
            panel('📱 WHATSAPP · ESCANEA EL QR');   
            qrcode.generate(qr, { small: true });    
        }    

        if (connection === 'open') {    
            console.log('\n========================================');   
            console.log('✅ WHATSAPP CONECTADO CORRECTAMENTE');    
            console.log('========================================');    
            console.log(`👑 Propietario: ${normalizarJid(sock.user?.id)}`);    
            console.log();    
        }    

        if (connection === 'close') {    
            const statusCode = lastDisconnect?.error?.output?.statusCode;    
            console.log(ui('yellow', `⚠️ Conexión cerrada · código ${statusCode} · reconectando...`));   

            if (statusCode !== DisconnectReason.loggedOut) {    
                // Si es código 440 (conflicto de sesión), esperamos 10s para que WhatsApp libere el socket viejo
                const tiempoEspera = (statusCode === 440) ? 10000 : 3000;
                setTimeout(() => conectarWhatsApp(), tiempoEspera);    
            } else {    
                console.log(ui('red', '❌ Sesión cerrada permanentemente · elimina auth y vuelve a escanear.'));    
            }    
        }    
    });    

    sock.ev.on('creds.update', saveCreds);    

    sock.ev.on('messages.upsert', async ({ messages, type }) => {   
        if (type !== 'notify') return;   

        for (const m of messages) {    
            try {    
                if (!m?.message) continue;    

                const remoteJid = m.key.remoteJid;    
                if (!remoteJid) continue;    

                const contenido = normalizeMessageContent(m.message) || m.message;    

                let messageSender = m.key.fromMe ? sock.user?.id : (m.key.participant || m.participant || remoteJid);    
                messageSender = normalizarJid(messageSender);    
                const propietario = esPropietario(messageSender);    

                const messageContent =    
                    contenido?.conversation ||    
                    contenido?.extendedTextMessage?.text ||    
                    contenido?.imageMessage?.caption ||    
                    contenido?.videoMessage?.caption ||    
                    contenido?.documentMessage?.caption ||    
                    '';    

                const texto = String(messageContent).trim();    
                const textoUpper = texto.toUpperCase();    

                // Filtro estricto de bloqueados: borra al instante cualquier mensaje suyo   
                if (!propietario && estaBloqueado(remoteJid, messageSender)) {    
                    await eliminarMensaje(sock, m.key);    
                    continue;    
                }    

                // XD1: Bloquear usuario y borrar su mensaje respondido + comando   
                if (textoUpper === 'XD1') {    
                    if (!propietario) continue;    

                    const objetivo = obtenerObjetivo(m);    
                    if (!objetivo || esPropietario(objetivo)) {    
                        await eliminarMensaje(sock, m.key);   
                        continue;    
                    }    

                    bloquearUsuario(remoteJid, objetivo);    

                    const contexto = obtenerContexto(m);   
                    if (contexto?.stanzaId) {   
                        await eliminarMensaje(sock, {   
                            remoteJid: remoteJid,   
                            id: contexto.stanzaId,   
                            participant: contexto.participant,   
                            fromMe: false   
                        });   
                    }   

                    await eliminarMensaje(sock, m.key);    
                    continue;    
                }    

                // XD2: Desbloquear usuario   
                if (textoUpper === 'XD2' || textoUpper.startsWith('XD2 ')) {    
                    if (!propietario) continue;    

                    let objetivo = obtenerObjetivo(m);    
                    if (!objetivo) {    
                        const contexto = obtenerContexto(m);    
                        if (contexto?.mentionedJid?.length) {    
                            objetivo = normalizarJid(contexto.mentionedJid[0]);    
                        }    
                    }    

                    if (objetivo) {    
                        desbloquearUsuario(remoteJid, objetivo);    
                    }    

                    await eliminarMensaje(sock, m.key);    
                    continue;    
                }    

                // #FOTO: Enviar foto de perfil   
                if (textoUpper === '#FOTO' || textoUpper.startsWith('#FOTO ')) {    
                    if (!propietario) continue;    

                    await eliminarMensaje(sock, m.key);   
                    const objetivo = obtenerObjetivo(m);    
                    if (!objetivo) continue;    

                    try {    
                        const pfpUrl = await sock.profilePictureUrl(objetivo, 'image');    
                        if (pfpUrl) {    
                            await sock.sendMessage(remoteJid, { image: { url: pfpUrl } });    
                        }    
                    } catch {}    
                    continue;    
                }    

                // XD5: Detener spam   
                if (textoUpper === 'XD5') {    
                    if (!propietario) continue;    

                    await eliminarMensaje(sock, m.key);    

                    if (activeTimers.has(remoteJid)) {    
                        clearInterval(activeTimers.get(remoteJid));    
                        activeTimers.delete(remoteJid);    
                    }    
                    continue;    
                }    

                // XD3 / XD4: Iniciar Spam / Envío programado   
                if (textoUpper.startsWith('XD3 ') || textoUpper.startsWith('XD4 ')) {    
                    if (!propietario) continue;    

                    await eliminarMensaje(sock, m.key);    

                    const match = texto.match(/^XD[34]\s+(\d+)([SM])\s+(.+)$/i);    
                    if (!match) continue;    

                    const cantidad = parseInt(match[1], 10);    
                    const unidad = match[2].toUpperCase();    
                    const textoEnvio = match[3];    

                    if (cantidad <= 0) continue;    

                    let intervaloMs = cantidad * 1000;    
                    if (unidad === 'M') {    
                        intervaloMs = cantidad * 60 * 1000;    
                    }    

                    if (activeTimers.has(remoteJid)) {    
                        clearInterval(activeTimers.get(remoteJid));    
                        activeTimers.delete(remoteJid);    
                    }    

                    const timer = setInterval(async () => {    
                        try {    
                            if (currentSock) {
                                await currentSock.sendMessage(remoteJid, { text: textoEnvio });    
                            }
                        } catch (err) {}    
                    }, intervaloMs);    

                    activeTimers.set(remoteJid, timer);    
                    continue;    
                }    

            } catch (error) {}    
        }    
    });
}

conectarWhatsApp();
