# BOTNOTAS
Bot de telegram para chequear si subieron una nueva nota a Autogestion 4

## Comandos

- `/test`               Responde Ok si el bot esta vivo
- `/addme`              Agrega el chat actual a la lista de chats que recibiran notificaciones del bot
- `/start`              Inicia el bot si estaba parado 
- `/stop`               Frena el bot si estaba funcionando
- `/status`             Indica el estado actual del bot
- `/loadmats`           Fuerza la carga de la lista de materias desde Autogestion
- `/check`              Fuerza el chequeo de notas nuevas
- `/setfrec <minutos>`  Cambia la frecuencia de chequeo de notas al valor pasado como argumento

## Instalación

1. Instalar Node.js
2. Ejecutar `npm install` detro del directorio del proyecto 
3. Ejecutar `npx tsc` detro del directorio del proyecto
4. Ejecutar el bot por primera vez con `node ./build/main.js`
5. Completar el archivo `config.json` con los datos que se piden
6. Ejecutar de nuevo el bot (`node ./build/main.js`)
7. Listo
