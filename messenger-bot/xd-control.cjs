const fs = require('fs');
const readline = require('readline');
const path = require('path');

const CONFIG = './xd.json';
const PHOTO_DIR = './photos';
const DEFAULT_PHOTO = 'KAKADDI.jpg';
const UI = { reset:'\x1b[0m', cyan:'\x1b[36m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m', bold:'\x1b[1m', dim:'\x1b[2m' };
function ui(c,t){ return UI[c] + t + UI.reset; }

const DEFAULT_NAME = 'SHAO DIOS DEL UNIVERSO Y FACEBOOK VIOLA A MONADDI, MONORDAN, KAKAFAELA Y A TODOS SU MARIDOS 🤑👌🐶';

if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });

function loadConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (!Array.isArray(config.groups)) config.groups = [];
  config.groups.forEach(ensureGroup);
  return config;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));
}

function xdName(index) { return `XD${index + 1}`; }

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

function ensureGroup(group) {
  if (group.active === undefined) group.active = true;
  if (group.nameEnabled === undefined) group.nameEnabled = true;
  if (typeof group.name !== 'string') group.name = DEFAULT_NAME;
  if (group.photoEnabled === undefined) group.photoEnabled = true;
  if (typeof group.photo !== 'string' || !group.photo) group.photo = DEFAULT_PHOTO;
}

function showGroups(config) {
  console.log(ui('cyan','\n╭────────────────────────────────────────────╮'));
  console.log(ui('bold','│              ✦ 📋 MIS GRUPOS ✦            │'));
  console.log(ui('cyan','╰────────────────────────────────────────────╯\n'));
  if (!config.groups.length) { console.log('⚠️ No hay grupos registrados.\n'); return; }
  config.groups.forEach((group, i) => {
    ensureGroup(group);
    console.log(`┌─ ${group.active ? '🟢' : '🔴'} ${xdName(i)} ${group.active ? 'ACTIVO' : 'DETENIDO'}`);
    console.log(`│  🆔 ID       : ${group.id}`);
    console.log(`│  📝 Nombre   : ${group.nameEnabled ? (group.name || '(sin configurar)') : '🔴 DESACTIVADO'}`);
    console.log(`│  🖼️ Foto     : ${group.photoEnabled ? (group.photo || '(sin configurar)') : '🔴 DESACTIVADA'}`);
    console.log('└────────────────────────────────────────────');
  });
  console.log('');
}

async function configureTimes(config) {
  console.log('\n⚙️ CONFIGURAR TIEMPOS\n');
  const cycle = await ask(`⏱️ ¿Cada cuántos minutos quieres repetir el ciclo?\nActual: ${config.cycleMinutes} min\nMinutos: `);
  const cycleNumber = Number(cycle);
  if (!Number.isFinite(cycleNumber) || cycleNumber <= 0) return console.log('\n❌ Tiempo no válido.\n');
  const separation = await ask(`\n⏳ ¿Cuántos segundos quieres entre cada grupo?\nActual: ${config.separationSeconds} s\nSegundos: `);
  const separationNumber = Number(separation);
  if (!Number.isFinite(separationNumber) || separationNumber < 0) return console.log('\n❌ Separación no válida.\n');
  config.cycleMinutes = cycleNumber;
  config.separationSeconds = separationNumber;
  saveConfig(config);
  console.log(`\n✅ Guardado: ciclo ${cycleNumber} min / separación ${separationNumber} s\n`);
}

async function chooseGroup(config, prompt = 'Selecciona XD: ') {
  if (!config.groups.length) { console.log('\n⚠️ No hay grupos.\n'); return null; }
  showGroups(config);
  const answer = await ask(`🔢 ${prompt}`);
  const number = Number(answer);
  if (!Number.isInteger(number) || number < 1 || number > config.groups.length) {
    console.log('\n❌ XD no válido.\n'); return null;
  }
  const index = number - 1;
  ensureGroup(config.groups[index]);
  return { number, index, group: config.groups[index] };
}

async function toggleGroup(config) {
  const selected = await chooseGroup(config);
  if (!selected) return;
  selected.group.active = !selected.group.active;
  saveConfig(config);
  console.log(`\n${selected.group.active ? '🟢' : '🔴'} ${xdName(selected.index)} ${selected.group.active ? 'ACTIVADO' : 'DESACTIVADO'}.\n`);
}

