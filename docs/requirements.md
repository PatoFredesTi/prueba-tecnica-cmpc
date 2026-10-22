# Trazabilidad del BRD

| Requisito               | Implementación / evidencia                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| RF-01 Login JWT         | AuthService, JwtGuard, AuthProvider; tests de credenciales, expiración, 401, recuperación con F5 y logout |
| RF-02 Listado           | BookList; tabla y cuadrícula con relaciones, precio e imagen                                              |
| RF-03 Filtros           | BookFilters + bookWhere; integración de cuatro filtros simultáneos                                        |
| RF-04 Orden múltiple    | DTO whitelist + bookOrder + ID final; UI de prioridades                                                   |
| RF-05 Paginación        | BooksService.list, count transaccional y meta; página máxima acotada                                      |
| RF-06 Debounce          | useDebouncedValue 350 ms; prueba con timers y ausencia de solicitudes intermedias                         |
| RF-07/08 Alta y edición | BookForm, DTOs, catálogos upsert y Prisma                                                                 |
| RF-09 Imagen            | FileInterceptor, Sharp, ImageStoragePort, volumen y reintento en detalle                                  |
| RF-10 Detalle           | BookDetail + find con deletedAt null y 404                                                                |
| RF-11 Borrado lógico    | Confirmación nativa, deletedAt y auditoría transaccional                                                  |
| RF-12 CSV               | Generador por lotes, filtros compartidos, escape y mitigación de fórmulas                                 |
| RF-13 Auditoría         | CREATE/UPDATE/DELETE/IMAGE_UPDATE/LOGIN/LOGIN_FAILED y requestId                                          |
| RF-14 Errores           | Filtro global, ApiError y estados de UI                                                                   |
| RF-15 Interceptor       | Envelope data/meta; StreamableFile preservado                                                             |
| RF-16 Documentación     | README, Swagger, migración, seed, diagramas y ADR                                                         |
| RF-17 Tests             | Jest, Vitest/Testing Library, PostgreSQL real y Playwright; cifras en testing.md                          |

P0 y P1 están implementados. Las adecuaciones productivas y límites operativos se documentan en README. La validación visual y la cobertura medida tienen alcance explícito en testing.md; no se presume una certificación productiva ni de accesibilidad.
