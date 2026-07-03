# Endpoints Biblioteca Digital

Base URL local: `http://localhost:3000`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/` | Verifica que el backend responde. |
| GET | `/books` | Lista libros con autor y categoria. |
| GET | `/books/:id` | Obtiene un libro por ID. |
| POST | `/books` | Crea un libro. |
| PATCH | `/books/:id` | Actualiza un libro. |
| DELETE | `/books/:id` | Elimina un libro. |
| GET | `/books/authors/list` | Lista autores para formularios. |
| GET | `/books/categories/list` | Lista categorias para formularios. |
| GET | `/users` | Lista usuarios con rol. |
| GET | `/users/:id` | Obtiene un usuario por ID. |
| POST | `/users` | Crea un usuario. |
| PATCH | `/users/:id` | Actualiza un usuario. |
| DELETE | `/users/:id` | Elimina un usuario. |
| GET | `/loans` | Lista prestamos con usuario y libro. |
| GET | `/loans/:id` | Obtiene un prestamo por ID. |
| POST | `/loans` | Crea un prestamo. |
| PATCH | `/loans/:id` | Actualiza un prestamo. |
| DELETE | `/loans/:id` | Elimina un prestamo. |
| GET | `/roles` | Lista roles con permisos. |
| POST | `/roles` | Crea un rol. |
| GET | `/permissions` | Lista permisos. |
| POST | `/permissions` | Crea un permiso. |

## Railway

- Configura `DATABASE_URL` como variable de entorno.
- Build command recomendado: `npm install && npm run build && npm run db:migrate`
- Start command recomendado: `npm run start:prod`
- Seed manual: `npm run db:seed`
- No subas `.env`; ya esta cubierto por `.gitignore`.
