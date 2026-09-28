const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');

const UI = { reset:'\x1b[0m', cyan:'\x1b[36m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m', bold:'\x1b[1m' };
const ui = (c,t) => UI[c] + t + UI.reset;
const panel = t => { console.log(''); console.log(ui('cyan','╔'+'═'.repeat(52)+'╗')); console.log(ui('cyan','║ '+t)); console.log(ui('cyan','╚'+'═'.repeat(52)+'╝')); };

const client = new Client({
  checkUpdate: false
});

// ======================================================
// CONFIGURACIÓN
// ======================================================

const JSON_FILE = path.join(
  __dirname,
  'wilauto_1800_insultos_formato_compatible.json'
);

const STATE_FILE = path.join(
  __dirname,
  'wilauto_state_xd4.json'
);

// ======================================================
// MAPAS
// ======================================================

const queueMap = new Map();

// Usuario que recibirá la mención final
let targetMentionId = null;

// Usuarios que NO deben activar la cola
const ignoredUserIds = new Set();

// ======================================================
// CARGAR JSON DE MENSAJES
// ======================================================

let items = [];

try {
  if (fs.existsSync(JSON_FILE)) {
    const rawData = fs.readFileSync(JSON_FILE, 'utf8');
    const parsed = JSON.parse(rawData);

    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (
      parsed &&
      parsed.items &&
      Array.isArray(parsed.items)
    ) {
      items = parsed.items
        .map(item => item.text)
        .filter(text => typeof text === 'string');
    }

    console.log(
      `[Sistema] Se cargaron ${items.length} textos del JSON para Insultos.`
    );

  } else {
    console.log(
      '[Aviso] No se encontró wilauto_1800_insultos_formato_compatible.json'
    );
  }

} catch (error) {
  console.error(
    '[Error al leer JSON]:',
    error.message
  );
}

// ======================================================
// ESTADO PERSISTENTE
// ======================================================

let savedState = {
  channels: {}
};

function loadState() {
  try {

    if (!fs.existsSync(STATE_FILE)) {
      savedState = {
        channels: {}
      };
      return;
    }

    const raw = fs.readFileSync(
      STATE_FILE,
      'utf8'
    );

    savedState = JSON.parse(raw);

    if (
      !savedState ||
      typeof savedState !== 'object'
    ) {
      savedState = {
        channels: {}
      };
    }

    if (!savedState.channels) {
      savedState.channels = {};
    }

    console.log(
      `[Sistema] Estado restaurado: ${
        Object.keys(savedState.channels).length
      } canal(es).`
    );

  } catch (error) {

    console.error(
      '[Error al cargar estado]:',
      error.message
    );

    savedState = {
      channels: {}
    };
  }
}

// ======================================================
// GUARDAR ESTADO
// ======================================================

function saveState() {

  try {

    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        savedState,
        null,
        2
      ),
      'utf8'
    );

  } catch (error) {

    console.error(
      '[Error al guardar estado]:',
      error.message
    );
  }
}

// ======================================================
// ELIMINAR ESTADO DE UN CANAL
// ======================================================

function removeChannelState(channelId) {

  if (
    savedState.channels &&
    savedState.channels[channelId]
  ) {

    delete savedState.channels[channelId];

    saveState();
  }
}

// ======================================================
// ACTUALIZAR ESTADO DEL CANAL
// ======================================================

function updateChannelStatus(
  channelId,
  status
) {

  if (
    savedState.channels &&
    savedState.channels[channelId]
  ) {

    savedState.channels[channelId].status =
      status;

    saveState();
  }
}

// ======================================================
// GUARDAR PROGRESO XD4
// ======================================================

function saveXD4State(
  channelId,
  currentIndex
) {

  const existing =
    savedState.channels[channelId] || {};

  savedState.channels[channelId] = {

    ...existing,

    type: 'XD4',

    currentIndex:
      currentIndex,

    status:
      'ACTIVO'
  };

  saveState();
}

