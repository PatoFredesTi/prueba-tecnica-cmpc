# Decisiones técnicas

## ADR-01 — Monolito modular

Se eligió NestJS modular y Prisma directo en servicios. El alcance no justifica microservicios, CQRS, bus de eventos ni repositorios que copien los métodos del ORM. La inyección permite sustituir persistencia y almacenamiento en tests.

## ADR-02 — PostgreSQL + Prisma

Esquema declarativo y cliente tipado para avanzar sin perder integridad referencial. Se agrega un `CHECK` de precio en SQL porque Prisma no lo expresa en su schema. Prisma 6 queda fijado por versión mayor; migrar a versiones posteriores requiere revisar configuración y adaptadores.

## ADR-03 — JWT en memoria y recuperación con cookie HttpOnly

JWT de duración configurable, bcrypt con coste 12, guard global. Se verifica firma, expiración, emisor y audiencia. La SPA no guarda tokens en localStorage ni sessionStorage. La decisión original de perder la sesión al refrescar se reemplazó a petición del usuario: un secreto aleatorio de 256 bits en cookie HttpOnly/SameSite=Strict permite obtener un nuevo JWT al iniciar la SPA. Su hash SHA-256 se almacena en AuthSession; caduca a los 7 días del login y se revoca al cerrar sesión. La duración es absoluta, sin renovación deslizante ni rotación en cada refresh, para permitir recargas concurrentes y múltiples pestañas. El login reemplaza la sesión previa del mismo navegador dentro de una transacción. Login elimina sesiones vencidas del usuario. Las rutas de autenticación exigen una cabecera no simple contra CSRF y responden con Cache-Control: no-store. La SPA usa el mismo origen vía proxy; Secure se activa por configuración en HTTPS. Si falla la red al recuperar o cerrar sesión, se informa el error y se permite reintentar. Esto no añade revocación de JWT de acceso ya emitidos.

## ADR-04 — Auditoría y bajas lógicas

Los cambios y logs comparten transacción. El API no expone escritura sobre auditoría. Se conservan snapshots completos del libro y relaciones, nunca passwords o JWT. No se implementa recuperación de libros retirados porque no fue solicitada.

## ADR-05 — Precio decimal

Entrada y salida como string decimal y almacenamiento `Decimal(12,2)`. El servidor no convierte montos a float. La UI utiliza Number únicamente para presentación; envía el string validado. No se soportan monedas múltiples ni cantidades de ejemplares.

## ADR-06 — Archivo local intercambiable

`ImageStoragePort` permite adaptar S3 en el futuro. El adaptador actual decodifica con Sharp, rechaza contenido inválido, elimina metadata al convertir a WebP, limita píxeles y asigna un nombre UUID. No confía en extensión ni nombre original. Los archivos tienen URLs públicas aleatorias, documentado como supuesto local.

## ADR-07 — CSV en lotes

Generador asíncrono + `StreamableFile`: memoria acotada a 500 registros en API. No se aplica página de UI. Se agregan BOM UTF-8 y escape CSV; prefijo apóstrofo para texto con comienzo de fórmula, incluyendo espacios iniciales. `OFFSET` simplifica la primera entrega; snapshot/cursor es una mejora necesaria para consistencia bajo cambios concurrentes.

## ADR-08 — Catálogos normalizados

NFKC, trim, espacios colapsados y minúsculas. Se preservan acentos y primera forma de presentación. Un autor principal por libro; N:M solo cuando exista un requerimiento real. Se permite crear valores desde el formulario con `datalist` nativo.

## ADR-09 — Diseño local y reproducible

La aplicación se ejecuta con Docker Compose y no depende de servicios de hosting. La interfaz usa ilustraciones de portadas creadas con CSS y texto hasta cargar una imagen; no necesita descargar recursos de terceros.

## ADR-10 — Dependencias y compilación

Lockfile versionado para `npm ci`, Node 22 en Docker. Las versiones mayores de herramientas se conservan deliberadamente. Los overrides de `deepmerge-ts` y `js-yaml` tienen como propósito evitar avisos conocidos en dependencias transitivas; su efecto y el resultado de `npm audit` deben comprobarse en el lockfile y en `docs/testing.md`, no suponerse. La compilación de Nest usa `tsc` para conservar metadatos de decoradores.
