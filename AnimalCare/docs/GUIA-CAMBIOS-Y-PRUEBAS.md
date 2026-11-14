# Guía de cambios y cómo ensayarlos

Documento de la ronda de mejoras de calidad (rama `mejoras-calidad`, todo en local, sin subir a ningún remoto).
Primero un resumen de lo que cambió, luego **cómo probar cada cosa paso a paso**, la **revisión de flujos**
(qué encontré, qué corregí y qué corregiría después) y cómo correr todas las pruebas.

## 1. Cómo dejar todo listo para probar

Requisitos: MySQL corriendo con la base de `backend/.env`, Node 22 o superior.

```bash
cd backend
npm install
npx prisma migrate deploy      # aplica las migraciones nuevas (pago simulado)
npx prisma generate            # con el backend apagado
npm run seed                   # cuentas y datos de demostración (repetible)
npm run dev                    # API en http://localhost:4000

cd ../frontend
npm install
npm run dev                    # http://localhost:5173
```

Cuentas de demostración (contraseña **`Demo1234`** en todas):

| Perfil | Correo |
|---|---|
| Administrador | `demo.admin@animalcare.com` |
| Dueño (2 mascotas, cita próxima, cita atendida con historia y reseña) | `demo.cliente@animalcare.com` |
| Dueño (1 mascota) | `demo.cliente2@animalcare.com` |
| Veterinario (consultorio y domicilio, horario L–V 8–12 y 14–18) | `demo.vet@animalcare.com` |
| Veterinario (solo consultorio) | `demo.vet2@animalcare.com` |
| Veterinario pendiente de aprobación | `demo.pendiente@animalcare.com` |

> Si ya tenías cuentas `demo.*` de antes, `npm run seed` no las toca. Para empezar de cero: `npm run seed -- --reset`.

## 2. Qué cambió y cómo probarlo

### 2.1 Sesión vencida ya no deja la pantalla rota
**Qué:** el token dura 2 horas. Antes, al vencer, la app mostraba errores 401 en silencio. Ahora, si el token ya
venció al abrir una pantalla privada, o el servidor responde 401, se borra la sesión y se vuelve al login con el
aviso "Tu sesión expiró…".
**Probar:**
1. Inicia sesión como cualquier usuario.
2. En el navegador abre las herramientas (F12) → Aplicación → Almacenamiento local y **borra o cambia unas letras del `token`**.
3. Recarga o navega a otra sección: debe llevarte a `/login` con el aviso.
4. Prueba automática: `frontend/src/services/api.test.js` (7 casos).

### 2.2 Datos de ejemplo con un comando (`npm run seed`)
**Qué:** `backend/scripts/seed-demo.js` crea las cuentas, perfiles, servicios, horarios, mascotas y citas de la tabla anterior.
**Probar:** `npm run seed` dos veces: la segunda dice "ya existe, no se toca". `npm run seed -- --reset` rehace todo.
Se niega a correr con `NODE_ENV=production`.

### 2.3 Docker probado de verdad
**Qué:** se ejecutó `docker compose up --build` desde una base vacía: las migraciones aplican, el login funciona y el seed
corre dentro del contenedor. Se corrigió un error real: faltaban los `.dockerignore`, así que la imagen copiaba tu
`node_modules` de Windows (rompe `bcrypt` en Linux) y hasta el `.env`.
**Probar:** `docker compose up --build` y abre http://localhost:8080. Si tu MySQL local usa el 3306, cambia el puerto
de `db` en el compose (la guía de `README.md` explica cómo con un archivo `override`).
`docker compose down -v` borra los datos del contenedor.

### 2.4 Cobertura y matriz de trazabilidad
- `cd backend && npm run coverage` arranca la API **dentro** del proceso de pruebas y mide cuánto de `src/` se ejecuta
  (hoy **87,7 % de líneas**; el reporte también queda en `backend/coverage/lcov.info`).
