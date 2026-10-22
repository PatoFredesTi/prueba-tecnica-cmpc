# CMPC Libros

Aplicación interna para administrar un catálogo de libros, implementada a partir del BRD de CMPC / BYC Tecnología del 22 de octubre de 2026.

React + TypeScript · NestJS + TypeScript · PostgreSQL 16 · Prisma 6.

## Inicio con Docker

Requisitos: Docker Desktop o Docker Engine con Compose v2+, puertos **8080** y **55439** disponibles. No necesitas Node instalado para ejecutar los contenedores.

```sh
# Desde el directorio del repositorio
cp .env.example .env
docker compose up --build
```

En una primera ejecución, la API espera a PostgreSQL, aplica las migraciones y ejecuta el seed. El frontend espera a que la API esté saludable.

- Aplicación: http://localhost:8080
- Swagger: http://localhost:8080/api/docs
- OpenAPI JSON: http://localhost:8080/api/docs-json
- Salud API y BD: http://localhost:8080/api/v1/health

La cuenta se configura con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Con el archivo de ejemplo:

| Campo      | Valor de demostración |
| ---------- | --------------------- |
| Correo     | `admin@cmpc.local`    |
| Contraseña | `DemoCMPC2026!`       |

Son valores exclusivamente locales. `.env` está ignorado por Git. El seed no cambia contraseñas existentes, no duplica libros y no restaura registros eliminados. Incluye 24 títulos con precios y disponibilidad ficticios; las portadas iniciales son composiciones tipográficas, no fotografías de las ediciones.

```sh
docker compose up -d                 # Segundo plano
docker compose logs -f api           # Diagnóstico
docker compose down                 # Detener conservando datos
```

Los volúmenes `postgres_data` y `book_uploads` sobreviven a reinicios y a `down`. No uses `down -v` si quieres conservar información. PostgreSQL se publica únicamente en loopback, en 55439 para evitar conflictos habituales con otras bases locales. Puedes modificar `DB_PORT` y `WEB_PORT` en `.env`; ajusta también `DATABASE_URL` para desarrollo local si cambias el puerto de BD.

## Desarrollo sin contenedores para las aplicaciones

Requisitos: Node.js 22.12+ (se recomienda la versión LTS 22), npm y PostgreSQL. Puedes usar solo el servicio `db` de Compose.

```sh
cp .env.example .env
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

- Autenticación JWT con expiración, emisor y audiencia; contraseñas bcrypt; guard global con excepciones explícitas para login, refresh, logout y health.
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

Al cerrar sesión se revoca la sesión persistente en PostgreSQL y se elimina su cookie. El JWT de acceso se descarta, pero un token de acceso copiado continúa siendo válido hasta expirar: no hay lista de revocación de JWT. Las imágenes son públicas por URL aleatoria bajo `/uploads`; el catálogo y sus datos requieren JWT. Los archivos de libros retirados se conservan para no perder el historial asociado.

## Límites y pendientes para producción

- No se incluyen HTTPS/certificados, limitación de intentos de login, revocación inmediata de JWT de acceso, backups ni rotación automática de secretos. Son adecuaciones productivas explícitas del BRD.
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

El JWT de acceso sigue en memoria. Al iniciar la aplicación, `POST /api/v1/auth/refresh` recupera usuario y un nuevo JWT usando la cookie `cmpc_session` (HttpOnly, SameSite=Strict). La sesión dura 7 días desde el login, sin extenderse con cada recarga. PostgreSQL guarda únicamente el hash del secreto. No se guardan tokens en localStorage ni sessionStorage. Se necesita iniciar sesión una vez después de actualizar desde la versión anterior.

La migración `202610220002_auth_sessions` se aplica con `npm run db:migrate` en desarrollo y automáticamente al iniciar Docker. Usa `SESSION_COOKIE_SECURE=false` para HTTP local y `true` al desplegar con HTTPS. Las peticiones de autenticación requieren `X-Session-Request: 1`; el cliente web y Swagger ya la contemplan. Frontend y API comparten origen mediante el proxy de Vite/Nginx.
