import { readFileSync } from "node:fs";
import { Client, Utils } from "../wil-messenger/dist/index.js";

const CONFIG_FILE = new URL("./apodos.json", import.meta.url);
const COOKIES_FILE = "/data/data/com.termux/files/home/messenger-bot/cookies.json";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const UI = { reset:'\x1b[0m', cyan:'\x1b[36m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m' };
const ui = (c,t) => UI[c] + t + UI.reset;
const panel = t => { console.log(''); console.log(ui('cyan','╔'+'═'.repeat(46)+'╗')); console.log(ui('cyan','║ '+t)); console.log(ui('cyan','╚'+'═'.repeat(46)+'╝')); };

const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));

if (!config.general.enabled) {
    console.log(ui("red","❌ El apodo general está desactivado."));
    process.exit(0);
}

const raw = readFileSync(COOKIES_FILE, "utf8");
const client = new Client(Utils.parseCookies(raw));

try {
    panel("✦ APODOS · APLICACIÓN GENERAL ✦");\n    console.log(ui("cyan","🔌 Conectando..."));
    await client.connect();

    const groups = Object.entries(config.general.groups)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id);

    if (!groups.length) {
        console.log("⚠️ No hay grupos activos para el apodo general.");
        process.exit(0);
    }

    console.log(`👥 Grupos activos: ${groups.length}`);

    for (const groupIdText of groups) {
        const groupId = BigInt(groupIdText);

        console.log("");
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`👥 GRUPO: ${groupIdText}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const members = await client.getGroupMembers(groupId);

        console.log(`📊 Miembros: ${members.length}`);

        let changed = 0;
        let skipped = 0;
        let errors = 0;

        for (const member of members) {
            const userId = String(member.user_id);

            const nickname =
                config.specific.enabled &&
                config.specific.users[userId]
                    ? config.specific.users[userId]
                    : config.general.nickname;

            if ((member.nickname || "") === nickname) {
                skipped++;
                continue;
            }

            console.log(`✏️ ${userId} → ${nickname}`);

            try {
                await client.setGroupNickname(
                    groupId,
                    BigInt(userId),
                    nickname
                );

                changed++;
                console.log("   ✅");
            } catch (err) {
                errors++;
                console.log(`   ❌ ${err.message}`);
            }

            await sleep(300);
        }

        console.log(
            `📊 Cambiados: ${changed} | Correctos: ${skipped} | Errores: ${errors}`
        );
    }

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ PROCESO GENERAL TERMINADO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

} finally {
    try {
        await client.disconnect();
    } catch {}
}