// ======================================================
// REVISAR CANALES PAUSADOS
// ======================================================

async function checkPausedChannels() {

  const channels =
    savedState.channels || {};

  for (
    const channelId of Object.keys(channels)
  ) {

    const state =
      channels[channelId];

    if (
      !state ||
      state.status !==
        'PAUSADO_MISSING_PERMISSIONS'
    ) {
      continue;
    }

    try {

      const channel =
        await client.channels
          .fetch(channelId)
          .catch(() => null);

      if (!channel) {
        continue;
      }

      const permissions =
        channel.permissionsFor
          ? channel.permissionsFor(
              client.user
            )
          : null;

      const canSend =
        permissions
          ? permissions.has(
              'SEND_MESSAGES'
            )
          : true;

      if (canSend) {

        const queueState = {

          currentIndex:
            Number.isInteger(
              state.currentIndex
            )
              ? state.currentIndex
              : 0,

          isRunning:
            true
        };

        queueMap.set(
          channelId,
          queueState
        );

        updateChannelStatus(
          channelId,
          'ACTIVO'
        );

        runQueue(
          channel,
          queueState,
          channelId
        );
      }

    } catch (error) {
      // Ignorar errores de revisión
    }
  }
}

// ======================================================
// READY
// ======================================================

client.on(
  'ready',
  async () => {

    panel('✦ INSULTOS · XD4 · CONECTADO ✦');

    console.log(ui('green', '🟢 Cuenta: ' + client.user.tag));

    console.log(ui('cyan', '💬 Modo: Insultos / XD4'));

    

    await restoreSavedStates();

    setInterval(
      checkPausedChannels,
      60000
    );
  }
);

// ======================================================
// COMANDOS
// ======================================================

client.on(
  'messageCreate',
  async (message) => {

    // Solo procesar comandos enviados
    // por la cuenta del propio cliente
    if (
      message.author.id !==
      client.user.id
    ) {
      return;
    }

    const args =
      message.content
        .trim()
        .split(/\s+/);

    const command =
      args[0]?.toUpperCase();

    const channelId =
      message.channel.id;

    // ==================================================
    // XD6
    // Elegir quién recibe la mención final
    // ==================================================

    if (command === 'XD6') {

      const mentionedUser =
        message.mentions.users.first();

      if (mentionedUser) {

        targetMentionId =
          mentionedUser.id;

        console.log(
          `[XD6] Mención establecida → ${mentionedUser.tag}`
        );

      } else {

        targetMentionId = null;

        console.log(
          '[XD6] Mención final desactivada.'
        );
      }

      return;
    }

    // ==================================================
    // XD5
    // Ignorar usuario
    // ==================================================

    if (command === 'XD5') {

      const mentionedUser =
        message.mentions.users.first();

      if (mentionedUser) {

        ignoredUserIds.add(
          mentionedUser.id
        );

        console.log(
          `[XD5] Usuario ignorado → ${mentionedUser.tag}`
        );
      }

      return;
    }
// ==================================================
// XD7
// DES-IGNORAR USUARIO
// ==================================================

if (command === 'XD7') {

  const mentionedUser =
    message.mentions.users.first();

  if (mentionedUser) {

    const wasIgnored =
      ignoredUserIds.delete(
        mentionedUser.id
      );

    if (wasIgnored) {

      console.log(
        `[XD7] Usuario des-ignorado → ${mentionedUser.tag}`
      );

    } else {

      console.log(
        `[XD7] ${mentionedUser.tag} no estaba ignorado.`
      );
    }

  } else {

    console.log(
      '[XD7] Debes mencionar a un usuario.'
    );
  }

  return;
}
    // ==================================================
    // XD4
    // INICIAR
    // ==================================================

    if (command === 'XD4') {

      if (items.length === 0) {

        console.log(
          '[XD4] No hay textos cargados.'
        );

        return;
      }

      // Si ya había una cola,
      // detenerla primero

      if (queueMap.has(channelId)) {

        queueMap.get(
          channelId
        ).isRunning = false;
      }

      const queueState = {

        currentIndex: 0,

        isRunning: true
      };

      queueMap.set(
        channelId,
        queueState
      );

      saveXD4State(
        channelId,
        queueState.currentIndex
      );

      updateChannelStatus(
        channelId,
        'ACTIVO'
      );

      console.log(
        `[XD4] Iniciado en ${channelId}`
      );

      runQueue(
        message.channel,
        queueState,
        channelId
      );

      return;
    }

    // ==================================================
    // XD3
    // DETENER
    // ==================================================

    if (command === 'XD3') {

      if (queueMap.has(channelId)) {

        queueMap.get(
          channelId
        ).isRunning = false;

        queueMap.delete(
          channelId
        );
      }

      removeChannelState(
        channelId
      );

      console.log(
        `[XD3] Cola detenida en ${channelId}`
      );

      return;
    }
  }
);

