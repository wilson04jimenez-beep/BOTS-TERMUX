const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const UI = {
  reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m'
};
const ui = (color, text) => UI[color] + text + UI.reset;
const panel = title => {
  console.log('');
  console.log(ui('cyan', '╔' + '═'.repeat(52) + '╗'));
  console.log(ui('cyan', '║ ' + title));
  console.log(ui('cyan', '╚' + '═'.repeat(52) + '╝'));
};


const client = new Client({
  checkUpdate: false
});

// ======================================================
// CONFIGURACIÓN
// ======================================================

const STATE_FILE = './wilauto_state.json';

// ======================================================
// MAPAS
// ======================================================

const intervalMap = new Map();

// ======================================================
// ESTADO PERSISTENTE
// ======================================================

let savedState = {
  channels: {}
};

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      savedState = { channels: {} };
      return;
    }

    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    savedState = JSON.parse(raw);

    if (!savedState.channels) {
      savedState.channels = {};
    }

    console.log(
      `[Sistema] Estado restaurado: ${Object.keys(savedState.channels).length} canal(es).`
    );

  } catch (error) {
    console.error('[Error al cargar estado]:', error.message);
    savedState = { channels: {} };
  }
}

function saveState() {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(savedState, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('[Error al guardar estado]:', error.message);
  }
}

function removeChannelState(channelId) {
  if (savedState.channels[channelId]) {
    delete savedState.channels[channelId];
    saveState();
  }
}

function updateChannelStatus(channelId, status) {
  if (savedState.channels[channelId]) {
    savedState.channels[channelId].status = status;
    saveState();
  }
}

// ======================================================
// GUARDAR ESTADO XD1
// ======================================================

function saveXD1State(channelId, seconds, text) {
  savedState.channels[channelId] = {
    type: 'XD1',
    seconds: seconds,
    text: text,
    status: 'ACTIVO'
  };
  saveState();
}

// ======================================================
// GUARDAR ESTADO XD2
// ======================================================

function saveXD2State(channelId, minutes, text) {
  savedState.channels[channelId] = {
    type: 'XD2',
    minutes: minutes,
    text: text,
    status: 'ACTIVO'
  };
  saveState();
}

// ======================================================
// INICIAR XD1
// ======================================================

function startXD1(channel, channelId, seconds, text, save = true) {
  if (intervalMap.has(channelId)) {
    clearInterval(intervalMap.get(channelId));
    intervalMap.delete(channelId);
  }

  if (save) {
    saveXD1State(channelId, seconds, text);
  } else {
    updateChannelStatus(channelId, 'ACTIVO');
  }

  const interval = setInterval(() => {
    channel.send(text).catch(err => {
      const isMissingPerms =
        err.message.includes('Missing Permissions') ||
        err.message.includes('Missing Access') ||
        err.code === 50013 || err.code === 50001;

      if (isMissingPerms) {
        const guildName = channel.guild ? channel.guild.name : 'Desconocido';
        const channelName = channel.name ? `#${channel.name}` : 'Desconocido';

        console.log(ui('red', '❌ [XD1] PERMISOS INSUFICIENTES'));
        console.log(`Servidor: ${guildName}`);
        console.log(`Canal: ${channelName}`);
        console.log(`ID: ${channelId}\n`);

        clearInterval(interval);
        intervalMap.delete(channelId);
        updateChannelStatus(channelId, 'PAUSADO_MISSING_PERMISSIONS');
      } else {
        console.error('[XD1] Error al enviar:', err.message);
      }
    });
  }, seconds * 1000);

  intervalMap.set(channelId, interval);
  console.log(`[XD1] Activado en ${channelId} cada ${seconds} segundo(s)`);
}

// ======================================================
// INICIAR XD2
// ======================================================

function startXD2(channel, channelId, minutes, text, save = true) {
  if (intervalMap.has(channelId)) {
    clearInterval(intervalMap.get(channelId));
    intervalMap.delete(channelId);
  }

  if (save) {
    saveXD2State(channelId, minutes, text);
  } else {
    updateChannelStatus(channelId, 'ACTIVO');
  }

  const interval = setInterval(() => {
    channel.send(text).catch(err => {
      const isMissingPerms =
        err.message.includes('Missing Permissions') ||
        err.message.includes('Missing Access') ||
        err.code === 50013 || err.code === 50001;

      if (isMissingPerms) {
        const guildName = channel.guild ? channel.guild.name : 'Desconocido';
        const channelName = channel.name ? `#${channel.name}` : 'Desconocido';

        console.log(ui('red', '❌ [XD2] PERMISOS INSUFICIENTES'));
        console.log(`Servidor: ${guildName}`);
        console.log(`Canal: ${channelName}`);
        console.log(`ID: ${channelId}\n`);

        clearInterval(interval);
        intervalMap.delete(channelId);
        updateChannelStatus(channelId, 'PAUSADO_MISSING_PERMISSIONS');
      } else {
        console.error('[XD2] Error al enviar:', err.message);
      }
    });
  }, minutes * 60 * 1000);

  intervalMap.set(channelId, interval);
  console.log(`[XD2] Activado en ${channelId} cada ${minutes} minuto(s)`);
}

// ======================================================
// REVISIÓN PERIÓDICA DE CANALES PAUSADOS POR PERMISOS
// ======================================================