- `cd frontend && npm run coverage` mide las pruebas unitarias (**31 % de líneas**: las pantallas grandes se cubren con
  las pruebas e2e, no con unitarias; es la cifra honesta).
- `cd backend && npm run matriz` regenera `docs/matriz-trazabilidad.md`: historia → criterios de aceptación → pruebas
  (API e interfaz), con las cifras de cobertura. Se arma sola a partir del README, los criterios y los títulos de las pruebas.

### 2.5 Más pruebas extremo a extremo
Nuevas en `frontend/e2e/`:
- `flujo-veterinario.spec.js`: el veterinario entra a su agenda, inicia la atención, llena la historia (guardar avance y
  terminar), y el dueño ve la consulta. Incluye "terminar sin registrar".
- `flujo-urgencias.spec.js`: **dos navegadores a la vez**: el dueño pide, el veterinario acepta, inicia la atención y la
  termina; y el caso "no la realizó" que la devuelve a la lista. Se omite sola en los últimos 30 minutos del día
  (la urgencia ocupa 30 min dentro del día).
- `ayudas.js`: utilidades para preparar datos (usuarios `e2e.*`, que el teardown borra).

### 2.6 Accesibilidad (axe) y documentación de la API
- `frontend/e2e/accesibilidad.spec.js` revisa con axe (WCAG 2 A y AA) las pantallas principales de los 4 roles.
  Encontró **3 problemas de contraste** que ya se corrigieron (texto gris suave, enlace del aviso ámbar, contador de pestañas).
  Falla ante cualquier violación grave; las leves se listan como anotaciones.
- **Swagger UI:** con el backend corriendo abre http://localhost:4000/api/docs (funciona sin internet). El documento es
  `backend/openapi.json` (68 endpoints) y se regenera con `npm run openapi`. La prueba `tests/openapi.test.js` **falla si una
  ruta del backend no está documentada**, así que no se queda atrás.
  Para probar desde Swagger: `POST /auth/login`, copia el `token` y pulsa **Authorize**.

### 2.7 Google Maps (sin clave de API)
**Qué:**
- **Ubicación del consultorio:** si el veterinario atiende en consultorio y tiene dirección, el dueño ve el mapa en el
  detalle del veterinario, y un enlace "Abrir en Google Maps" en sus citas de consultorio.
- **Servicio a domicilio:** el dueño escribe su dirección al agendar o al pedir la urgencia (ya era obligatoria). Al
  veterinario le aparece **"Cómo llegar desde mi ubicación"**, que abre Google Maps con la ruta hacia esa dirección,
  partiendo de donde esté el veterinario (el celular o el navegador piden permiso de ubicación a Google Maps). En la
  urgencia a domicilio además ve el mapa de la dirección.
- No se necesita clave de API ni tarjeta: usa los enlaces públicos de Google Maps. La ciudad por defecto es
  `Popayán, Cauca, Colombia` (se agrega a direcciones que no la mencionan); cámbiala con `VITE_MAPS_CIUDAD`.
**Probar:**
1. Como `demo.cliente`, entra a **Veterinarios** → `Dra. Veterinaria Demo`: debe verse el mapa de "Cómo llegar".
2. Agenda una cita **a domicilio** con una dirección (p. ej. `Calle 3 # 2-45`).
3. Entra como `demo.vet`, abre **Mi agenda** y busca esa cita: pulsa **Cómo llegar desde mi ubicación** → se abre Google Maps con la ruta.
4. Pide una urgencia **a domicilio** como cliente y acéptala como veterinario: la tarjeta "Urgencia en curso" muestra el mapa y el botón de ruta.
**Límite:** son enlaces, no una integración con la API de Google. La dirección se escribe a mano y Google la interpreta;
para validarla con autocompletado y guardar coordenadas haría falta una clave de la API de Places (ver recomendaciones).

