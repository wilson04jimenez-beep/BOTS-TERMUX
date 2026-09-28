import { readFileSync } from "node:fs";
import { Client, Utils } from "../wil-messenger/dist/index.js";

const COOKIES_FILE =
    "/data/data/com.termux/files/home/messenger-bot/cookies.json";

const GROUP_ID = 1392516619444934n;

const cookies = readFileSync(COOKIES_FILE, "utf8");
const client = new Client(Utils.parseCookies(cookies));

client.on("error", err => {
    console.log("⚠️ CLIENT ERROR:", err?.message || err);
});

try {
    console.log("🔌 CONECTANDO...");
    await client.connect();

    console.log("✅ CONECTADO");
    console.log(`🔎 BUSCANDO MIEMBROS DEL GRUPO ${GROUP_ID}...`);

    const members = await client.getGroupMembers(GROUP_ID);

    console.log("");
    console.log(`👤 MIEMBROS ENCONTRADOS: ${members.length}`);
    console.log("");

    if (members.length) {
        for (const member of members) {
            console.log(
                `ID: ${member.user_id} | APODO: ${member.nickname || "(VACÍO)"}`
            );
        }
    } else {
        console.log("❌ EL PUENTE DEVOLVIÓ 0 MIEMBROS.");
    }

} catch (err) {
    console.error("");
    console.error("❌ ERROR:", err?.message || err);
} finally {
    try {
        await client.disconnect();
    } catch {}
}