async function checkPausedChannels() {
  const channels = savedState.channels;
  for (const channelId of Object.keys(channels)) {
    const state = channels[channelId];
    if (state && state.status === 'PAUSADO_MISSING_PERMISSIONS') {
      try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        const permissions = channel.permissionsFor ? channel.permissionsFor(client.user) : null;
        const canSend = permissions ? permissions.has('SEND_MESSAGES') : true;

        if (canSend) {
          const guildName = channel.guild ? channel.guild.name : 'Desconocido';
          const channelName = channel.name ? `#${channel.name}` : 'Desconocido';

          console.log(ui('green', '🟢 REANUDACIÓN · PERMISOS RESTAURADOS'));
          console.log(`Servidor: ${guildName}`);
          console.log(`Canal: ${channelName}`);
          console.log(`ID: ${channelId}`);
          console.log(`Reiniciando configuración guardada...\n`);

          if (state.type === 'XD1' && state.text && state.seconds > 0) {
            startXD1(channel, channelId, state.seconds, state.text, false);
          } else if (state.type === 'XD2' && state.text && state.minutes > 0) {
            startXD2(channel, channelId, state.minutes, state.text, false);
          }
        }
      } catch (e) {}
    }
  }
}

// ======================================================
// EVENTO READY
// ======================================================

client.on('ready', async () => {
  panel('✦ DISCORD SELF-BOT · CONECTADO ✦');
  console.log(ui('green', '🟢 Cuenta: ' + client.user.tag));
  await restoreSavedStates();
  setInterval(checkPausedChannels, 60000);
});

// ======================================================
// COMANDOS
// ======================================================

client.on('messageCreate', async (message) => {
  if (message.author.id !== client.user.id) return;
  const args = message.content.trim().split(/\s+/);
  const command = args[0];
  const channelId = message.channel.id;

  if (command === 'XD1') {
    const seconds = parseInt(args[1]);
    const text = args.slice(2).join(' ');
    if (isNaN(seconds) || seconds <= 0 || !text) {
      console.log('[XD1] Uso correcto: XD1 <segundos> <texto>');
      return;
    }
    if (intervalMap.has(channelId)) {
      clearInterval(intervalMap.get(channelId));
      intervalMap.delete(channelId);
    }
    startXD1(message.channel, channelId, seconds, text, true);
    return;
  }

  if (command === 'XD2') {
    const minutes = parseInt(args[1]);
    const text = args.slice(2).join(' ');
    if (isNaN(minutes) || minutes <= 0 || !text) {
      console.log('[XD2] Uso correcto: XD2 <minutos> <texto>');
      return;
    }
    if (intervalMap.has(channelId)) {
      clearInterval(intervalMap.get(channelId));
      intervalMap.delete(channelId);
    }
    startXD2(message.channel, channelId, minutes, text, true);
    return;
  }

  if (command === 'XD3') {
    if (intervalMap.has(channelId)) {
      clearInterval(intervalMap.get(channelId));
      intervalMap.delete(channelId);
    }
    removeChannelState(channelId);
    console.log(`[XD3] Todo detenido en ${channelId}`);
    return;
  }
});

// ======================================================
// RESTAURAR TODO AL INICIAR
// ======================================================

async function restoreSavedStates() {
  const channels = savedState.channels;
  const channelKeys = Object.keys(channels);

  if (channelKeys.length > 0) {
    console.log('\n=================================');
    console.log('📋 CANALES CONFIGURADOS');
    console.log('=================================');
  }

  let index = 1;

  for (const channelId of channelKeys) {
    const state = channels[channelId];
    let channel = null;
    let guildName = 'Desconocido';
    let channelName = 'Desconocido';

    try {
      channel = await client.channels.fetch(channelId);
      if (channel) {
        guildName = channel.guild ? channel.guild.name : 'Desconocido';
        channelName = channel.name ? `#${channel.name}` : 'Desconocido';
        if (!savedState.channels[channelId].status) {
          savedState.channels[channelId].status = 'ACTIVO';
        }
      } else {
        savedState.channels[channelId].status = 'NO_ENCONTRADO';
      }
    } catch (error) {
      savedState.channels[channelId].status = 'NO_ENCONTRADO';
    }

    let intervalText = 'N/A';
    if (state.type === 'XD1') intervalText = `${state.seconds} segundos`;
    if (state.type === 'XD2') intervalText = `${state.minutes} minutos`;

    // Asignar colores según el estado actual
    const currentStatus = savedState.channels[channelId].status;
    let statusFormatted = '';

    if (currentStatus === 'ACTIVO') {
      statusFormatted = '\x1b[32m🟢 ACTIVO\x1b[0m'; // Verde
    } else if (currentStatus.includes('PAUSADO')) {
      statusFormatted = `\x1b[31m🔴 ${currentStatus}\x1b[0m`; // Rojo
    } else {
      statusFormatted = `\x1b[33m⚠️ ${currentStatus}\x1b[0m`; // Amarillo para otros
    }

    console.log(`[${index}] \x1b[36m${state.type}\x1b[0m`);
    console.log(`Servidor: ${guildName}`);
    console.log(`Canal: ${channelName}`);
    console.log(`ID: ${channelId}`);
    console.log(`Intervalo: ${intervalText}`);
    console.log(`Estado: ${statusFormatted}`);
    console.log('---------------------------------');

    index++;

    if (!channel || savedState.channels[channelId].status === 'PAUSADO_MISSING_PERMISSIONS') {
      continue;
    }

    try {
      if (state.type === 'XD1' && state.text && state.seconds > 0) {
        startXD1(channel, channelId, state.seconds, state.text, false);
      } else if (state.type === 'XD2' && state.text && state.minutes > 0) {
        startXD2(channel, channelId, state.minutes, state.text, false);
      }
    } catch (error) {
      updateChannelStatus(channelId, 'ERROR_DESCONOCIDO');
    }
  }

  saveState();
}

process.on('SIGINT', () => { saveState(); process.exit(0); });
process.on('SIGTERM', () => { saveState(); process.exit(0); });

loadState();
client.login(process.env.DISCORD_TOKEN);