### 2.8 Panel de métricas del administrador
**Qué:** `GET /api/admin/metrics` y la pantalla **Métricas** (menú del administrador): usuarios, veterinarios por aprobar,
citas de los últimos 30 días (atendidas/canceladas), citas por día de los últimos 14 días (barras), urgencias (atendidas,
sin respuesta, tiempo promedio en aceptarse), calificación promedio y veterinarios con más citas atendidas.
**Probar:** entra como `demo.admin` → **Métricas**. Con los datos del seed verás 1 cita atendida y 1 reseña de 5.

### 2.9 PDF de la historia clínica y carnet de vacunas
**Qué:** en la historia de una mascota hay un botón **Descargar PDF** (dueño y veterinario con relación con la mascota) y
una tarjeta **Carnet de vacunas** con las vacunas anotadas en las consultas (de la más reciente a la más antigua).
El PDF trae los datos de la mascota, el carnet y todas las consultas.
**Probar:** como `demo.cliente` → **Mis mascotas** → historia de `Luna` → verás el carnet ("Triple canina (refuerzo)")
→ **Descargar PDF**. Un cliente ajeno recibe 404; sin sesión, 401.

### 2.10 Agenda semanal del veterinario
**Qué:** en **Mi agenda** hay un selector **Día | Semana**. La semana muestra siete columnas (lunes a domingo) con las
citas de cada día por hora, sin las canceladas, con navegación entre semanas y "Esta semana". Al elegir una cita o un día
se vuelve a la vista diaria de esa fecha, donde están las acciones (confirmar, reprogramar, iniciar atención…).
**Probar:** como `demo.vet` → **Mi agenda** → **Semana**. La cita próxima del seed aparece en su día.

### 2.11 Pago simulado de la cita
**Qué:** las citas con servicio y precio muestran el valor y su estado (**Pago pendiente / Pagada / Reembolsada (simulado)**).
El dueño pulsa **Pagar … (simulado)**: no se procesa ninguna tarjeta, solo se registra el pago con una referencia
`SIM-…`. El veterinario recibe un aviso. Si la cita se cancela (por el cliente, el veterinario o por la suspensión del
veterinario) queda **Reembolsada (simulado)**. Es un ensayo del flujo; para cobrar de verdad habría que integrar una pasarela.
**Probar:** `demo.cliente` agenda con `Dra. Veterinaria Demo` el servicio "Consulta general" → en **Mis citas** pulsa
**Pagar $ 60.000 (simulado)** → queda "Pagada · Ref. SIM-…". Cancela esa cita como veterinario → "Reembolsada (simulado)".

### 2.12 Correcciones encontradas al revisar los flujos
Ver la sección 3. Resumen de lo que se arregló:
1. **Doble reserva:** tres clientes reservando la misma hora a la vez quedaban los tres con cita. Ahora hay un candado por
   veterinario: uno obtiene la hora y los otros reciben "el horario ya no está disponible".
2. **Recuperar contraseña sin límite:** el limitador existía pero nunca contaba. Ahora son 5 pedidos por hora por IP y correo
   (responde 429 al sexto, sin revelar si el correo existe).
3. **Suspender a un veterinario** dejaba sus citas futuras activas y sus urgencias aceptadas. Ahora se cancelan las citas
   (con aviso y reembolso simulado) y las urgencias vuelven a quedar abiertas.
4. **El dueño podía cancelar una urgencia en plena atención.** Ahora se bloquea; solo se cancela si el veterinario la devuelve.
5. **Una urgencia vencida no avisaba** al dueño. Ahora recibe una notificación.

## 3. Revisión de flujos: qué corregiría y cómo

Revisé cada flujo con pruebas reales contra la API (carreras, estados límite) y leyendo el código. Leyenda: ✅ bien ·
🔧 corregido en esta ronda · 💡 lo corregiría después.