// ======================================================
// COLA XD4
// ======================================================

async function runQueue(
  channel,
  queueState,
  channelId
) {

  // Este filtro determina quién puede
  // activar la respuesta.

  const filter = (msg) => {

    // Ignorar los mensajes propios
    if (
      msg.author.id ===
      client.user.id
    ) {
      return false;
    }

    // Ignorar usuarios configurados con XD5
    if (
      ignoredUserIds.has(
        msg.author.id
      )
    ) {
      return false;
    }

    return true;
  };

  while (
    queueState.isRunning
  ) {

    let collectedMessages = [];

    try {

      // =================================================
      // ESPERAR AL PRIMER MENSAJE
      // =================================================

      const firstMsg =
        await channel.awaitMessages({

          filter,

          max: 1,

          time: 86400000,

          errors: ['time']
        });

      if (
        !queueState.isRunning
      ) {
        break;
      }

      const first =
        firstMsg.first();

      if (!first) {
        continue;
      }

      const authorOfBurst =
        first.author;

      collectedMessages.push(
        first
      );

      // =================================================
      // DETECTAR MENSAJES SEGUIDOS DEL MISMO USUARIO
      // =================================================

      const collectorFilter =
        (msg) => {

          if (
            msg.author.id !==
            authorOfBurst.id
          ) {
            return false;
          }

          if (
            ignoredUserIds.has(
              msg.author.id
            )
          ) {
            return false;
          }

          return true;
        };

      const collector =
        channel.createMessageCollector({

          filter:
            collectorFilter,

          time: 3000
        });

      await new Promise(
        (resolve) => {

          collector.on(
            'collect',
            (msg) => {

              collectedMessages.push(
                msg
              );
            }
          );

          collector.on(
            'end',
            () => {
              resolve();
            }
          );
        }
      );

      if (
        !queueState.isRunning
      ) {
        break;
      }

      // =================================================
      // CANTIDAD DE MENSAJES
      // =================================================

      const messageCount =
        collectedMessages.length;

      // =================================================
      // ENVIAR TEXTOS
      // =================================================

      for (
        let i = 0;
        i < messageCount;
        i++
      ) {

        if (
          !queueState.isRunning
        ) {
          break;
        }

        // Esperar 20 segundos

        let waitTime = 0;

        while (
          waitTime < 20 &&
          queueState.isRunning
        ) {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                1000
              )
          );

          waitTime++;
        }

        if (
          !queueState.isRunning
        ) {
          break;
        }

        // Reiniciar índice cuando
        // llegue al final

        if (
          queueState.currentIndex >=
          items.length
        ) {

          queueState.currentIndex =
            0;
        }

        const currentText =
          items[
            queueState.currentIndex
          ];

        queueState.currentIndex++;

        saveXD4State(
          channelId,
          queueState.currentIndex
        );

        try {

          await channel.send(
            currentText
          );

        } catch (err) {

          const isMissingPerms =
            err.message?.includes(
              'Missing Permissions'
            ) ||
            err.message?.includes(
              'Missing Access'
            ) ||
            err.code === 50013 ||
            err.code === 50001;

          if (
            isMissingPerms
          ) {

            queueState.isRunning =
              false;

            updateChannelStatus(
              channelId,
              'PAUSADO_MISSING_PERMISSIONS'
            );
          }

          break;
        }
      }

      // =================================================
      // MENCIÓN FINAL
      // =================================================
      //
      // IMPORTANTE:
      // Ya NO se menciona automáticamente
      // al usuario que habló.
      //
      // Solo se menciona al usuario elegido
      // mediante XD6.
      // =================================================

      if (
        queueState.isRunning &&
        targetMentionId
      ) {

        try {

          await channel.send(
            `<@${targetMentionId}> 🤣🤣`
          );

        } catch (err) {

          console.log(
            '[XD6] No se pudo enviar la mención final.'
          );
        }
      }

    } catch (error) {

      if (
        error?.message === 'time'
      ) {
        continue;
      }

      queueState.isRunning =
        false;

      console.log(
        `[XD4] Error en ${channelId}:`,
        error.message
      );

      break;
    }
  }

  // ====================================================
  // LIMPIAR COLA
  // ====================================================

  if (
    queueMap.get(channelId) ===
    queueState
  ) {

    queueMap.delete(
      channelId
    );
  }
}