async function changeName(config, selected) {
  const { group, index } = selected;
  const value = await ask(`\n✏️ Nuevo nombre para ${xdName(index)}\nActual: ${group.name || '(sin configurar)'}\nNuevo: `);
  if (!value) { console.log('\n❌ No se cambió el nombre.\n'); return; }
  group.name = value;
  group.nameEnabled = true;
  saveConfig(config);
  console.log(`\n✅ Nombre guardado para ${xdName(index)}.`);
}

async function toggleName(config, selected) {
  const { group, index } = selected;
  group.nameEnabled = !group.nameEnabled;
  saveConfig(config);
  console.log(`\n${group.nameEnabled ? '🟢' : '🔴'} Cambio de nombre ${group.nameEnabled ? 'ACTIVADO' : 'DESACTIVADO'} para ${xdName(index)}.`);
}

async function changePhoto(config, selected) {
  const { group, index } = selected;
  console.log(`\n🖼️ Las fotos se buscan dentro de: ${PHOTO_DIR}/`);
  const files = fs.readdirSync(PHOTO_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (files.length) {
    console.log('\nFotos disponibles:');
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  } else {
    console.log('⚠️ No hay fotos en ./photos/ todavía.');
  }
  const value = await ask(`\n📷 Nombre del archivo (ej. foto1.jpg)\nActual: ${group.photo || '(sin configurar)'}\nArchivo: `);
  if (!value) { console.log('\n❌ No se cambió la foto.\n'); return; }
  const clean = path.basename(value);
  group.photo = clean;
  group.photoEnabled = true;
  saveConfig(config);
  console.log(`\n✅ Foto guardada para ${xdName(index)}: ${clean}`);
  if (!fs.existsSync(path.join(PHOTO_DIR, clean)) && !fs.existsSync(`./${clean}`)) {
    console.log(`⚠️ Aviso: todavía no existe ${PHOTO_DIR}/${clean}. Colócala allí antes del próximo ciclo.`);
  }
}

async function togglePhoto(config, selected) {
  const { group, index } = selected;
  group.photoEnabled = !group.photoEnabled;
  saveConfig(config);
  console.log(`\n${group.photoEnabled ? '🟢' : '🔴'} Cambio de foto ${group.photoEnabled ? 'ACTIVADO' : 'DESACTIVADO'} para ${xdName(index)}.`);
}

async function configureGroupMenu(config) {
  const selected = await chooseGroup(config, '¿Qué XD quieres configurar? ');
  if (!selected) return;
  const { group, index } = selected;

  while (true) {
    console.log(ui('cyan','\n╭────────────────────────────────────────────╮'));
    console.log(ui('bold',`│        ⚙️ CONFIGURACIÓN ${xdName(index).padEnd(21)}│`));
    console.log(ui('cyan','╰────────────────────────────────────────────╯'));
    console.log(`🆔 ID: ${group.id}`);
    console.log(`📝 Nombre: ${group.nameEnabled ? (group.name || '(sin configurar)') : '🔴 DESACTIVADO'}`);
    console.log(`🖼️ Foto: ${group.photoEnabled ? (group.photo || '(sin configurar)') : '🔴 DESACTIVADA'}`);
    console.log('\n1️⃣ ✏️ Cambiar nombre');
    console.log('2️⃣ 📝 Activar / desactivar nombre');
    console.log('3️⃣ 📷 Cambiar foto');
    console.log('4️⃣ 🖼️ Activar / desactivar foto');
    console.log('5️⃣ 🔄 Cambiar nombre y foto');
    console.log('6️⃣ ↩️ Volver');

    const option = await ask('\n¿Qué quieres hacer?\n> ');
    if (option === '1') await changeName(config, selected);
    else if (option === '2') await toggleName(config, selected);
    else if (option === '3') await changePhoto(config, selected);
    else if (option === '4') await togglePhoto(config, selected);
    else if (option === '5') {
      await changeName(config, selected);
      await changePhoto(config, selected);
    } else if (option === '6') return;
    else console.log('\n❌ Opción no válida.');

    ensureGroup(group);
  }
}

async function addGroup(config) {
  console.log('\n➕ AGREGAR GRUPO\n');
  const id = await ask('🆔 ID del grupo: ');
  if (!/^\d+$/.test(id)) return console.log('\n❌ El ID debe contener solamente números.\n');
  if (config.groups.some(group => String(group.id) === id)) return console.log('\n⚠️ Ese ID ya está agregado.\n');
  config.groups.push({ id, active: true, nameEnabled: true, name: DEFAULT_NAME, photoEnabled: true, photo: DEFAULT_PHOTO });
  saveConfig(config);
  console.log(`\n✅ Grupo agregado como ${xdName(config.groups.length - 1)}.`);
}

async function deleteGroup(config) {
  const selected = await chooseGroup(config, 'XD a eliminar: ');
  if (!selected) return;
  const { group, index } = selected;
  const confirm = await ask(`\n⚠️ Eliminar ${xdName(index)} (${group.id})? (s/n): `);
  if (confirm.toLowerCase() !== 's') return console.log('\n❌ Cancelado.\n');
  config.groups.splice(index, 1);
  saveConfig(config);
  console.log('\n✅ Grupo eliminado.\n');
}

async function individualXD(number) {
  const config = loadConfig();
  const index = Number(number) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= config.groups.length) return console.log(`\n❌ XD${number} no existe.\n`);
  const group = config.groups[index];
  console.log('\n════════════════════════════');
  console.log(`${group.active ? '🟢' : '🔴'} ${xdName(index)} ${group.active ? 'ACTIVO' : 'DETENIDO'}`);
  console.log('════════════════════════════');
  console.log(`🆔 ID: ${group.id}`);
  console.log(`📝 Nombre: ${group.nameEnabled ? (group.name || '(sin configurar)') : 'DESACTIVADO'}`);
  console.log(`🖼️ Foto: ${group.photoEnabled ? (group.photo || '(sin configurar)') : 'DESACTIVADA'}`);
  console.log(`⏱️ Ciclo: ${config.cycleMinutes} minutos`);
  console.log(`⏳ Separación: ${config.separationSeconds} segundos`);
  console.log('\n¿Qué quieres hacer?');
  console.log('config / start / stop / salir');
  const action = await ask('\n> ');
  if (action.toLowerCase() === 'config') await configureGroupMenu(config);
  else if (action.toLowerCase() === 'start') { group.active = true; saveConfig(config); console.log(`\n🟢 ${xdName(index)} ACTIVADO.\n`); }
  else if (action.toLowerCase() === 'stop') { group.active = false; saveConfig(config); console.log(`\n🔴 ${xdName(index)} DETENIDO.\n`); }
}

