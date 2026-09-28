const fs = require("fs");
const readline = require("readline");
const { execFileSync } = require("child_process");

const CONFIG_FILE = __dirname + "/apodos.json";

function loadConfig() {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));

    if (!config.general) {
        config.general = {
            enabled: false,
            nickname: "",
            groups: {}
        };
    }

    if (!config.general.groups) {
        config.general.groups = {};
    }

    if (!config.specific) {
        config.specific = {
            enabled: false,
            users: {}
        };
    }

    if (!config.specific.users) {
        config.specific.users = {};
    }

    if (!config.watch) {
        config.watch = {
            enabled: false,
            intervalSeconds: 30
        };
    }

    // Convertir grupos antiguos:
    // "123": true
    // a:
    // "123": { enabled: true, name: "" }
    for (const [id, value] of Object.entries(config.general.groups)) {
        if (typeof value === "boolean") {
            config.general.groups[id] = {
                enabled: value,
                name: ""
            };
        }
    }

    return config;
}

function saveConfig(config) {
    fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(config, null, 2) + "\n"
    );
}

function ask(rl, question) {
    return new Promise(resolve => rl.question(question, resolve));
}

function clear() {
    process.stdout.write("\x1b[2J\x1b[H");
}

function center(text, width = 58) {
    const length = [...text].length;

    if (length >= width) {
        return text;
    }

    const left = Math.floor((width - length) / 2);

    return " ".repeat(left) + text;
}

function boxLine(text = "") {
    const width = 58;

    const clean = [...String(text)].slice(0, width);
    const spaces = width - clean.length;

    return (
        "│" +
        clean.join("") +
        " ".repeat(Math.max(0, spaces)) +
        "│"
    );
}

function header(title) {
    const width = 58;

    console.log("");
    console.log("╔" + "═".repeat(width) + "╗");
    console.log(boxLine(""));
    console.log(boxLine(center(title, width)));
    console.log(boxLine(""));
    console.log("╠" + "═".repeat(width) + "╣");
}

function footer() {
    const width = 58;

    console.log("╚" + "═".repeat(width) + "╝");
    console.log("");
}

function estado(value) {
    return value
        ? "🟢 ACTIVADO"
        : "🔴 DESACTIVADO";
}

function obtenerGrupos(config) {
    return Object.entries(config.general.groups).map(
        ([id, data]) => {

            if (typeof data === "boolean") {
                return {
                    id,
                    enabled: data,
                    name: ""
                };
            }

            return {
                id,
                enabled: !!data.enabled,
                name: data.name || ""
            };
        }
    );
}

function guardarGrupo(config, id, name, enabled) {
    config.general.groups[id] = {
        name: name || "",
        enabled: !!enabled
    };
}

function mostrarMenu(config) {
    clear();

    const grupos = obtenerGrupos(config);

    const gruposActivos =
        grupos.filter(g => g.enabled).length;

    const gruposTotal =
        grupos.length;

    header("                 XD APODOS");

    console.log(boxLine(""));
    console.log(
        boxLine(`   GENERAL       ${estado(config.general.enabled)}`)
    );
    console.log(
        boxLine(`   ESPECÍFICOS   ${estado(config.specific.enabled)}`)
    );
    console.log(
        boxLine(`   VIGILANTE     ${estado(config.watch.enabled)}`)
    );
    console.log(boxLine(""));
    console.log(
        boxLine(`   GRUPOS:       ${gruposActivos}/${gruposTotal}`)
    );
    console.log(
        boxLine(
            `   ESPECÍFICOS:  ${Object.keys(config.specific.users).length}`
        )
    );
    console.log(boxLine(""));

    console.log("╠" + "═".repeat(58) + "╣");

    console.log(boxLine("   [1]  VER GRUPOS"));
    console.log(boxLine("   [2]  ACTIVAR / DESACTIVAR GENERAL"));
    console.log(boxLine("   [3]  AGREGAR / MODIFICAR GRUPO"));
    console.log(boxLine("   [4]  ELIMINAR GRUPO"));
    console.log(boxLine(""));
    console.log(boxLine("   [5]  VER APODOS ESPECÍFICOS"));
    console.log(boxLine("   [6]  AGREGAR / MODIFICAR ESPECÍFICO"));
    console.log(boxLine("   [7]  ELIMINAR ESPECÍFICO"));
    console.log(boxLine(""));
    console.log(boxLine("   [8]  APLICAR GENERAL AHORA"));
    console.log(boxLine("   [9]  APLICAR APODO A GRUPOS"));
    console.log(boxLine("   [10] ACTIVAR / DESACTIVAR VIGILANTE"));
    console.log(boxLine(""));
    console.log(boxLine("   [0]  SALIR"));

    footer();
}

