# CMPC Libros

Aplicación interna para administrar un catálogo de libros, implementada a partir del BRD de CMPC / BYC Tecnología del 22 de octubre de 2026.

React + TypeScript · NestJS + TypeScript · PostgreSQL 16 · Prisma 6.

## Inicio con Docker

Requisitos: Docker Desktop o Docker Engine con Compose v2+, puertos **8080** y **55439** disponibles. No necesitas Node instalado para ejecutar los contenedores. Para generar `.env` sin Node local, usa `docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" -w /workspace node:22-bookworm-slim node scripts/setup-env.mjs` en lugar de `npm run setup:env`.

```sh
# Desde el directorio del repositorio
npm run setup:env
docker compose up --build
```

En una primera ejecución, la API espera a PostgreSQL, aplica las migraciones y ejecuta el seed. El frontend espera a que la API esté saludable.

- Aplicación: http://localhost:8080
- Swagger: http://localhost:8080/api/docs
- OpenAPI JSON: http://localhost:8080/api/docs-json
- Salud API y BD: http://localhost:8080/api/v1/health

La cuenta se configura con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. `npm run setup:env` genera claves aleatorias independientes para JWT, PostgreSQL y administrador. El correo inicial es `admin@cmpc.local`; consulta la contraseña en tu archivo `.env`. El generador no sobrescribe un `.env` existente y no imprime secretos.

`.env` está ignorado por Git y excluido de Docker junto con sus variantes. El seed no cambia contraseñas existentes, no duplica libros y no restaura registros eliminados. Incluye 24 títulos con precios y disponibilidad ficticios; las portadas iniciales son composiciones tipográficas.

```sh
docker compose up -d                 # Segundo plano
docker compose logs -f api           # Diagnóstico
docker compose down                 # Detener conservando datos
```

Los volúmenes `postgres_data` y `book_uploads` sobreviven a reinicios y a `down`. No uses `down -v` si quieres conservar información. PostgreSQL se publica únicamente en loopback, en 55439 para evitar conflictos habituales con otras bases locales. Puedes modificar `DB_PORT` y `WEB_PORT` en `.env`; ajusta también `DATABASE_URL` para desarrollo local si cambias el puerto de BD.

## Desarrollo sin contenedores para las aplicaciones

Requisitos: Node.js 22.12+ (se recomienda la versión LTS 22), npm y PostgreSQL. Puedes usar solo el servicio `db` de Compose.

