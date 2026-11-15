# Seguridad de la aplicación

Qué protege el sistema, con qué norma o guía se alinea, cómo comprobarlo y qué falta.
Normas de referencia: **Ley 1581 de 2012** y **Decreto 1377 de 2013** (principio de seguridad y confidencialidad), **Ley 576 de 2000** (reserva de la historia clínica), **OWASP ASVS** y **OWASP Top 10** (controles técnicos) y **NIST SP 800-63B** (contraseñas y sesiones).

## 1. Sesión y tokens

| Control | Qué hace | Dónde |
|---|---|---|
| Cookie HttpOnly | El navegador guarda la sesión en la cookie `ac_sesion` (`HttpOnly`, `SameSite=Lax`, `Secure` con HTTPS). El JavaScript de la página **no puede leerla**, así que un fallo de XSS no roba la sesión. El frontend ya no guarda el token. | `backend/src/utils/sesion.ts`, `frontend/src/services/api.js` |
| JWT fijado | Solo se acepta `HS256`, con emisor `animalcare` y audiencia `animalcare-web`. Se rechazan tokens de otra clave, sin emisor, con otro algoritmo y `alg: none`. | `auth.service.ts`, `auth.middleware.ts` |
| Vigencia corta | El token dura 2 horas (`JWT_EXPIRES_IN`). | `auth.service.ts` |
| Revocación | Cada usuario tiene `tokenVersion`; el JWT lo lleva (`tv`). Cambiar la contraseña, restablecerla o usar **Cerrar todas mis sesiones** lo sube y deja inválidos los tokens anteriores. La sesión desde la que se cambió la clave recibe una cookie nueva. | migración `20261114030000_token_version` |
| Cuenta bloqueada | Una cuenta suspendida, rechazada o eliminada pierde el acceso en la siguiente petición. | `auth.middleware.ts` |
| Clave de firma | El servidor no arranca si `JWT_SECRET` tiene menos de 32 caracteres, ni en producción con la clave de ejemplo. | `server.ts` |
| Clientes que no son navegador | Siguen pudiendo usar `Authorization: Bearer <token>` (scripts, pruebas). El token se devuelve en el cuerpo del login solo para ellos. | `auth.controller.ts` |

## 2. Protección de rutas

- **Todas** las rutas privadas pasan por `authenticate`; las de cada rol, además por `requireRole`. Las únicas públicas son `health`, `register`, `login`, `logout`, `forgot-password`, `reset-password`, `verify-email` y la documentación.
- Una prueba recorre todas las rutas registradas y comprueba que, sin sesión, responden 401 (`tests/seguridad.test.js`). Si alguien agrega una ruta privada sin proteger, la prueba falla.
- El identificador del usuario sale siempre del token, nunca del cuerpo ni de la URL. Los datos de otra persona responden 404 (no se revela que existen).

## 3. CSRF y CORS

- Con cookie, una petición que **cambia datos** (POST, PUT, PATCH, DELETE) debe venir de un origen autorizado (`CORS_ORIGIN`) o del propio sitio; si no, 403. `SameSite=Lax` cubre además el envío desde otros sitios.
- CORS solo permite los orígenes de `CORS_ORIGIN` y con credenciales.

## 4. Contraseñas

- Política NIST: **8 a 72 caracteres**, al menos una letra y un número, sin claves comunes (`password123`, `12345678`…). El máximo de 72 bytes existe porque bcrypt ignora lo que pase de ahí.
- **bcrypt con 12 rondas**; las claves guardadas con menos rondas se actualizan solas al iniciar sesión.
- El login tarda lo mismo si el correo no existe (se compara contra un hash falso) y responde el mismo mensaje: no permite averiguar qué correos están registrados.

## 5. Límites de peticiones

| Límite | Valor por defecto | Variable |
|---|---|---|
| Fallos de login por IP + correo | 5 cada 15 min | `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES` |
| Fallos de login por correo (desde cualquier IP) | 20 por hora | `LOGIN_MAX_PER_EMAIL` |
| Fallos de login por IP (cualquier correo) | 40 cada 15 min | `LOGIN_MAX_PER_IP` |
| Recuperación de contraseña | 5 por hora y correo | `FORGOT_MAX_REQUESTS` |
| Altas de cuenta por IP | 10 por hora | `REGISTER_MAX_PER_HOUR` |
| Toda la API por IP | 600 por minuto | `API_MAX_PER_MINUTE` |

Los dos últimos solo se activan en producción (`NODE_ENV=production`) o con `LIMITES_ESTRICTOS=true`, para no estorbar al desarrollo ni a las pruebas. Detrás de un proxy hay que poner `TRUST_PROXY=true` para que cuenten la IP real. Los contadores están en memoria: con varias instancias deben pasar a Redis.

## 6. Cabeceras

- API: `Content-Security-Policy: default-src 'none'`, `Cache-Control: no-store` (datos personales y clínicos no se guardan en caches), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS con HTTPS. No se envía `X-Powered-By`.
- Página web (nginx): CSP que solo permite scripts propios, las fuentes de Google y el mapa de Google Maps; sin versión del servidor.

## 7. Auditoría

Se registran: consulta, descarga y cambio de historias clínicas, exportación de datos, **inicios de sesión, intentos fallidos, cambios y restablecimientos de contraseña y cierres de todas las sesiones** (con IP). El administrador los ve en Auditoría.

## 8. Cómo comprobarlo

```
cd backend
node --import tsx --test tests/unit/seguridad.test.js   # unitarias: contraseñas, cookies, CSRF, token
node --import tsx --test tests/seguridad.test.js        # API: cookie, revocación, CSRF, cabeceras, 401 en toda ruta privada
```

A mano: iniciar sesión en el navegador y, en las herramientas de desarrollo → Aplicación → Almacenamiento, ver que no hay `token` y que la cookie `ac_sesion` figura como HttpOnly. Probar «Mi cuenta → Cerrar todas mis sesiones» con dos navegadores abiertos.

## 9. Pendiente para producción

1. **HTTPS obligatorio** en el proxy (el certificado es del despliegue, no del código) y `TRUST_PROXY=true`.
2. Contadores de límites en **Redis** si hay más de una instancia.
3. Rotar `JWT_SECRET` desde un gestor de secretos; con `docker-compose` hay que definirlo en el entorno (ya no trae valor de ejemplo).
4. Copias de seguridad cifradas y procedimiento de incidentes (ver `cumplimiento-normativo.md`).
5. Segundo factor para administradores y análisis de dependencias (`npm audit`) en el CI.
6. Antivirus para los adjuntos subidos si se abre la carga a más roles.