async function pausa(rl) {
    await ask(
        rl,
        "\n        PRESIONA ENTER PARA CONTINUAR..."
    );
}

function parsearSeleccion(texto, total) {
    const numeros = texto
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
        .map(Number);

    const unicos = [...new Set(numeros)];

    if (!unicos.length) {
        return null;
    }

    for (const numero of unicos) {
        if (
            !Number.isInteger(numero) ||
            numero < 1 ||
            numero > total
        ) {
            return null;
        }
    }

    return unicos;
}

async function seleccionarGrupos(rl, config) {
    const grupos = obtenerGrupos(config);

    if (!grupos.length) {
        console.log("");
        console.log("   ❌ NO HAY GRUPOS REGISTRADOS.");
        return null;
    }

    console.log("");

    grupos.forEach((grupo, index) => {

        const nombre =
            grupo.name.trim() ||
            "SIN NOMBRE";

        console.log(
            `   [${index + 1}] ${nombre}`
        );

        console.log(
            `       ID: ${grupo.id}`
        );

        console.log(
            `       ${grupo.enabled ? "🟢 ACTIVADO" : "🔴 DESACTIVADO"}`
        );

        console.log("");
    });

    const seleccion = await ask(
        rl,
        "   SELECCIONA LOS GRUPOS (EJ: 1,3): "
    );

    const indices = parsearSeleccion(
        seleccion,
        grupos.length
    );

    if (!indices) {
        console.log("\n   ❌ SELECCIÓN INVÁLIDA.");
        return null;
    }

    return indices.map(numero => grupos[numero - 1]);
}

