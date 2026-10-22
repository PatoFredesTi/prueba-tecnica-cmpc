# Revisión de seguridad — 22 de octubre de 2026

Estado: correcciones aplicadas y verificadas localmente. Se conserva a continuación el hallazgo original y su evidencia de cierre. No se modificaron libros de negocio; las pruebas E2E agregan su propio libro y lo retiran al terminar.

## Correcciones y evidencia

| ID     | Hallazgo original                                                   | Corrección                                                                                                                                                    | Comprobación                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | La clave JWT publicada permitía fabricar tokens.                    | Clave local rotada, generador por instalación y rechazo de claves de ejemplo al iniciar. JWT HS256 con emisor/audiencia y sesión vigente asociada al usuario. | La petición firmada con la clave anterior devuelve 401; se rechazan algoritmo, audiencia y sesión incorrectos.                                                                                      |
| SEC-02 | Contraseñas de administrador y PostgreSQL iguales a las publicadas. | Rotación real del hash del usuario y del rol PostgreSQL, además de .env. Se revocaron sesiones existentes. Ejemplo sin secretos utilizables.                  | Contraseña anterior del administrador: 401. Conexión PostgreSQL con contraseña anterior: rechazada. Nuevas credenciales operativas mediante integración y navegador.                                |
| SEC-03 | Intentos de login ilimitados.                                       | NestJS Throttler: login 10/min/IP, refresh 60 y logout 30. Proxy explícito; Nginx sobrescribe X-Forwarded-For.                                                | Exceso de login produce 429 con Retry-After, antes de ejecutar la autenticación. Variar X-Forwarded-For no evade el límite en acceso directo.                                                       |
| SEC-04 | JWT reutilizable después de logout.                                 | Cada token incorpora sid; el guard consulta sesión y usuario en PostgreSQL.                                                                                   | Reutilización después de logout: 401, comprobada por HTTP y Chrome.                                                                                                                                 |
| SEC-05 | Portadas públicas por URL.                                          | Controlador autenticado, validación de nombre y vínculo a un libro activo. Blobs en frontend con Bearer, sin tokens en URLs.                                  | Anónimo: 401; autenticado: imagen real; libro retirado: 404. /uploads ya no sirve archivos. Chrome muestra la portada correctamente.                                                                |
| SEC-06 | Configuración HTTP/cookie no Secure utilizable fuera de local.      | APP_ENV=production exige cookie Secure, orígenes HTTPS explícitos y credenciales propias. Local continúa funcionando con HTTP.                                | Pruebas de configuración rechazan combinaciones inseguras. El certificado y la terminación TLS de un dominio público requieren configuración de despliegue; no se publicaron servicios en Internet. |
| SEC-07 | Swagger público sin distinción de entorno.                          | Deshabilitado en producción; configurable localmente.                                                                                                         | Contenedor temporal en producción devuelve 404 en /api/docs y /api/docs-json incluso con SWAGGER_ENABLED=true. Swagger local funciona en Chrome.                                                    |
| SEC-08 | HTML de React sin CSP ni protección contra enmarcado.               | Nginx aplica CSP, X-Frame-Options: DENY y Permissions-Policy. API con Cache-Control: no-store.                                                                | E2E comprueba cabeceras y ausencia de infracciones CSP en el recorrido de catálogo, imágenes y formularios.                                                                                         |
| SEC-09 | Rutas ocultas devolvían HTML y Nginx anunciaba versión.             | Bloqueo explícito de rutas ocultas y server_tokens off.                                                                                                       | /.env y /.git/config: 404. Cabecera Server sin número de versión.                                                                                                                                   |

## Reproducibilidad y ubicación

- `scripts/setup-env.mjs`: genera .env con claves independientes, permisos 0600 y sin sobrescribir una configuración existente. Verificado en un directorio temporal desde cero y en una segunda ejecución.
- `scripts/rotate-local-secrets.mjs`: rota credenciales persistidas de una instalación local y revoca sesiones. Guarda una configuración pendiente privada antes de cambiar PostgreSQL para permitir recuperación ante fallos.
- `apps/api/src/security/config.ts`: validación de configuración y separación entre evaluación local y producción.
- `apps/api/src/auth/auth.ts`: JWT, limitación de solicitudes y comprobación de sesión.
- `apps/api/src/files/files.controller.ts`: autorización de portadas.
- `apps/web/nginx.conf`: cabeceras, rutas ocultas, aislamiento del puerto y cabecera de proxy.
- `tests/e2e/security.spec.ts`: regresiones de configuración pública y clave anterior.

Ninguna de las nuevas claves revisadas aparece en los archivos versionados actuales ni en los assets JS/CSS servidos por el frontend. .env está ignorado por Git; .dockerignore excluye .env y sus variantes. La auditoría de dependencias npm tras instalar Throttler reportó cero vulnerabilidades conocidas. Esto no certifica ausencia de otros secretos o fallos.

## Accesibilidad esperada

| Recurso                                             | Acceso                                                          |
| --------------------------------------------------- | --------------------------------------------------------------- |
| Catálogo, detalle, CRUD, CSV y catálogos auxiliares | JWT y sesión vigentes.                                          |
| Portadas de libros activos                          | JWT y sesión vigentes.                                          |
| Login                                               | Público, con validación, cabecera CSRF y límite de solicitudes. |
| Refresh/logout                                      | Cookie de sesión y cabecera CSRF; límites propios.              |
| Health                                              | Público; estado básico de disponibilidad.                       |
| Swagger/OpenAPI                                     | Disponibles en evaluación local; deshabilitados en producción.  |
| .env, .git y /uploads                               | No se sirven.                                                   |

Web y PostgreSQL permanecen publicados solo en 127.0.0.1. El puerto de API no se publica al host. Fuera de Docker, NestJS escucha en loopback por defecto. No se auditaron túneles externos ni una instalación pública.

## Límites operativos

- TLS de un dominio público, backups y gestión/rotación programada de secretos dependen del despliegue. Este trabajo no publicó la aplicación.
- El limitador es por proceso; para varias réplicas requiere almacenamiento compartido. Reiniciar el proceso reinicia contadores.
- La comprobación de sesión requiere PostgreSQL disponible; ante fallos se rechaza la operación con error de servidor. Una solicitud que ya fue autorizada antes de logout puede terminar.
- La cookie de recuperación tiene vencimiento absoluto de siete días; no se implementó detección de reutilización mediante rotación en cada refresh. Los JWT sí quedan revocados al eliminar la sesión.
- CSP permite estilos inline usados por la interfaz, pero no scripts inline. No se realizó una auditoría externa WCAG ni un pentest exhaustivo.
- No se escanearon imágenes Docker con un escáner de CVE ni todos los objetos históricos de Git. Las credenciales de ejemplo antiguas dejan de ser válidas en esta instalación.
- El workflow incorpora auditoría npm y E2E con Docker/Chromium; su ejecución remota requiere subir los cambios al repositorio. La evidencia reportada aquí es local.

## Relación con la evaluación

No puede garantizarse un 98/100 sin la rúbrica. La cobertura no equivale a una nota de seguridad. Además de los cierres anteriores, el formulario ahora valida con mode: onChange. Los resultados de pruebas y las métricas actuales están en testing.md y verification.json.

Referencias: [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) y [limitación de solicitudes en NestJS](https://docs.nestjs.com/security/rate-limiting).
