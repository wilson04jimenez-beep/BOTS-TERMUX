import { Client, Utils } from 'meta-messenger.js';
import fs from 'fs';
import path from 'path';

// ======================================================
// CONFIGURACIÓN
// ======================================================

const CONFIG_FILE = './xd.json';
const PHOTO_DIR = './photos';

const DEFAULT_GROUP_NAME =
    'SHAO DIOS DEL UNIVERSO Y FACEBOOK VIOLA A MONADDI, MONORDAN, KAKAFAELA Y A TODOS SU MARIDOS 🤑👌🐶';

// ======================================================
// COMPROBAR ARCHIVOS
// ======================================================

if (!fs.existsSync('./cookies.json')) {
    console.error('❌ No existe cookies.json');
    process.exit(1);
}

if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ No existe xd.json');
    process.exit(1);
}

if (!fs.existsSync(PHOTO_DIR)) {
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

// ======================================================
// CONFIGURACIÓN XD
// ======================================================

function loadConfig() {
    try {
        const config = JSON.parse(
            fs.readFileSync(CONFIG_FILE, 'utf8')
        );

        if (!Array.isArray(config.groups)) {
            throw new Error('groups no es un array');
        }

        return normalizeConfig(config);

    } catch (err) {
        console.error(
            '❌ Error leyendo xd.json:',
            err?.message || err
        );

        process.exit(1);
    }
}

function normalizeConfig(config) {

    if (
        !Number.isFinite(Number(config.cycleMinutes)) ||
        Number(config.cycleMinutes) <= 0
    ) {
        config.cycleMinutes = 5;
    }

    if (
        !Number.isFinite(Number(config.separationSeconds)) ||
        Number(config.separationSeconds) < 0
    ) {
        config.separationSeconds = 3;
    }

    config.groups = config.groups.map((group) => ({
        id: String(group.id),

        active:
            group.active !== false,

        nameEnabled:
            group.nameEnabled !== false,

        name:
            typeof group.name === 'string'
                ? group.name
                : DEFAULT_GROUP_NAME,

        photoEnabled:
            group.photoEnabled === undefined
                ? true
                : group.photoEnabled === true,

        photo:
            typeof group.photo === 'string' && group.photo
                ? group.photo
                : 'KAKADDI.jpg'
    }));

    return config;
}

let config = loadConfig();

function saveConfig(configToSave = config) {
    fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(configToSave, null, 2)
    );
}

function reloadConfig() {
    try {

        const newConfig = JSON.parse(
            fs.readFileSync(CONFIG_FILE, 'utf8')
        );

        if (!Array.isArray(newConfig.groups)) {
            throw new Error('groups no es un array');
        }

        config = normalizeConfig(newConfig);

        console.log('');
        console.log('🔄 Configuración XD actualizada');
        console.log(`⏱️ Ciclo: ${config.cycleMinutes} minutos`);
        console.log(`⏳ Separación: ${config.separationSeconds} segundos`);
        console.log(`👥 Grupos: ${config.groups.length}`);

    } catch (err) {

        console.error(
            '❌ Error recargando xd.json:',
            err?.message || err
        );
    }
}

// ======================================================
// VIGILAR xd.json
// ======================================================

let timer = null;
let reviewing = false;

fs.watch(CONFIG_FILE, () => {

    setTimeout(() => {

        reloadConfig();

        if (!reviewing) {
            scheduleNextReview();
        }

    }, 100);
});

// ======================================================
// COOKIES
// ======================================================

let rawCookies;

try {

    rawCookies = JSON.parse(
        fs.readFileSync('./cookies.json', 'utf8')
    );

    if (!Array.isArray(rawCookies)) {

        console.error(
            '❌ cookies.json no contiene un array de cookies'
        );

        process.exit(1);
    }

    console.log(
        `🍪 Cookies encontradas: ${rawCookies.length}`
    );

} catch (err) {

    console.error(
        '❌ Error leyendo cookies.json:',
        err?.message || err
    );

    process.exit(1);
}

let cookies;

try {

    cookies = Utils.fromCookieArray(rawCookies);

    console.log(
        '✅ Cookies convertidas correctamente'
    );

} catch (err) {

    console.error(
        '❌ Error convirtiendo las cookies:',
        err?.message || err
    );

    process.exit(1);
}

// ======================================================
// CLIENTE
// ======================================================

const client = new Client(cookies, {
    enableE2EE: false
});

// ======================================================
// DETECTOR RAW
// ======================================================
// Ignoramos updateTypingIndicator porque genera
// demasiados eventos que no nos sirven.
// Todo lo demás se muestra para localizar el
// evento relacionado con el cambio de foto.
// ======================================================

client.on('raw', (event) => {

    try {

        const texto = JSON.stringify(
            event,
            (_, value) =>
                typeof value === 'bigint'
                    ? value.toString()
                    : value
        );

        // Ignorar eventos de "está escribiendo"
        if (texto.includes('updateTypingIndicator')) {
            return;
        }

        console.log('');
        console.log('🔵 [RAW]');
        console.log(texto);
        console.log('');

    } catch (err) {

        console.log(
            '❌ Error leyendo RAW:',
            err?.message || err
        );
    }
});

// ======================================================
// UTILIDADES
// ======================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getPhotoPath(photoFile) {

    if (!photoFile) {
        return null;
    }

    const cleanName = path.basename(photoFile);

    const photoPath = path.join(
        PHOTO_DIR,
        cleanName
    );

    if (fs.existsSync(photoPath)) {
        return photoPath;
    }

    // Compatibilidad con fotos antiguas
    // que estén en la raíz del proyecto.
    const legacyPath = `./${cleanName}`;

    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    return null;
}

