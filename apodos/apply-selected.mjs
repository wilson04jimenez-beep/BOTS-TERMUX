import { readFileSync } from "node:fs";
import { Client, Utils } from "../wil-messenger/dist/index.js";
import readline from "node:readline";

const COOKIES_FILE =
    "/data/data/com.termux/files/home/messenger-bot/cookies.json";

const groupIds = (process.env.APODOS_GROUPS || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

const nickname = process.env.APODOS_NICKNAME || "";

if (!groupIds.length) {
    console.error("❌ NO SE SELECCIONARON GRUPOS.");
    process.exit(1);
}

if (!nickname.trim()) {
    console.error("❌ EL APODO ESTÁ VACÍO.");
    process.exit(1);
}

const cookies = readFileSync(COOKIES_FILE, "utf8");

const client = new Client(
    Utils.parseCookies(cookies)
);

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

/*
======================================================
CONTROL PARA DETENER EL PROCESO
======================================================
*/

let detener = false;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on("line", () => {
    if (!detener) {
        detener = true;

        console.log(
            "\n\n🛑 DETENIENDO PROCESO..."
        );

        console.log(
            "   No se cambiarán más apodos."
        );
    }
});

function comprobarDetener() {
    return detener;
}

/*
======================================================
PROCESO
======================================================
*/

try {

    console.log("\n🔌 CONECTANDO A MESSENGER...\n");

    await client.connect();

    let totalChanged = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    console.log(
        "⏹️ PRESIONA ENTER EN CUALQUIER MOMENTO PARA DETENER\n"
    );

    for (const groupIdText of groupIds) {

        if (comprobarDetener()) {
            break;
        }

        const groupId = BigInt(groupIdText);

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            `👥 GRUPO: ${groupIdText}`
        );

        console.log(
            `✏️ APODO: ${nickname}`
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        let members;

        try {

            members =
                await client.getGroupMembers(groupId);

        } catch (err) {

            totalErrors++;

            console.log(
                `❌ ERROR OBTENIENDO MIEMBROS: ${err.message}`
            );

            continue;
        }

        console.log(
            `👤 MIEMBROS: ${members.length}\n`
        );

        for (const member of members) {

            /*
            ==========================================
            COMPROBAR SI EL USUARIO QUIERE PARAR
            ==========================================
            */

            if (comprobarDetener()) {
                break;
            }

            const userId =
                BigInt(member.user_id);

            /*
            ==========================================
            YA TIENE EL APODO
            ==========================================
            */

            if (
                (member.nickname || "") === nickname
            ) {

                totalSkipped++;

                continue;
            }

            /*
            ==========================================
            CAMBIAR APODO
            ==========================================
            */

            try {

                await client.setGroupNickname(
                    groupId,
                    userId,
                    nickname
                );

                totalChanged++;

                process.stdout.write(".");

                await sleep(250);

            } catch (err) {

                totalErrors++;

                console.log(
                    `\n❌ ${member.user_id}: ${err.message}`
                );
            }
        }

        console.log("\n");

        /*
        ==============================================
        SI SE DETUVO, NO PASAR AL SIGUIENTE GRUPO
        ==============================================
        */

        if (comprobarDetener()) {
            break;
        }
    }

    console.log(
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    if (detener) {

        console.log(
            "🛑 PROCESO DETENIDO POR EL USUARIO"
        );

    } else {

        console.log(
            "✅ PROCESO TERMINADO"
        );
    }

    console.log(
        `✏️ CAMBIADOS: ${totalChanged}`
    );

    console.log(
        `⏭️ YA CORRECTOS: ${totalSkipped}`
    );

    console.log(
        `❌ ERRORES: ${totalErrors}`
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

} finally {

    rl.close();

    try {
        await client.disconnect();
    } catch {}
}
