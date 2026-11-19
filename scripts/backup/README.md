# Respaldos de Yaa POS (Fase 0)

Esta guía la **ejecuta el dueño del proyecto** con su propia cuenta de Google Cloud.
Nada de esto se ejecutó todavía en producción. Cada paso indica si genera cargos.

- Proyecto: `gen-lang-client-0858502482`
- Base de Firestore: `ai-studio-yaapos-acf1b9d4-de65-4b12-9ecf-bbbe308c617d` (base **con nombre**: no tiene cuota gratuita; cada lectura y escritura se cobra)
- Bucket de Storage: `gen-lang-client-0858502482.firebasestorage.app`

Precios de referencia (verificar en <https://cloud.google.com/firestore/pricing> para la región de la base):
lecturas ≈ USD 0.03 / 100,000 · escrituras ≈ USD 0.09 / 100,000 · Cloud Storage estándar ≈ USD 0.02–0.026 por GB al mes.

En los comandos, reemplace:
- `REGION`: la región de la base (Consola de Firebase → Firestore → pestaña de la base).
- `BUCKET_RESPALDOS`: un nombre nuevo, por ejemplo `yaa-pos-respaldos-0858502482`.

```bash
PROYECTO=gen-lang-client-0858502482
BASE=ai-studio-yaapos-acf1b9d4-de65-4b12-9ecf-bbbe308c617d
```

---

## 0. Preparación (sin costo)

1. Instalar Google Cloud CLI: <https://cloud.google.com/sdk/docs/install>
2. Iniciar sesión y elegir el proyecto:
   ```bash
   gcloud auth login
   gcloud config set project $PROYECTO
   ```
3. Ver la región y el estado de la base (solo lectura):
   ```bash
   gcloud firestore databases describe --database=$BASE
   ```
4. Ver cuántos datos hay: Consola de Firebase → Firestore → pestaña **Uso**. Con ese número se calcula el costo de los pasos siguientes.
5. Crear **alertas de presupuesto**: Consola de Google Cloud → Facturación → Presupuestos y alertas (por ejemplo, avisos al 50 %, 90 % y 100 % de USD 10/mes). Sin costo.

## 1. Protecciones de la base (recomendado, antes de cualquier migración)

| Paso | Comando | Costo |
|---|---|---|
| Protección contra borrado de la base | `gcloud firestore databases update --database=$BASE --delete-protection` | Gratis |
| Recuperación a un punto en el tiempo (PITR, 7 días) | `gcloud firestore databases update --database=$BASE --enable-pitr` | Se cobra el almacenamiento de las versiones guardadas. Ver «PITR» en la página de precios. |
| Respaldo automático diario (retención 14 días) | `gcloud firestore backups schedules create --database=$BASE --recurrence=daily --retention=14d` | Se cobra el almacenamiento de cada respaldo (por GiB al mes) y, solo si se usa, la restauración. |

Ver los respaldos creados:
```bash
gcloud firestore backups list --format="table(name, database, state, snapshotTime)"
```

## 2. Exportación manual antes de cada migración

La exportación es portable: se puede importar en otra base para comparar.

1. Crear el bucket de respaldos en la **misma región** de la base (una sola vez):
   ```bash
   gcloud storage buckets create gs://BUCKET_RESPALDOS --location=REGION --uniform-bucket-level-access
   ```
   Costo: almacenamiento del bucket (≈ USD 0.02–0.026 por GB al mes).
2. Exportar:
   ```bash
   gcloud firestore export gs://BUCKET_RESPALDOS/firestore/$(date +%Y-%m-%d_%H%M) --database=$BASE
   ```
   Costo: **1 lectura por documento exportado**. Con 200,000 documentos son unos USD 0.06, más el almacenamiento.
3. Comprobar que terminó:
   ```bash
   gcloud firestore operations list --database=$BASE --limit=3
   gcloud storage ls gs://BUCKET_RESPALDOS/firestore/
   ```

## 3. Verificar que el respaldo se puede restaurar (sin tocar producción)

Se restaura en una base **nueva y separada**. La base de producción no se modifica.

1. Informe de la base original (solo lectura):
   ```bash
   cd scripts/backup && npm install
   gcloud auth application-default login
   node count-documents.mjs --project $PROYECTO --database $BASE --out original.json
   ```
   Costo: unas pocas lecturas (consultas de agregación: 1 lectura por cada 1,000 documentos).
2. Crear una base de prueba e importar la exportación:
   ```bash
   gcloud firestore databases create --database=restauracion-prueba --location=REGION
   gcloud firestore import gs://BUCKET_RESPALDOS/firestore/<CARPETA_DE_LA_EXPORTACION> --database=restauracion-prueba
   ```
   Costo: **1 escritura por documento importado** (200,000 documentos ≈ USD 0.18), más el almacenamiento mientras la base exista.
3. Informe de la base restaurada y comparación:
   ```bash
   node count-documents.mjs --project $PROYECTO --database restauracion-prueba --out restaurado.json
   node compare-counts.mjs original.json restaurado.json
   ```
   Debe decir «Idénticos». Si hay diferencias, **no se avanza** con la migración.
4. Cuando el dueño lo decida, borrar la base de prueba (es solo una copia):
   ```bash
   gcloud firestore databases delete --database=restauracion-prueba
   ```

## 4. Respaldo de Storage (antes de la Fase 2, imágenes)

```bash
gcloud storage cp -r gs://gen-lang-client-0858502482.firebasestorage.app/users gs://BUCKET_RESPALDOS/storage/$(date +%Y-%m-%d)/
```
Costo: operaciones de copia (centavos) y almacenamiento de la copia.

Copiar también las **reglas de Storage actuales** (Consola de Firebase → Storage → Reglas) a un archivo `storage.rules` del repositorio, sin desplegarlas.

## 5. Recuperación

| Problema | Qué hacer |
|---|---|
| Se dañaron documentos hace menos de 7 días | PITR: leer la versión anterior o restaurar a una base nueva en un momento dado (`gcloud firestore databases restore --source-database=$BASE --snapshot-time=... --destination-database=...`, si la versión de gcloud lo admite) y copiar solo lo dañado. |
| Se necesita el estado de un día | Restaurar el respaldo diario en una base nueva: `gcloud firestore databases restore --source-backup=projects/$PROYECTO/locations/REGION/backups/<ID> --destination-database=restauracion-<fecha>`. |
| Antes de una migración | Usar la exportación del paso 2 (importarla en una base nueva y comparar). |
| Reglas o funciones desplegadas con error | Volver a desplegar la versión anterior guardada en git. |

Nunca se importa ni se restaura **sobre** la base de producción: siempre en una base nueva, para comparar y copiar solo lo necesario.