async function main() {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    while (true) {

        const config = loadConfig();

        mostrarMenu(config);

        const opcion = (
            await ask(
                rl,
                "        SELECCIONA UNA OPCIÓN: "
            )
        ).trim();

        // ==================================================
        // 1 - VER GRUPOS
        // ==================================================

        if (opcion === "1") {

            clear();

            header("GRUPOS REGISTRADOS");

            const grupos = obtenerGrupos(config);

            if (!grupos.length) {

                console.log(boxLine(""));
                console.log(
                    boxLine("   NO HAY GRUPOS CONFIGURADOS.")
                );
                console.log(boxLine(""));

            } else {

                grupos.forEach((grupo, index) => {

                    console.log(boxLine(""));

                    console.log(
                        boxLine(
                            `   [${index + 1}] ${grupo.name || "SIN NOMBRE"}`
                        )
                    );

                    console.log(
                        boxLine(`       ID: ${grupo.id}`)
                    );

                    console.log(
                        boxLine(
                            `       GENERAL: ${
                                grupo.enabled
                                    ? "🟢 ACTIVADO"
                                    : "🔴 DESACTIVADO"
                            }`
                        )
                    );
                });

                console.log(boxLine(""));
            }

            footer();

            await pausa(rl);
        }

        // ==================================================
        // 2 - ACTIVAR / DESACTIVAR GENERAL
        // ==================================================

        else if (opcion === "2") {

            config.general.enabled =
                !config.general.enabled;

            saveConfig(config);

            clear();

            header("GENERAL");

            console.log(boxLine(""));

            console.log(
                boxLine(
                    config.general.enabled
                        ? "   🟢 GENERAL ACTIVADO"
                        : "   🔴 GENERAL DESACTIVADO"
                )
            );

            console.log(boxLine(""));

            footer();

            await pausa(rl);
        }

        // ==================================================
        // 3 - AGREGAR / MODIFICAR GRUPO
        // ==================================================

        else if (opcion === "3") {

            clear();

            header("AGREGAR / MODIFICAR GRUPO");

            console.log(boxLine(""));
            console.log(
                boxLine("   ESCRIBE EL ID DEL GRUPO.")
            );
            console.log(boxLine(""));

            const id = (
                await ask(rl, "   ID: ")
            ).trim();

            if (!/^\d+$/.test(id)) {

                console.log(
                    "\n   ❌ ID INVÁLIDO."
                );

                await pausa(rl);
                continue;
            }

            const grupos = obtenerGrupos(config);

            const existente =
                grupos.find(g => g.id === id);

            console.log("");

            if (existente) {

                console.log(
                    `   NOMBRE ACTUAL: ${
                        existente.name || "SIN NOMBRE"
                    }`
                );

                console.log(
                    `   ESTADO ACTUAL: ${
                        existente.enabled
                            ? "ACTIVADO"
                            : "DESACTIVADO"
                    }`
                );

            } else {

                console.log(
                    "   GRUPO NUEVO."
                );
            }

            console.log("");

            const nombre = await ask(
                rl,
                "   NOMBRE DEL GRUPO: "
            );

            const nombreFinal =
                nombre.trim() ||
                existente?.name ||
                "";

            const respuesta = (
                await ask(
                    rl,
                    "   ¿ACTIVAR GENERAL EN ESTE GRUPO? [S/N]: "
                )
            )
                .trim()
                .toLowerCase();

            let enabled;

            if (respuesta === "s") {
                enabled = true;
            } else if (respuesta === "n") {
                enabled = false;
            } else if (existente) {
                enabled = existente.enabled;
            } else {
                enabled = false;
            }

            guardarGrupo(
                config,
                id,
                nombreFinal,
                enabled
            );

            saveConfig(config);

            console.log("");

            console.log(
                enabled
                    ? "   🟢 GRUPO GUARDADO Y ACTIVADO."
                    : "   🔴 GRUPO GUARDADO Y DESACTIVADO."
            );

            await pausa(rl);
        }

        // ==================================================
        // 4 - ELIMINAR GRUPO
        // ==================================================

        else if (opcion === "4") {

            clear();

            header("ELIMINAR GRUPO");

            const grupos = obtenerGrupos(config);

            if (!grupos.length) {

                console.log(
                    boxLine(
                        "   NO HAY GRUPOS."
                    )
                );

                footer();

                await pausa(rl);
                continue;
            }

            const seleccion =
                await seleccionarGrupos(
                    rl,
                    config
                );

            if (!seleccion) {
                await pausa(rl);
                continue;
            }

            const confirmar = (
                await ask(
                    rl,
                    "\n   ¿ELIMINAR LOS GRUPOS SELECCIONADOS? [S/N]: "
                )
            )
                .trim()
                .toLowerCase();

            if (confirmar === "s") {

                for (const grupo of seleccion) {
                    delete config.general.groups[grupo.id];
                }

                saveConfig(config);

                console.log(
                    "\n   ✅ GRUPOS ELIMINADOS."
                );

            } else {

                console.log(
                    "\n   ❌ OPERACIÓN CANCELADA."
                );
            }

            await pausa(rl);
        }

        // ==================================================
        // 5 - VER ESPECÍFICOS
        // ==================================================

        else if (opcion === "5") {

            clear();

            header("APODOS ESPECÍFICOS");

            const usuarios =
                Object.entries(
                    config.specific.users
                );

            if (!usuarios.length) {

                console.log(boxLine(""));
                console.log(
                    boxLine(
                        "   NO HAY APODOS ESPECÍFICOS."
                    )
                );
                console.log(boxLine(""));

            } else {

                usuarios.forEach(
                    ([id, nickname], index) => {

                        console.log(boxLine(""));

                        console.log(
                            boxLine(
                                `   [${index + 1}] ID: ${id}`
                            )
                        );

                        console.log(
                            boxLine(
                                `       APODO: ${nickname}`
                            )
                        );
                    }
                );

                console.log(boxLine(""));
            }

            footer();

            await pausa(rl);
        }

        // ==================================================
        // 6 - AGREGAR / MODIFICAR ESPECÍFICO
        // ==================================================

        else if (opcion === "6") {

            clear();

            header("AGREGAR / MODIFICAR ESPECÍFICO");

            const id = (
                await ask(
                    rl,
                    "\n   ID DEL USUARIO: "
                )
            ).trim();

            if (!/^\d+$/.test(id)) {

                console.log(
                    "\n   ❌ ID INVÁLIDO."
                );

                await pausa(rl);
                continue;
            }

            const nickname = await ask(
                rl,
                "   NUEVO APODO: "
            );

            if (!nickname.trim()) {

                console.log(
                    "\n   ❌ EL APODO NO PUEDE ESTAR VACÍO."
                );

                await pausa(rl);
                continue;
            }

            config.specific.users[id] =
                nickname.trim();

            saveConfig(config);

            console.log(
                "\n   ✅ APODO ESPECÍFICO GUARDADO."
            );

            await pausa(rl);
        }

        // ==================================================
        // 7 - ELIMINAR ESPECÍFICO
        // ==================================================

        else if (opcion === "7") {

            clear();

            header("ELIMINAR ESPECÍFICO");

            const id = (
                await ask(
                    rl,
                    "\n   ID DEL USUARIO: "
                )
            ).trim();

            if (!config.specific.users[id]) {

                console.log(
                    "\n   ❌ ESE USUARIO NO EXISTE."
                );

            } else {

                const confirmar = (
                    await ask(
                        rl,
                        "   ¿ELIMINAR ESTE APODO? [S/N]: "
                    )
                )
                    .trim()
                    .toLowerCase();

                if (confirmar === "s") {

                    delete config.specific.users[id];

                    saveConfig(config);

                    console.log(
                        "\n   ✅ APODO ELIMINADO."
                    );

                } else {

                    console.log(
                        "\n   ❌ OPERACIÓN CANCELADA."
                    );
                }
            }

            await pausa(rl);
        }

        // ==================================================
        // 8 - APLICAR GENERAL
        // ==================================================

        else if (opcion === "8") {

            clear();

            header("APLICAR GENERAL AHORA");

            if (!config.general.enabled) {

                console.log(boxLine(""));
                console.log(
                    boxLine(
                        "   🔴 EL GENERAL ESTÁ DESACTIVADO."
                    )
                );
                console.log(boxLine(""));

                footer();

                await pausa(rl);
                continue;
            }

            const grupos = obtenerGrupos(config)
                .filter(g => g.enabled);

            if (!grupos.length) {

                console.log(boxLine(""));
                console.log(
                    boxLine(
                        "   ❌ NO HAY GRUPOS ACTIVOS."
                    )
                );
                console.log(boxLine(""));

                footer();

                await pausa(rl);
                continue;
            }

            console.log(boxLine(""));
            console.log(
                boxLine(
                    `   GRUPOS ACTIVOS: ${grupos.length}`
                )
            );

            console.log(
                boxLine(
                    `   APODO: ${config.general.nickname}`
                )
            );

            console.log(boxLine(""));
            console.log(
                boxLine(
                    "   LOS ESPECÍFICOS TENDRÁN PRIORIDAD."
                )
            );
            console.log(boxLine(""));

            const confirmar = (
                await ask(
                    rl,
                    "   ¿APLICAR AHORA? [S/N]: "
                )
            )
                .trim()
                .toLowerCase();

            if (confirmar === "s") {

                console.log("");
                console.log(
                    "   🚀 APLICANDO..."
                );

                try {

                    execFileSync(
                        "node",
                        [
                            __dirname +
                            "/apply-general.mjs"
                        ],
                        {
                            stdio: "inherit"
                        }
                    );

                    console.log(
                        "\n   ✅ PROCESO TERMINADO."
                    );

                } catch (error) {

                    console.log(
                        "\n   ❌ OCURRIÓ UN ERROR."
                    );
                }

                await pausa(rl);
            }
        }

        // ==================================================
        // 9 - APLICAR APODO A GRUPOS
        // ==================================================

        else if (opcion === "9") {

            clear();

            header("APLICAR APODO A GRUPOS");

            console.log(boxLine(""));
            console.log(
                boxLine(
                    "   ESTA OPCIÓN NO MODIFICA EL GENERAL."
                )
            );
            console.log(
                boxLine(
                    "   SOLO APLICA EL APODO AHORA."
                )
            );
            console.log(boxLine(""));

            const seleccion =
                await seleccionarGrupos(
                    rl,
                    config
                );

            if (!seleccion) {

                await pausa(rl);
                continue;
            }

            console.log("");

            const nickname = await ask(
                rl,
                "   APODO NUEVO: "
            );

            if (!nickname.trim()) {

                console.log(
                    "\n   ❌ EL APODO NO PUEDE ESTAR VACÍO."
                );

                await pausa(rl);
                continue;
            }

            console.log("");

            console.log(
                "   GRUPOS SELECCIONADOS:"
            );

            seleccion.forEach(grupo => {

                console.log(
                    `   • ${grupo.name || "SIN NOMBRE"}`
                );

                console.log(
                    `     ID: ${grupo.id}`
                );
            });

            console.log("");

            console.log(
                `   APODO: ${nickname.trim()}`
            );

            const confirmar = (
                await ask(
                    rl,
                    "\n   ¿APLICAR? [S/N]: "
                )
            )
                .trim()
                .toLowerCase();

            if (confirmar !== "s") {

                console.log(
                    "\n   ❌ OPERACIÓN CANCELADA."
                );

                await pausa(rl);
                continue;
            }

            console.log("");
            console.log(
                "   🚀 APLICANDO..."
            );

            try {

                const gruposIds =
                    seleccion
                        .map(g => g.id)
                        .join(",");

                const env = {
                    ...process.env,
                    APODOS_GROUPS: gruposIds,
                    APODOS_NICKNAME:
                        nickname.trim()
                };

                execFileSync(
                    "node",
                    [
                        __dirname +
                        "/apply-selected.mjs"
                    ],
                    {
                        stdio: "inherit",
                        env
                    }
                );

                console.log(
                    "\n   ✅ APODO APLICADO."
                );

            } catch (error) {

                console.log(
                    "\n   ❌ OCURRIÓ UN ERROR."
                );
            }

            await pausa(rl);
        }

        // ==================================================
        // 10 - VIGILANTE
        // ==================================================

        else if (opcion === "10") {

            config.watch.enabled =
                !config.watch.enabled;

            saveConfig(config);

            clear();

            header("VIGILANTE");

            console.log(boxLine(""));

            console.log(
                boxLine(
                    config.watch.enabled
                        ? "   🟢 VIGILANTE ACTIVADO"
                        : "   🔴 VIGILANTE DESACTIVADO"
                )
            );

            console.log(boxLine(""));

            footer();

            await pausa(rl);
        }

        // ==================================================
        // 0 - SALIR
        // ==================================================

        else if (opcion === "0") {

            clear();

            rl.close();

            return;
        }

        else {

            console.log(
                "\n   ❌ OPCIÓN INVÁLIDA."
            );

            await pausa(rl);
        }
    }
}

main().catch(error => {

    console.error(
        "\n❌ ERROR:",
        error
    );

    process.exit(1);
});
