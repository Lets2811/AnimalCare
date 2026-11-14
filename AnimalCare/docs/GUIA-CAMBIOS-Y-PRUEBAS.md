# Guía de cambios y cómo ensayarlos

Documento de las rondas de mejoras (ramas `mejoras-calidad` y `migracion-typescript`, todo en local).
Primero cómo dejar todo listo, luego **qué cambió y cómo probarlo paso a paso**, la **revisión de flujos**
(qué se encontró, qué se corrigió y qué se corregiría después) y cómo correr todas las pruebas.

> Documentos relacionados: [DECISIONES-TECNICAS.md](DECISIONES-TECNICAS.md) (qué se hizo y qué se aplazó, con motivo) y
> [cumplimiento-normativo.md](cumplimiento-normativo.md) (Ley 1581 y otras).

## 0. Resumen de la última ronda (TypeScript, normativa y funciones de veterinaria)

| Área | Qué se hizo |
|---|---|
| **Arquitectura** | Backend en **TypeScript estricto**; código reorganizado en **módulos por dominio** (`src/modules/*`); compilación a `dist/` y Docker de dos etapas (Node 22) |
| **Normativa (Ley 1581)** | Registro de **auditoría** de accesos a historias; el dueño ve **quién consultó** la de su mascota; **exportar mis datos**; **versión** de la política aceptada; política actualizada; script de **retención** de datos |
| **Funciones de veterinaria** | **Ficha de la mascota** (raza, color, microchip, esterilización, alergias); **vacunas con próxima dosis** y carnet; **recetas** (PDF); **control de seguimiento**; **gráfico de peso**; **directorio de pacientes**; **recordatorios** de vacunas y controles |
| **Pruebas** | API, interfaz, e2e (flujo clínico completo) y accesibilidad, todas con las funciones nuevas |

Cómo probar cada parte está en las secciones 2.13 a 2.20.

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

### 2.13 Backend en TypeScript y por módulos
**Qué:** todo `backend/src` y los scripts operativos están en TypeScript con el modo estricto. Los archivos viven en
`src/modules/<dominio>/` (controller, service y routes juntos). Las pruebas siguen en JavaScript.
**Probar:**
1. `cd backend && npm run typecheck`: sin errores.
2. `npm run build && ls dist`: se compila a `dist/` (ahí no hay TypeScript).
3. `npm run dev`: la API arranca con recarga (`tsx watch`).
4. Las 190+ pruebas de la API pasan sin haber cambiado de comportamiento: `npm run coverage`.
**Docker:** `docker compose up --build` ahora compila el backend en una etapa y deja una imagen final liviana.

### 2.14 Ficha de la mascota
**Qué:** al registrar o editar una mascota se pueden añadir **raza, color, microchip (9–15 dígitos, único), esterilizado y alergias**.
Las alergias salen resaltadas en la tarjeta de la mascota, en el encabezado de la historia y en el directorio del veterinario.
**Probar:** como `demo.cliente` → **Mis mascotas** → editar a `Luna` → sección "Ficha clínica". Prueba un microchip con letras (error)
y uno repetido en otra mascota (409). Modificar la mascota por la API sin enviar la ficha **no la borra**.

### 2.15 Vacunas, recetas y control de seguimiento
**Qué:** al registrar la consulta, el veterinario puede añadir:
- **Vacunas** (nombre, **próxima dosis**, lote). El carnet de vacunas muestra "Próximas dosis" (con "Pronto" si faltan menos de 30 días)
  y todo lo aplicado. Las consultas antiguas con texto libre siguen apareciendo.
- **Receta** (medicamento, dosis, frecuencia, duración, indicaciones), con botón **Descargar receta (PDF)** con el nombre y la matrícula del profesional.
- **Próximo control sugerido** (fecha).
- El dueño recibe **avisos**: una semana antes de la próxima dosis y 3 días antes del control. También hay un gráfico de **evolución del peso**.
**Probar:** como `demo.vet` inicia la atención de una cita con una mascota, agrega "+ Agregar vacuna" (con próxima dosis) y
"+ Agregar medicamento", fija el control y pulsa **Guardar y terminar atención**. Luego como el dueño abre la historia:
carnet, receta y PDF. En `demo.cliente` → Luna ya hay una consulta de ejemplo con todo esto.