async function menu() {
  const config = loadConfig();
  saveConfig(config);
  console.clear();
  console.log('');
  console.log(ui('cyan','╔════════════════════════════════════════════╗'));
  console.log(ui('cyan','║                                            ║'));
  console.log(ui('bold','║          ✦ 🤖 CONTROL MESSENGER ✦         ║'));
  console.log(ui('cyan','║                                            ║'));
  console.log(ui('cyan','╚════════════════════════════════════════════╝'));
  console.log('');
  console.log('┌────────────────────────────────────────────┐');
  console.log(`│  ⏱️  Ciclo       : ${String(config.cycleMinutes).padEnd(24)}│`);
  console.log(`│  ⏳  Separación  : ${String(config.separationSeconds).padEnd(24)}│`);
  console.log('└────────────────────────────────────────────┘');
  showGroups(config);
  console.log(ui('cyan','╭────────────────────────────────────────────╮'));
  console.log(ui('bold','│             📌 MENÚ PRINCIPAL              │'));
  console.log('├────────────────────────────────────────────┤');
  console.log('│  1️⃣  ⚙️  Configurar tiempos                │');
  console.log('│  2️⃣  📋  Ver grupos                        │');
  console.log('│  3️⃣  ✏️  Configurar nombre / foto          │');
  console.log('│  4️⃣  🔄  Activar / desactivar grupo        │');
  console.log('│  5️⃣  ➕  Agregar grupo                     │');
  console.log('│  6️⃣  🗑️  Eliminar grupo                   │');
  console.log('│  7️⃣  ❌  Salir                             │');
  console.log(ui('cyan','╰────────────────────────────────────────────╯'));

  const option = await ask('\n¿Qué quieres hacer?\n> ');
  switch (option) {
    case '1': await configureTimes(config); break;
    case '2': showGroups(config); break;
    case '3': await configureGroupMenu(config); break;
    case '4': await toggleGroup(config); break;
    case '5': await addGroup(config); break;
    case '6': await deleteGroup(config); break;
    case '7': return;
    default: console.log('\n❌ Opción no válida.\n');
  }
  await ask('\nPulsa ENTER para volver al menú...');
  return menu();
}

const args = process.argv.slice(2);
if (args.length === 0) menu();
else if (/^XD\d+$/i.test(args[0])) individualXD(args[0].substring(2));
else console.log('\n❌ Comando no reconocido.\n');