```sh
npm run setup:env
npm ci
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:3000/api/v1. Swagger: http://localhost:3000/api/docs. Vite redirige `/api` y `/uploads` a NestJS. La API se compila con TypeScript para conservar los metadatos de inyección de NestJS y se reinicia al cambiar el código.

Si ejecutaste todos los servicios en Docker, detén `api` y `web` antes de desarrollar localmente para no confundir instancias. Los scripts de migración, seed y API leen el `.env` de la raíz; una variable ya presente en el entorno tiene prioridad.

## Recorrido de demostración

1. Inicia sesión y consulta el catálogo.
2. Combina género, autor, editorial y disponibilidad. Busca por título, autor o editorial; la consulta espera 350 ms después de la última pulsación.
3. Abre **Ordenar**, agrega criterios y cambia dirección. El orden se aplica según prioridad, con ID como desempate.
4. Crea un libro. Autor, editorial y género admiten valores existentes o nuevos; se normalizan en el servidor.
5. Abre el detalle, edita precio/disponibilidad y carga una portada JPEG, PNG o WebP de hasta 5 MB.
6. Exporta CSV: incluye todos los libros activos que coinciden con los filtros, independientemente de la página.
7. Elimina un libro con confirmación. Desaparece del catálogo y conserva su registro y auditoría.
8. Cierra sesión. Al recargar con F5, la sesión se recupera automáticamente mediante una cookie HttpOnly (hasta 7 días desde el login). Cerrar sesión revoca esa recuperación.

## Verificación

```sh
npm run build
npm run lint
npm run format:check
npm test
npm run test:cov
```

Cobertura y evidencia medidas: [docs/testing.md](docs/testing.md). Los informes detallados se regeneran en `apps/api/coverage` y `apps/web/coverage`; no se versionan artefactos completos de cobertura.

Pruebas de integración con PostgreSQL (aplica la migración primero):

```sh
npm run db:migrate
npm run test:integration
```

La suite usa `DATABASE_URL`, crea un usuario y registros con un prefijo único y elimina solamente sus fixtures. No utiliza `TRUNCATE`. Ejecuta esta suite contra una base de desarrollo, no contra producción. Si no hay `DATABASE_URL`, las pruebas de integración se omiten explícitamente.

Prueba de navegador contra Compose en ejecución:

```sh
npx playwright install chromium
npm run test:e2e
```

Si tienes Google Chrome instalado, puedes usar `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` sin descargar Chromium. `E2E_BASE_URL` permite cambiar la URL. La prueba recorre el flujo completo y genera capturas en `docs/screenshots/`; crea un libro de prueba y lo retira lógicamente al finalizar.

## Funcionalidades implementadas

- Autenticación JWT con expiración, emisor y audiencia; contraseñas bcrypt; guard global con excepciones explícitas para login, refresh, logout y health. Los JWT incluyen una sesión activa comprobada en PostgreSQL; logout revoca su acceso inmediatamente en las solicitudes posteriores.
- CRUD real contra PostgreSQL, detalle, baja lógica, catálogos normalizados y auditoría en transacciones.
- Búsqueda insensible a mayúsculas, cuatro filtros AND, orden múltiple permitido y paginación en servidor.
- Formularios con React Hook Form + Zod, validación adicional en DTO, errores y estados de carga/vacío/reintento.
- Imágenes verificadas por contenido, límite de 5 MB y de píxeles, conversión a WebP y persistencia en volumen; limpieza al fallar la transacción.
- CSV UTF-8 con BOM, escape de campos, mitigación de fórmulas, autenticación y generación por lotes de 500 registros.
- Interceptor `data/meta`, errores uniformes, `requestId` generado por servidor y logs sin cuerpos ni credenciales.
- Interfaz responsive con vista de lista/cuadrícula, enlaces, etiquetas, foco visible y confirmación modal nativa.
- Migración SQL con `CHECK price >= 0`, seed idempotente, Swagger, Docker Compose y suites de pruebas.

## Alcance y decisiones

La disponibilidad es booleana, no una cantidad. Cada libro tiene un autor principal, una editorial y un género. Los precios son `Decimal(12,2)` en CLP; la API recibe y devuelve strings decimales. Los nombres usan normalización NFKC, minúsculas y espacios colapsados; se conservan acentos y el primer nombre de presentación guardado.

No hay registro público, préstamos, reservas, ventas ni permisos granulares. La gestión de usuarios está limitada al seed y autenticación; no se introduce un módulo HTTP de usuarios sin casos de uso.

Al cerrar sesión se revoca la sesión en PostgreSQL y se elimina su cookie: el JWT asociado deja de autorizar solicitudes posteriores. Las portadas se sirven por `/api/v1/files/:filename` con Bearer, solo si pertenecen a un libro activo. El frontend las descarga como blobs sin poner tokens en URLs. Las rutas antiguas `/uploads` están cerradas; las referencias antiguas se resuelven por la nueva ruta protegida. Los archivos de libros retirados se conservan físicamente para el historial, pero no se entregan desde la API.

El login admite 10 intentos por minuto e IP; refresh 60 y logout 30, con respuesta 429 y Retry-After. El almacenamiento del limitador es local al proceso. Docker confía únicamente en un salto de proxy y Nginx sobrescribe X-Forwarded-For; en desarrollo no se confía en cabeceras de proxy.

## Límites y pendientes para producción

- No se incluyen certificados ni un dominio público. `APP_ENV=production` exige orígenes HTTPS, cookie Secure y contraseñas propias; deshabilita Swagger. El TLS debe terminar en un proxy de despliegue configurado por el operador. Faltan backups automatizados y rotación programada de secretos.
- Para múltiples réplicas, el limitador de autenticación requiere almacenamiento compartido (por ejemplo Redis); reiniciar el proceso reinicia sus contadores.
- El CSV utiliza lotes con `OFFSET`; una edición concurrente durante una exportación larga puede mover filas entre lotes. Para una exportación contablemente consistente se requiere snapshot/cursor dedicado.
- La auditoría no tiene endpoints de modificación; un administrador de la base conserva capacidad de modificar tablas. No se presenta como almacenamiento WORM.
- La carga de archivos y SQL no forman una transacción distribuida. Se compensa el fallo de SQL; un corte abrupto del proceso puede dejar un archivo huérfano. Falta limpieza programada y proveedor de objetos para múltiples réplicas.
- El contenedor API conserva herramientas de migración/seed y dependencias de desarrollo. Separar una imagen de migración permitiría reducir la imagen runtime.
- La búsqueda usa `ILIKE`; no se han realizado benchmarks de gran volumen, pruebas de carga ni una auditoría externa de accesibilidad.
- Se documenta el resultado real de auditoría de dependencias y la verificación final en [docs/testing.md](docs/testing.md).

## Documentación

- [Arquitectura](docs/architecture.md)
- [Modelo relacional](docs/data-model.md)
- [Decisiones técnicas](docs/decisions.md)
- [Contratos REST](docs/api.md)
- [Pruebas y evidencia](docs/testing.md)
- [Trazabilidad del BRD](docs/requirements.md)

La fecha límite de la prueba requiere confirmación con BYC: el BRD advierte la inconsistencia entre «jueves 24» y el calendario de octubre de 2026. Este repositorio no presupone un vencimiento corregido.

### Sesión al recargar

El JWT de acceso sigue en memoria y contiene el identificador de su sesión. Al iniciar la aplicación, `POST /api/v1/auth/refresh` recupera usuario y un nuevo JWT usando la cookie `cmpc_session` (HttpOnly, SameSite=Strict). La sesión dura 7 días desde el login, sin extenderse con cada recarga. PostgreSQL guarda únicamente el hash del secreto. No se guardan tokens en localStorage ni sessionStorage. Se necesita iniciar sesión una vez después de actualizar desde la versión anterior.

La migración `202610220002_auth_sessions` se aplica con `npm run db:migrate` en desarrollo y automáticamente al iniciar Docker. Usa `SESSION_COOKIE_SECURE=false` para HTTP local y `true` al desplegar con HTTPS. Las peticiones de autenticación requieren `X-Session-Request: 1`; el cliente web y Swagger ya la contemplan. Frontend y API comparten origen mediante el proxy de Vite/Nginx.

### Endurecimiento y rotación local

`npm run security:rotate-local` rota JWT, la contraseña del administrador existente y la del rol PostgreSQL de la base local, y revoca todas las sesiones. Es una operación explícita de mantenimiento; genera los valores sin mostrarlos y actualiza `.env`. Después ejecuta `docker compose up -d --build` para recrear los contenedores con la configuración nueva. Cambiar únicamente el `.env` no modifica contraseñas ya persistidas en la base.

La rotación guarda previamente `.env.rotation-pending` con permisos privados. Si falla, conserva ese archivo y `.env` para revisar qué transacción se confirmó; el comando no los sobreescribe a ciegas. No uses este comando para una base remota o producción.

`APP_ENV=local` es el modo de evaluación, incluso dentro del contenedor con `NODE_ENV=production`. `SWAGGER_ENABLED=false` permite ocultar Swagger también localmente. En producción está deshabilitado independientemente de esa variable. `HOST=127.0.0.1` es el valor predeterminado fuera de Docker; Compose utiliza la interfaz interna del contenedor sin publicar el puerto API.

Nginx agrega CSP, X-Frame-Options y Permissions-Policy al frontend, oculta su versión y rechaza rutas ocultas. Las respuestas API llevan Cache-Control: no-store. Consulta [la revisión de seguridad](docs/security-review.md) para evidencia y límites restantes.
