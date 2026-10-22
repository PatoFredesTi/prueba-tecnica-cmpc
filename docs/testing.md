# Pruebas y evidencia

Verificación local del 22 de octubre de 2026. Resumen legible por máquinas: [verification.json](verification.json).

## Resultados medidos

| Suite                                       | Resultado                                          |
| ------------------------------------------- | -------------------------------------------------- |
| API — Jest                                  | 84 pruebas aprobadas, 7 suites                     |
| Web — Vitest + Testing Library              | 42 pruebas aprobadas, 5 suites                     |
| Integración — NestJS HTTP + PostgreSQL real | 16 pruebas aprobadas                               |
| Navegador — Playwright + Google Chrome      | 3 flujos aprobados                                 |
| Compilación TypeScript y Vite               | Aprobada                                           |
| ESLint                                      | Aprobado                                           |
| Auditoría npm                               | 0 vulnerabilidades reportadas                      |
| Docker Compose                              | db, api y web iniciados; health de API/BD correcto |

Las pruebas del navegador comprobaron login, catálogo, búsqueda, filtros, orden múltiple, vista de cuadrícula, alta, edición, imagen real, descarga CSV, confirmación de eliminación, cierre de sesión y ausencia de errores JavaScript. La vista móvil de 390 px no presentó desbordamiento horizontal. Las capturas se generan automáticamente al repetir E2E.

## Cobertura

| Aplicación | Sentencias |  Ramas | Funciones | Líneas |
| ---------- | ---------: | -----: | --------: | -----: |
| API        |     95.29% | 95.32% |    96.15% | 94.97% |
| Web        |     95.61% |  91.3% |    93.51% | 97.51% |

Se exige un umbral global del 80% en las cuatro métricas de cada aplicación. La cifra no implica que todos los archivos superen individualmente 80%.

- API: se incluyen servicios, controladores, DTO, helpers y `setup.ts`. Se excluyen pruebas, `main.ts`, archivos de módulos y el adaptador de ciclo de vida `PrismaService`; los dos últimos se ejecutan en integración, fuera de este reporte unitario. Prisma generado, migraciones y seed quedan fuera de `src`.
- Web: se incluye `src/**/*.ts(x)`, excepto tests, setup de tests, entrada `main.tsx` y tipos sin lógica. JSX no equivale a una instrucción ejecutable por cada línea visual; se reportan las cuatro métricas reales del proveedor V8.
- Integración y navegador se informan por separado; no se suman artificialmente a la cobertura unitaria.

Los informes `coverage-summary.json`, `lcov.info` y HTML se regeneran con `npm run test:cov`. La cobertura mide ejecución de código, no prueba ausencia de defectos ni sustituye revisión de seguridad o accesibilidad.

## Casos significativos

- JWT válido, inválido, expirado y sin sujeto; login no revela si existe el correo.
- Recuperación de sesión al recargar, conservación de ruta y filtros, múltiples pestañas y logout que impide restaurarla; probado en Chrome tanto con Vite (5173) como Docker (8080).
- Cookie HttpOnly, caducidad absoluta, hash del secreto en PostgreSQL, rechazo sin cabecera CSRF y recuperación con reintento ante fallo de red.
- DTO rechaza precio negativo/exponencial, filtros inválidos, orden no permitido, null en PATCH y campos desconocidos.
- Cuatro filtros simultáneos, búsqueda insensible a mayúsculas y orden estable; total y filas comparten snapshot.
- Baja lógica excluida de detalle, listado y exportación.
- Cambio y auditoría comparten transacción; una FK inválida en auditoría revierte el alta real en PostgreSQL.
- Archivo falso con MIME de imagen rechazado; imagen válida recodificada y guardada; archivo nuevo limpiado al fallar SQL.
- CSV con comas, comillas, saltos, caracteres de fórmula y varios lotes; ignora página visible.
- Formulario conserva el libro si falla la imagen y permite reintentar desde el detalle.
- Búsqueda con timers falsos y verificación de ausencia de solicitudes por pulsación.

## Reproducción

```sh
npm ci
npm run db:generate
npm run lint
npm run build
npm run test:cov
# Con PostgreSQL disponible y .env configurado:
npm run db:migrate
npm run test:integration
# Con la aplicación Docker iniciada y Chromium instalado:
npm run test:e2e
```

En esta máquina se usó Google Chrome instalado con `PLAYWRIGHT_CHANNEL=chrome`, Node 24 para herramientas y Node 22 dentro de Docker. El lockfile se generó desde un directorio limpio para incluir dependencias opcionales de macOS y Linux. La primera compilación detectó la ausencia de un paquete nativo de Rollup; quedó corregida en el lockfile entregado.

`deepmerge-ts` 8 y `js-yaml` 4 se resuelven mediante overrides raíz. Se verificaron instalación limpia, compilación, suites y `npm audit`: cero vulnerabilidades en ese momento. Es una foto temporal del registro de avisos; los comandos permiten volver a comprobarlo.

## Alcance pendiente de verificación

No se ejecutaron pruebas de carga, navegadores Safari/Firefox, auditoría WCAG completa ni validación en un entorno público con TLS. El workflow de GitHub Actions incorpora auditoría npm y un job Docker/Chromium, pero esta revisión no lo ejecutó remotamente.

## Capturas

- [Acceso](screenshots/login.png)
- [Catálogo de escritorio](screenshots/catalogo.png)
- [Catálogo móvil](screenshots/catalogo-movil.png)

## Persistencia comprobada

Se recrearon los tres contenedores con `docker compose down` y `docker compose up -d --build`, sin eliminar volúmenes. Antes y después se conservaron 25 registros (24 activos, uno retirado por E2E) y una portada física. El seed no reactivó el libro retirado. Frontend, Swagger, OpenAPI, health y la imagen persistida devolvieron HTTP 200 después del reinicio. Las ejecuciones posteriores de E2E pueden agregar registros retirados y sus imágenes de prueba; no alteran los 24 libros activos de demostración.

## Verificación de seguridad posterior

Se comprobaron revocación de JWT después de logout, rechazo de tokens firmados con la clave publicada anterior, algoritmo/audiencia/sesión incorrectos, portadas privadas (incluido 404 al retirar el libro), límite de login 429 y cabeceras CSP del frontend. El flujo completo en Chrome no registró infracciones CSP.

Un contenedor temporal con APP_ENV=production y configuración HTTPS/Secure confirmó que /api/docs y /api/docs-json devuelven 404 incluso con SWAGGER_ENABLED=true. Esto valida el perfil de configuración, no un despliegue TLS público.

La rotación local se verificó contra credenciales persistidas: el login con la contraseña anterior devuelve 401 y PostgreSQL rechaza la contraseña anterior del rol. La generación inicial de secretos se comprobó en un directorio temporal, con valores independientes, permisos 0600 y conservación del archivo en una segunda ejecución. No se encontraron las claves nuevas revisadas entre archivos versionados ni assets servidos. Detalle y límites: [security-review.md](security-review.md).