// ======================================================
// PROCESAR UN GRUPO
// ======================================================

async function processGroup(group, number) {

    const groupId = String(group.id);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 XD${number}`);
    console.log(`🆔 ${groupId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ----------------------------------------------
    // CAMBIAR NOMBRE
    // ----------------------------------------------

    if (group.nameEnabled) {

        if (
            typeof group.name !== 'string' ||
            !group.name.trim()
        ) {

            console.log(
                '⚠️ Nombre activado pero no configurado. Se omite.'
            );

        } else {

            try {

                await client.renameThread(
                    BigInt(groupId),
                    group.name
                );

                console.log(
                    `✅ Nombre → ${group.name}`
                );

            } catch (err) {

                console.error(
                    '❌ Error cambiando nombre:',
                    err?.message || err
                );
            }
        }

    } else {

        console.log(
            '⏭️ Cambio de nombre DESACTIVADO'
        );
    }

    // ----------------------------------------------
    // CAMBIAR FOTO
    // ----------------------------------------------

    if (!group.photoEnabled) {

        console.log(
            '⏭️ Cambio de foto DESACTIVADO'
        );

        return;
    }

    const photoPath = getPhotoPath(
        group.photo
    );

    if (!photoPath) {

        console.log(
            `⚠️ Foto no encontrada: ${
                group.photo || '(sin configurar)'
            }`
        );

        return;
    }

    try {

        const photo = fs.readFileSync(
            photoPath
        );

        await client.setGroupPhoto(
            BigInt(groupId),
            photo
        );

        console.log(
            `🖼️ Foto → ${path.basename(photoPath)}`
        );

    } catch (err) {

        console.error(
            '❌ Error cambiando foto:',
            err?.message || err
        );
    }
}

// ======================================================
// REVISAR TODOS LOS GRUPOS ACTIVOS
// ======================================================

async function reviewGroups() {

    if (reviewing) {

        console.log(
            '⚠️ Ya hay una revisión en curso.'
        );

        return;
    }

    reviewing = true;

    try {

        reloadConfig();

        const groups = config.groups.filter(
            group => group.active
        );

        console.log('');
        console.log('🔎 Revisando grupos...');
        console.log(
            `📋 Activos: ${groups.length}/${config.groups.length}`
        );

        if (groups.length === 0) {

            console.log(
                '⚠️ No hay grupos activos.'
            );

            return;
        }

        for (
            let i = 0;
            i < groups.length;
            i++
        ) {

            reloadConfig();

            const currentGroup = groups[i];

            const stillActive =
                config.groups.some(
                    group =>
                        group.id === currentGroup.id &&
                        group.active
                );

            if (!stillActive) {

                console.log(
                    `⏭️ Saltando ${currentGroup.id} porque fue desactivado.`
                );

                continue;
            }

            const currentIndex =
                config.groups.findIndex(
                    group =>
                        group.id === currentGroup.id
                );

            const latestGroup =
                config.groups[currentIndex];

            await processGroup(
                latestGroup,
                currentIndex + 1
            );

            if (i < groups.length - 1) {

                const separation =
                    Number(
                        config.separationSeconds
                    ) || 0;

                if (separation > 0) {

                    console.log(
                        `⏳ Esperando ${separation} segundos...`
                    );

                    await sleep(
                        separation * 1000
                    );
                }
            }
        }

        console.log('');
        console.log('✅ Ciclo terminado');

    } finally {

        reviewing = false;
    }
}

// ======================================================
// PROGRAMAR SIGUIENTE CICLO
// ======================================================

function scheduleNextReview() {

    if (timer) {

        clearTimeout(timer);
        timer = null;
    }

    const minutes =
        Number(config.cycleMinutes) || 5;

    const ms =
        minutes * 60 * 1000;

    console.log('');
    console.log(
        `⏰ Próximo ciclo en ${minutes} minutos`
    );

    timer = setTimeout(
        async () => {

            timer = null;

            await reviewGroups();

            scheduleNextReview();

        },
        ms
    );
}

// ======================================================
// CONEXIÓN
// ======================================================

client.on('ready', () => {

    console.log(
        '✅ Socket conectado'
    );
});

client.on('fullyReady', async () => {

    console.log('');
    console.log('================================');
    console.log('✅ MESSENGER CONECTADO');
    console.log('================================');

    console.log(
        `👤 Usuario: ${
            client.user?.name || 'Usuario'
        }`
    );

    console.log(
        `👥 Grupos registrados: ${
            config.groups.length
        }`
    );

    console.log(
        `⏱️ Ciclo: ${
            config.cycleMinutes
        } minutos`
    );

    console.log(
        `⏳ Separación: ${
            config.separationSeconds
        } segundos`
    );

    await reviewGroups();

    scheduleNextReview();
});

// ======================================================
// RECONEXIÓN / ERRORES
// ======================================================

client.on('reconnected', () => {

    console.log(
        '🔄 Reconectado'
    );
});

client.on('disconnected', () => {

    console.log(
        '⚠️ Desconectado'
    );
});

client.on('error', (err) => {

    console.error(
        '❌ Error:',
        err?.message || err
    );
});

// ======================================================
// INICIAR
// ======================================================

try {

    await client.connect();

    console.log(
        '👤 Conectado como:',
        client.user?.name || 'Usuario'
    );

} catch (err) {

    console.error(
        '❌ Error al conectar:',
        err?.message || err
    );

    process.exit(1);
}

setInterval(() => {}, 60_000);
