# Entorno de pruebas (staging local)

Yaa POS completo funcionando contra los **emuladores locales de Firebase**
(Auth, Firestore y Storage). No usa el proyecto de producción, no genera
cargos y no necesita cuenta de Google.

## Requisitos (una vez)
- Node 20 o superior.
- Java 11 o superior (lo usan los emuladores): <https://adoptium.net>
- Dependencias:
  ```bash
  npm install
  npm install --prefix tests/rules
  ```

## Uso
1. Emuladores (deje esta terminal abierta). Panel visual en <http://127.0.0.1:4000>:
   ```bash
   npm run emulators
   ```
   Para continuar con los datos de la sesión anterior: `npm run emulators:resume`.
2. Datos de prueba (solo la primera vez, con emuladores vacíos):
   ```bash
   npm run seed:staging
   ```
   Crea la Empresa A (sucursales Central y Norte, y un cajero restringido a
   Norte) y la Empresa B. Las contraseñas quedan en `staging/credentials.local.json`.
3. La app en modo pruebas, en <http://localhost:3100>:
   ```bash
   npm run dev:staging
   ```
   La app muestra «MODO PRUEBAS» abajo a la derecha y «[PRUEBAS]» en el título.

## Protecciones
- Con `VITE_USE_EMULATORS=true` la app usa un proyecto falso `demo-yaa-pos`:
  cualquier llamada que no vaya a un emulador falla en vez de llegar a producción.
- `npm run build` se niega a compilar si `VITE_USE_EMULATORS=true`.
- No hay `.firebaserc`: ningún comando `firebase deploy` apunta a un proyecto
  por defecto. Desplegar exige escribir el proyecto a mano.
- `storage.emulator.rules` son reglas solo para el emulador; no son las de producción.

## Pruebas automáticas
```bash
npm run test:unit                       # cálculos (sin Firebase)
cd tests/rules && npm test              # reglas de Firestore en el emulador
```