### 2.16 Directorio de pacientes
**Qué:** el veterinario tiene **Pacientes** en el menú: las mascotas que atiende o atendió, con dueño, número de visitas, última visita,
próxima cita, alergias y enlace a la historia. Buscador por nombre de la mascota o del dueño.
**Probar:** `demo.vet` → **Pacientes** → escribe "Luna". Un veterinario no ve los pacientes de otro.

### 2.17 Recordatorios de salud para el dueño
**Qué:** en el panel del dueño aparece **Vacunas y controles** con lo que viene en los próximos 60 días (y lo atrasado de los últimos 30).
Una dosis posterior de la misma vacuna reemplaza el recordatorio de la anterior.
**Probar:** `demo.cliente` → Panel: si el seed se corrió de cero, Luna tiene una vacuna y un control próximos.

### 2.18 Transparencia: quién consultó la historia
**Qué:** cada vez que alguien abre, descarga o cambia una historia clínica, queda en el registro de auditoría.
El dueño ve ese registro (sin contar sus propias consultas) y el administrador lo ve completo, con filtros.
**Probar:** `demo.vet` abre la historia de Luna → `demo.cliente` → historia de Luna → **Ver quién ha consultado esta historia**.
Como `demo.admin` → **Auditoría** (filtra por acción y por número de mascota).

### 2.19 Mis datos y política de privacidad
**Qué:** **Mi cuenta → Descargar mis datos (JSON)** entrega toda la información del titular (queda auditado). Mi cuenta muestra la
**versión de la política** aceptada y su fecha. La política (`/privacidad`) se actualizó con los datos nuevos, los derechos, la auditoría,
la retención y Google Maps.
**Probar:** `demo.cliente` → Mi cuenta → "Descargar mis datos". Abre el archivo: no trae contraseñas.

### 2.20 Retención de datos
**Qué:** `npm run retencion` **simula** qué depuraría (tokens vencidos, notificaciones leídas antiguas, cuentas eliminadas sin datos que
conservar); con `-- --aplicar` lo borra. No toca historias clínicas, citas ni la auditoría.
**Probar:** `cd backend && npm run retencion`.

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

Con MySQL corriendo:

```bash
# Tipos y compilación del backend
cd backend
npm run typecheck && npm run build

# Backend (API) con cobertura: arranca la API dentro del proceso de prueba (puerto 4310)
npm run coverage

# Backend contra un servidor ya corriendo (puerto 4000)
npm test

# Frontend: pruebas unitarias + cobertura + lint + build
cd ../frontend
npm run coverage && npm run lint && npm run build

# Extremo a extremo y accesibilidad. Necesita la API y el frontend corriendo
# (puertos 4000 y 5173, o E2E_API_URL / E2E_BASE_URL) y Chrome instalado
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

**Resultado de esta ronda:** backend **196/198 pasan** (2 condicionales por la hora del día) con cobertura de líneas **92 %**, frontend **123/123**, e2e y accesibilidad **21/21**, TypeScript sin errores, lint y build sin avisos, y la imagen de Docker compilada se construye y arranca desde una base vacía.

Notas:
- Las pruebas de urgencias dependen de la hora: se omiten solas si faltan menos de 30 minutos para la medianoche en Bogotá.
- Las pruebas crean usuarios `qa.*` y `e2e.*` y los borran al terminar. Si se interrumpen: `npx tsx scripts/clean-test-data.ts qa.` (o `e2e.`).
- Los e2e usan `tsx` para preparar datos desde el backend: no hace falta compilar.
- Todo el trabajo está **en local**, en commits de las ramas `mejoras-calidad` y `migracion-typescript`; no se subió a ningún remoto.
