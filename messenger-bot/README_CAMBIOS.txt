ACTUALIZACION MESSENGER-BOT — CONFIGURACION POR GRUPO

Esta actualización agrega configuración independiente para nombre y foto de cada grupo.

1. Haz una copia de seguridad de tu carpeta ~/messenger-bot.

2. Reemplaza estos archivos:
   index.js
   xd-control.cjs
   xd.json

3. Crea la carpeta:
   ~/messenger-bot/photos

4. Las fotos personalizadas se colocan dentro de:
   ~/messenger-bot/photos/

5. La foto anterior KAKADDI.jpg sigue siendo compatible si está en la raíz de ~/messenger-bot.

CONFIGURACION EN xd.json

Cada grupo tiene:
  active       = activa/desactiva el grupo completo
  nameEnabled  = activa/desactiva el cambio automático de nombre
  name         = nombre que se aplicará
  photoEnabled = activa/desactiva el cambio automático de foto
  photo        = archivo de foto que se usará

Ejemplo:
  "nameEnabled": true,
  "name": "Mi grupo",
  "photoEnabled": false,
  "photo": "otra.jpg"

Con esto el bot seguirá cambiando el nombre, pero no tocará la foto.

Para cambiar solo la foto:
  "nameEnabled": false,
  "photoEnabled": true,
  "photo": "nueva.jpg"

Para ambos:
  "nameEnabled": true,
  "photoEnabled": true

CONTROL INTERACTIVO

  cd ~/messenger-bot
  node xd-control.cjs

La opción 6 permite configurar el nombre y la foto de un grupo.

También se puede abrir un grupo directamente:
  node xd-control.cjs XD1

IMPORTANTE

No reemplaces cookies.json. Las cookies son credenciales privadas y no forman parte de esta actualización.