// ======================================================
// RESTAURAR ESTADOS
// ======================================================

async function restoreSavedStates() {

  const channels =
    savedState.channels || {};

  const channelKeys =
    Object.keys(channels);

  for (
    const channelId of channelKeys
  ) {

    const state =
      channels[channelId];

    let channel = null;

    try {

      channel =
        await client.channels.fetch(
          channelId
        );

      if (
        !savedState
          .channels[channelId]
          .status
      ) {

        savedState
          .channels[channelId]
          .status =
            'ACTIVO';
      }

    } catch (error) {

      savedState
        .channels[channelId]
        .status =
          'NO_ENCONTRADO';
    }

    // No arrancar canales que no existen
    // o que quedaron pausados por permisos

    if (
      !channel ||
      savedState
        .channels[channelId]
        .status ===
          'PAUSADO_MISSING_PERMISSIONS'
    ) {

      continue;
    }

    try {

      const queueState = {

        currentIndex:
          Number.isInteger(
            state.currentIndex
          )
            ? state.currentIndex
            : 0,

        isRunning:
          true
      };

      queueMap.set(
        channelId,
        queueState
      );

      updateChannelStatus(
        channelId,
        'ACTIVO'
      );

      console.log(
        `[Restaurar] XD4 → ${channelId} → índice ${queueState.currentIndex}`
      );

      runQueue(
        channel,
        queueState,
        channelId
      );

    } catch (error) {

      updateChannelStatus(
        channelId,
        'ERROR_DESCONOCIDO'
      );
    }
  }

  saveState();
}

// ======================================================
// CIERRE SEGURO
// ======================================================

process.on(
  'SIGINT',
  () => {

    console.log(
      '[Sistema] Guardando estado...'
    );

    saveState();

    process.exit(0);
  }
);

process.on(
  'SIGTERM',
  () => {

    console.log(
      '[Sistema] Guardando estado...'
    );

    saveState();

    process.exit(0);
  }
);

// ======================================================
// INICIO
// ======================================================

loadState();

// IMPORTANTE:
// Pon aquí un token NUEVO y privado.
// No reutilices el token que publicaste anteriormente.

client.login(
  'MTUzMTQ3MjI4Nzk0ODA4MzM5Mw.Gy_jUY.A9_rsSrKQHhtN-3yaHF9NUTEFHz5jhRK62WkWs');