| Flujo | Veredicto |
|---|---|
| Registro, verificación de correo, login | ✅ Funciona. 💡 No hay límite en `register`: se podrían crear cuentas masivamente; agregaría un limitador por IP como el de login. 💡 Una cuenta sin verificar puede agendar y pedir urgencias; para producción exigiría el correo verificado en urgencias. |
| Recuperar contraseña | 🔧 El limitador no contaba (ver 2.12). ✅ La respuesta no revela si el correo existe. |
| Sesión | 🔧 Token vencido ya redirige al login. 💡 El token está en `localStorage` (expuesto a XSS); lo ideal es una cookie `HttpOnly` con renovación. |
| Aprobación y suspensión de veterinarios | 🔧 La suspensión ahora libera citas y urgencias. ✅ Rechazar/aprobar notifica. |
| Búsqueda y agendado | 🔧 Doble reserva corregida (candado por veterinario, también al reprogramar). 💡 No se valida que un mismo cliente no tenga dos citas que se solapan con veterinarios distintos. 💡 En domicilio no se considera el tiempo de traslado entre citas. |
| Cancelar y reprogramar | ✅ Regla de 2 horas para el cliente; el veterinario avisa con motivo. Con el pago simulado, cancelar reembolsa. |
| Atención de la cita e historia clínica | ✅ Iniciar → llenar → terminar, con avance guardable. 💡 Guardaría un **borrador local** del formulario: si la sesión vence a mitad de consulta, el texto escrito se pierde. |
| Urgencias | 🔧 No se cancela en plena atención; avisa al vencer; la reapertura reinicia el plazo. 💡 Hoy el aviso es solo dentro de la app (se actualiza cada 10 s): para algo urgente agregaría notificaciones push o SMS al veterinario. 💡 Si nadie atiende, el mensaje sugiere ir a la clínica más cercana; podría listar clínicas con el mapa. |
| Cuenta (cambiar datos, eliminar) | ✅ Eliminar anonimiza y cancela lo pendiente. |
| Administración | ✅ Filtros y paginación. Se agregó el panel de métricas. |
| Rendimiento | 💡 `GET /appointments` del veterinario devuelve todo el historial; la vista semanal lo filtra en el navegador. Agregaría parámetros `from`/`to` y paginación en el servidor. |
| Infraestructura | 💡 El limitador de intentos y el recordatorio de citas viven en memoria de un solo proceso; con varias instancias del backend se duplicarían (usar Redis o una cola). 💡 Las fotos/adjuntos en disco local: con varias instancias, un almacenamiento compartido (S3 o similar). |

## 4. Cómo correr todas las pruebas

Con MySQL corriendo y la API **apagada** para las de cobertura (arranca la suya en el puerto 4310):

```bash
# Backend (API, 179 casos: 177 pasan, 2 condicionales) + cobertura
cd backend
npm run coverage

# Backend contra un servidor ya corriendo (puerto 4000)
npm test

# Frontend (104 casos) + cobertura + lint + build
cd ../frontend
npm run coverage
npm run lint
npm run build

# Extremo a extremo y accesibilidad (16 casos). Necesita backend y frontend corriendo
# (puertos 4000 y 5173, o E2E_API_URL / E2E_BASE_URL) y Chrome instalado.
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Resultado de esta ronda: backend **177/179 pasan** (2 condicionales por la hora del día), frontend **104/104**,
e2e **16/16**, lint y build sin avisos, cobertura de líneas del backend **87,7 %**.

Notas:
- Las pruebas de urgencias dependen de la hora: necesitan que falten más de 30 minutos para la medianoche en Bogotá.
  Si corren en ese margen, se omiten solas (no fallan).
- Las pruebas crean usuarios `qa.*` y `e2e.*` y los borran al terminar. Si una prueba se interrumpe, limpia con
  `node scripts/clean-test-data.js qa.` (o `e2e.`).
- Todo esto está **sin commitear** en la rama `mejoras-calidad` y no se subió a ningún remoto.
