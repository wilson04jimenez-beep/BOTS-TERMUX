import { readFileSync } from "node:fs";
import { Client, Utils } from "../wil-messenger/dist/index.js";

const COOKIES_FILE =
    "/data/data/com.termux/files/home/messenger-bot/cookies.json";

const cookies = readFileSync(COOKIES_FILE, "utf8");
const client = new Client(Utils.parseCookies(cookies));

try {
    console.log("\n🔌 CONECTANDO...\n");

    const { initialData } = await client.connect();
    const threads = initialData?.threads || [];

    const groups = threads.filter(thread =>
        String(thread.type) === "2"
    );

    console.log("══════════════════════════════════════════════════");
    console.log("              TODOS LOS GRUPOS");
    console.log("══════════════════════════════════════════════════\n");

    groups.forEach((group, i) => {
        const id =
            group.threadId ??
            group.thread_id ??
            group.id;

        const name =
            group.name ??
            group.threadName ??
            group.title ??
            group.subject ??
            "SIN NOMBRE";

        console.log(`[${i + 1}] ${name}`);
        console.log(`    ID: ${id}`);
        console.log(`    TIPO: ${group.type}`);
        console.log("");
    });

    console.log("══════════════════════════════════════════════════");
    console.log(`✅ TOTAL DE GRUPOS: ${groups.length}`);
    console.log("══════════════════════════════════════════════════");

} catch (err) {
    console.error("\n❌ ERROR:", err.message);
}
