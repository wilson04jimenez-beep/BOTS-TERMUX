import { readFileSync } from "node:fs";
import { Client, Utils } from "../wil-messenger/dist/index.js";

const CONFIG_FILE = new URL("./apodos.json", import.meta.url);

const COOKIES_FILE =
    "/data/data/com.termux/files/home/messenger-bot/cookies.json";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const UI = { reset:'\x1b[0m', cyan:'\x1b[36m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m' };
const ui = (c,t) => UI[c] + t + UI.reset;
const panel = t => { console.log(''); console.log(ui('cyan','╔'+'═'.repeat(46)+'╗')); console.log(ui('cyan','║ '+t)); console.log(ui('cyan','╚'+'═'.repeat(46)+'╝')); };


// ======================================================
// CONFIG
// ======================================================

function loadConfig() {
    return JSON.parse(
        readFileSync(CONFIG_FILE, "utf8")
    );
}


// ======================================================
// GRUPOS
// ======================================================

function getConfiguredGroups(config) {

    const groups =
        config.general?.groups || {};

    return Object.entries(groups)
        .map(([id, value]) => {

            if (typeof value === "boolean") {
                return {
                    id,
                    name: "SIN NOMBRE",
                    enabled: value
                };
            }

            return {
                id,
                name: value?.name || "SIN NOMBRE",
                enabled: value?.enabled !== false
            };
        })
        .filter(group => group.enabled);
}


// ======================================================
// MAIN
// ======================================================

async function main() {

    let config = loadConfig();


    if (!config.watch?.enabled) {
        console.log(ui("red","🔴 VIGILANTE DESACTIVADO."));
        return;
    }


    if (!config.specific?.enabled) {
        console.log(ui("red","🔴 APODOS ESPECÍFICOS DESACTIVADOS."));
        return;
    }


    if (!Object.keys(config.specific?.users || {}).length) {
        console.log(ui("yellow","⚠️ NO HAY APODOS ESPECÍFICOS."));
        return;
    }


    panel("✦ XD VIGILANTE · APODOS ✦");

    console.log(ui("cyan","🔌 CONECTANDO A MESSENGER..."));
    console.log("");


    const cookies =
        readFileSync(COOKIES_FILE, "utf8");

    const client =
        new Client(
            Utils.parseCookies(cookies)
        );


    // ==================================================
    // ERROR DEL CLIENTE
    // ==================================================

    client.on("error", err => {

        console.log(
            `⚠️ ERROR DE MESSENGER: ${
                err?.message || err
            }`
        );
    });


    try {

        // ==================================================
        // CONECTAR
        // ==================================================

        await client.connect();

        console.log("✅ CONECTADO.");
        console.log("");


        // ==================================================
        // BUCLE
        // ==================================================

        while (true) {

            config = loadConfig();


            if (!config.watch?.enabled) {

                console.log(
                    "🔴 VIGILANTE DESACTIVADO DESDE EL GESTOR."
                );

                break;
            }


            if (!config.specific?.enabled) {

                console.log(
                    "🔴 ESPECÍFICOS DESACTIVADOS."
                );

                await sleep(10000);

                continue;
            }


            const users =
                config.specific?.users || {};


            const groups =
                getConfiguredGroups(config);


            console.log(
                `🔎 REVISANDO ${groups.length} GRUPO${
                    groups.length === 1 ? "" : "S"
                }...`
            );


            // ==================================================
            // GRUPOS
            // ==================================================

            for (const group of groups) {

                console.log("");

                console.log(
                    `👥 ${group.name}`
                );

                console.log(
                    `   🆔 ${group.id}`
                );


                try {

                    // ==========================================
                    // OBTENER MIEMBROS
                    // ==========================================

                    const members =
                        await client.getGroupMembers(
                            BigInt(group.id)
                        );


                    console.log(
                        `   👤 MIEMBROS: ${members.length}`
                    );


                    // ==========================================
                    // BUSCAR ESPECÍFICOS
                    // ==========================================

                    for (const member of members) {

                        const userId =
                            String(member.user_id);


                        if (
                            users[userId] === undefined
                        ) {
                            continue;
                        }


                        const desiredNickname =
                            users[userId];

                        const currentNickname =
                            member.nickname || "";


                        // ======================================
                        // MOSTRAR QUE LO ENCONTRÓ
                        // ======================================

                        console.log(
                            `   🎯 ESPECÍFICO ENCONTRADO: ${userId}`
                        );

                        console.log(
                            `      ACTUAL: ${
                                currentNickname || "(VACÍO)"
                            }`
                        );

                        console.log(
                            `      DESEADO: ${desiredNickname}`
                        );


                        // ======================================
                        // YA ESTÁ CORRECTO
                        // ======================================

                        if (
                            currentNickname ===
                            desiredNickname
                        ) {

                            console.log(
                                "      ✅ YA CORRECTO"
                            );

                            continue;
                        }


                        // ======================================
                        // CAMBIAR
                        // ======================================

                        console.log(
                            "      ✏️ CAMBIANDO..."
                        );


                        try {

                            await client.setGroupNickname(
                                BigInt(group.id),
                                BigInt(userId),
                                desiredNickname
                            );


                            console.log(
                                "      ✅ APODO RESTAURADO"
                            );


                        } catch (err) {

                            console.log(
                                `      ❌ ERROR: ${
                                    err?.message || err
                                }`
                            );
                        }


                        await sleep(250);
                    }


                } catch (err) {

                    console.log(
                        `   ❌ ERROR OBTENIENDO MIEMBROS: ${
                            err?.message || err
                        }`
                    );
                }
            }


            // ==================================================
            // ESPERA
            // ==================================================

            const interval =
                Math.max(
                    5,
                    Number(
                        config.watch?.intervalSeconds
                    ) || 30
                ) * 1000;


            console.log("");

            console.log(
                `⏱️ PRÓXIMA REVISIÓN EN ${
                    interval / 1000
                } SEGUNDOS...`
            );

            console.log("");


            await sleep(interval);
        }


    } finally {

        try {
            await client.disconnect();
        } catch {}
    }
}


// ======================================================
// START
// ======================================================

main().catch(err => {

    console.error("");

    console.error(
        "❌ VIGILANTE:",
        err?.message || err
    );

});
