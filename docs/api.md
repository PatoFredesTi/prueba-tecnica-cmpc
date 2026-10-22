# API REST

Prefijo `/api/v1`. Swagger en `/api/docs`, OpenAPI en `/api/docs-json`.

Todas las rutas salvo login, refresh, logout y health requieren `Authorization: Bearer <accessToken>`. Swagger y las imágenes son públicos en esta configuración local.

| Método | Ruta                   | Uso                                     |
| ------ | ---------------------- | --------------------------------------- |
| POST   | `/auth/login`          | `{ "email": "…", "password": "…" }`     |
| POST   | `/auth/refresh`        | Recuperar sesión usando cookie HttpOnly |
| POST   | `/auth/logout`         | Revocar sesión y eliminar cookie        |
| GET    | `/books`               | Listado filtrado y paginado             |
| GET    | `/books/export.csv`    | Todos los activos filtrados, streaming  |
| GET    | `/books/:id`           | Detalle de un libro activo              |
| POST   | `/books`               | Crear                                   |
| PATCH  | `/books/:id`           | Actualización parcial; null inválido    |
| DELETE | `/books/:id`           | Baja lógica                             |
| POST   | `/books/:id/image`     | Multipart, campo `file`                 |
| GET    | `/catalogs/authors`    | Autores ordenados                       |
| GET    | `/catalogs/publishers` | Editoriales ordenadas                   |
| GET    | `/catalogs/genres`     | Géneros ordenados                       |
| GET    | `/health`              | Estado de API y conectividad PostgreSQL |

Autenticación: los tres POST `/auth/login`, `/auth/refresh` y `/auth/logout` requieren `X-Session-Request: 1` (403 si falta). Login recibe credenciales y entrega `{ data: { accessToken, user }, meta }`; también establece `cmpc_session` en cookie HttpOnly/SameSite=Strict, limitada a `/api/v1/auth`, con vencimiento a los 7 días. Refresh no recibe cuerpo: valida la cookie y entrega el mismo formato con un nuevo JWT, sin ampliar la duración de la sesión. Cookie ausente, inválida, revocada o vencida produce 401. Logout no requiere un JWT vigente: revoca la cookie presentada y la elimina; es idempotente y devuelve `{ data: { loggedOut: true }, meta }`. Las respuestas de autenticación llevan `Cache-Control: no-store`. El secreto persistente nunca aparece en el JSON.

Crear libro:

```json
{
  "title": "Historia de Chile",
  "author": "Sergio Villalobos",
  "publisher": "Editorial Universitaria",
  "genre": "Historia",
  "price": "12990.00",
  "isAvailable": true
}
```

Los nombres crean o reutilizan catálogos. La API acepta precio como string decimal no negativo: hasta 10 enteros y 2 decimales. No se permite notación exponencial. Los campos desconocidos se rechazan con 400. No se admite cambiar relaciones enviando IDs en el formulario: las opciones de nombres se resuelven en el servidor.

Listado:

```text
GET /api/v1/books?page=1&pageSize=10&search=historia&available=true&sort=title:asc,price:desc
```

Filtros `authorId`, `publisherId`, `genreId` como UUID y `available` como `true`/`false`. Todos se combinan por AND. Búsqueda sobre título, autor y editorial con ILIKE. `page` entre 1 y 1.000.000; `pageSize` entre 1 y 100, por defecto 10. Campos de orden: title, price, createdAt, author, publisher; direcciones asc/desc; máximo cinco criterios. Se agrega ID ascendente como desempate.

```json
{
  "data": [{ "id": "uuid", "title": "Historia de Chile", "price": "12990", "isAvailable": true }],
  "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
}
```

El ejemplo abrevia relaciones y fechas. Prisma serializa decimales como strings exactos, sin garantizar ceros finales; `12990`, `12990.5` y `12990.50` representan montos válidos. CSV fija siempre dos decimales.

Otros éxitos JSON: `{ "data": resultado, "meta": { "requestId": "uuid" } }`. Los archivos CSV conservan su stream y cabecera `Content-Disposition`, sin envelope.

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Los datos ingresados no son válidos",
  "details": [{ "message": "price debe ser un monto no negativo con hasta dos decimales" }],
  "requestId": "uuid"
}
```

Errores de validación incluyen mensajes de class-validator; los campos de catálogo/formulario están identificados en esos mensajes. `requestId` también aparece en `X-Request-Id`. Los errores inesperados no devuelven stack ni detalles de PostgreSQL. CSV usa UTF-8, BOM y CRLF. Una imagen inválida produce 400 y un archivo superior al límite 413.
