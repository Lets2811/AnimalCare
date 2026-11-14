// Genera backend/openapi.json (OpenAPI 3.0) a partir de la lista de endpoints de este archivo.
//
//   npm run openapi
//
// El documento se ve en http://localhost:4000/api/docs (Swagger UI, sin conexion a internet).
// tests/openapi.test.js falla si una ruta del backend no esta documentada aqui (o al reves),
// asi que la documentacion no se queda atras cuando se agrega un endpoint.
const fs = require("node:fs");
const path = require("node:path");

const CLIENTE = "CLIENT";
const VET = "VETERINARIAN";
const ADMIN = "ADMIN";
const TODOS = [CLIENTE, VET, ADMIN];

// [metodo, ruta, etiqueta, resumen, roles (null = publico), cuerpo { campo: "tipo" } | null]
const ENDPOINTS = [
  ["get", "/health", "Sistema", "Estado de la API y de la base de datos", null, null],

  ["post", "/auth/register", "Autenticación", "Registra un cliente o un veterinario (acepta la política de privacidad)", null,
    { name: "string", email: "string", password: "string (mín. 6, con un número)", acceptPrivacy: "boolean", role: "CLIENT | VETERINARIAN", license: "string (veterinarios)", specialty: "string (veterinarios)" }],
  ["post", "/auth/login", "Autenticación", "Inicia sesión y devuelve un JWT (5 fallos por IP y correo = 429)", null, { email: "string", password: "string" }],
  ["post", "/auth/forgot-password", "Autenticación", "Envía el enlace para restablecer la contraseña (responde igual exista o no el correo; 5 por hora y correo)", null, { email: "string" }],
  ["post", "/auth/reset-password", "Autenticación", "Cambia la contraseña con el token recibido por correo", null, { token: "string", password: "string" }],
  ["post", "/auth/verify-email", "Autenticación", "Confirma el correo con el token recibido", null, { token: "string" }],
  ["get", "/auth/me", "Autenticación", "Datos de la sesión actual", TODOS, null],

  ["put", "/account", "Cuenta", "Actualiza el nombre y el correo de la cuenta", TODOS, { name: "string", email: "string" }],
  ["put", "/account/password", "Cuenta", "Cambia la contraseña (pide la actual)", TODOS, { currentPassword: "string", newPassword: "string" }],
  ["delete", "/account", "Cuenta", "Elimina la cuenta (anonimiza los datos y cancela citas futuras)", TODOS, { password: "string" }],
  ["post", "/account/resend-verification", "Cuenta", "Reenvía el correo de verificación", TODOS, null],

  ["get", "/pets", "Mascotas", "Mascotas del dueño", [CLIENTE], null],
  ["post", "/pets", "Mascotas", "Registra una mascota", [CLIENTE], { name: "string", species: "string", sex: "string", birthDate: "AAAA-MM-DD", weight: "number?" }],
  ["put", "/pets/{id}", "Mascotas", "Modifica una mascota propia", [CLIENTE], { name: "string", species: "string", sex: "string", birthDate: "AAAA-MM-DD", weight: "number?" }],
  ["delete", "/pets/{id}", "Mascotas", "Retira una mascota (queda inactiva, se conserva la historia)", [CLIENTE], null],

  ["get", "/vets", "Veterinarios", "Busca veterinarios (q, specialty, mode, zone, maxPrice, sort, page)", TODOS, null],
  ["get", "/vets/{id}", "Veterinarios", "Perfil público de un veterinario aprobado", TODOS, null],
  ["get", "/vets/{id}/slots", "Veterinarios", "Horarios libres de un día (date, mode, serviceId)", TODOS, null],
  ["get", "/vets/{id}/days", "Veterinarios", "Próximos 14 días con la cantidad de horarios libres", TODOS, null],

  ["get", "/vets/me/profile", "Panel del veterinario", "Mi perfil profesional", [VET], null],
  ["put", "/vets/me/profile", "Panel del veterinario", "Actualiza mi perfil (bio, especialidad, teléfono, dirección, modalidades)", [VET], { specialty: "string", bio: "string?", phone: "string?", address: "string?", homeService: "boolean", clinicService: "boolean" }],
  ["put", "/vets/me/photo", "Panel del veterinario", "Sube mi foto de perfil (data URL JPG/PNG)", [VET], { file: "data URL" }],
  ["delete", "/vets/me/photo", "Panel del veterinario", "Quita mi foto", [VET], null],
  ["put", "/vets/me/license-doc", "Panel del veterinario", "Sube mi tarjeta profesional (privada)", [VET], { file: "data URL" }],
  ["get", "/vets/me/services", "Panel del veterinario", "Mis servicios", [VET], null],
  ["post", "/vets/me/services", "Panel del veterinario", "Agrega un servicio con precio", [VET], { name: "string", description: "string?", price: "number", durationMinutes: "number" }],
  ["put", "/vets/me/services/{serviceId}", "Panel del veterinario", "Modifica un servicio", [VET], { name: "string", description: "string?", price: "number", durationMinutes: "number" }],
  ["delete", "/vets/me/services/{serviceId}", "Panel del veterinario", "Elimina un servicio (las citas conservan su detalle)", [VET], null],
  ["get", "/vets/me/availability", "Panel del veterinario", "Mi horario semanal (Mi horario)", [VET], null],
  ["put", "/vets/me/availability", "Panel del veterinario", "Reemplaza mi horario semanal", [VET], { availabilities: "[{ weekday, startTime, endTime }]" }],
  ["get", "/vets/me/blocks", "Panel del veterinario", "Mis bloqueos de agenda", [VET], null],
  ["post", "/vets/me/blocks", "Panel del veterinario", "Crea un bloqueo (con confirmación si hay citas en el rango)", [VET], { startsAt: "datetime", endsAt: "datetime", reason: "string?", cancelAppointments: "boolean?" }],
  ["delete", "/vets/me/blocks/{blockId}", "Panel del veterinario", "Quita un bloqueo", [VET], null],

  ["post", "/appointments", "Citas", "Agenda una cita (reservas simultáneas de la misma hora: solo una se acepta)", [CLIENTE], { vetProfileId: "number", date: "AAAA-MM-DD", time: "HH:MM", mode: "CLINIC | HOME", serviceId: "number?", petId: "number?", address: "string (HOME)", notes: "string?" }],
  ["get", "/appointments", "Citas", "Mis citas (cliente) o mi agenda (veterinario); filtros date y status", [CLIENTE, VET], null],
  ["patch", "/appointments/{id}/cancel", "Citas", "Cancela una cita (el cliente hasta 2 h antes; si estaba pagada se reembolsa)", [CLIENTE, VET], { reason: "string?" }],
  ["patch", "/appointments/{id}/reschedule", "Citas", "El veterinario reprograma una cita", [VET], { date: "AAAA-MM-DD", time: "HH:MM", reason: "string?" }],
  ["patch", "/appointments/{id}/confirm", "Citas", "El veterinario confirma una cita pendiente", [VET], null],
  ["patch", "/appointments/{id}/start", "Citas", "Inicia la atención (desde la hora de la cita): pasa a IN_PROGRESS", [VET], null],
  ["patch", "/appointments/{id}/complete", "Citas", "Termina la atención; con mascota exige la entrada de historia o skipRecord (una urgencia sin registrar se devuelve)", [VET], { skipRecord: "boolean?" }],
  ["post", "/appointments/{id}/pay", "Citas", "Pago SIMULADO de una cita con valor (no procesa tarjetas)", [CLIENTE], null],
  ["post", "/appointments/{id}/review", "Citas", "Califica una cita atendida (1 a 5)", [CLIENTE], { rating: "1-5", comment: "string?" }],

  ["get", "/notifications", "Notificaciones", "Mis notificaciones y el contador de no leídas", TODOS, null],
  ["patch", "/notifications/read-all", "Notificaciones", "Marca todas como leídas", TODOS, null],
  ["patch", "/notifications/{id}/read", "Notificaciones", "Marca una como leída", TODOS, null],

  ["get", "/medical-records/pets/{petId}", "Historias clínicas", "Historia de una mascota (dueño: vigentes; veterinario: todas, citas por registrar y en atención)", [CLIENTE, VET], null],
  ["get", "/medical-records/pets/{petId}/pdf", "Historias clínicas", "Descarga la historia y el carnet de vacunas en PDF", [CLIENTE, VET], null],
  ["post", "/medical-records", "Historias clínicas", "Crea la entrada de una cita en atención o atendida (appointmentId obligatorio)", [VET], { petId: "number", appointmentId: "number", reason: "string", diagnosis: "string", treatment: "string?", weight: "number?", temperature: "number?", vaccines: "string?", observations: "string?" }],
  ["put", "/medical-records/{id}", "Historias clínicas", "Modifica una entrada propia", [VET], { reason: "string", diagnosis: "string" }],
  ["patch", "/medical-records/{id}/annul", "Historias clínicas", "Elimina (anula) una entrada propia con motivo", [VET], { reason: "string" }],
  ["post", "/medical-records/{id}/attachments", "Historias clínicas", "Adjunta un examen (PDF/JPG/PNG, 5 MB, hasta 10 por entrada)", [VET], { file: "data URL", name: "string?" }],
  ["get", "/medical-records/attachments/{attachmentId}", "Historias clínicas", "Descarga un adjunto (privado)", [CLIENTE, VET], null],
  ["delete", "/medical-records/attachments/{attachmentId}", "Historias clínicas", "Quita un adjunto", [VET], null],

  ["get", "/emergencies/availability", "Urgencias", "Cuántos veterinarios atienden ahora según su horario", [CLIENTE], null],
  ["post", "/emergencies", "Urgencias", "Pide una urgencia (la mascota es obligatoria)", [CLIENTE], { petId: "number", symptoms: "string (10-500)", mode: "CLINIC | HOME", address: "string (HOME)", phone: "string" }],
  ["patch", "/emergencies/{id}/cancel", "Urgencias", "El dueño cancela (no si ya se está atendiendo)", [CLIENTE], null],
  ["get", "/emergencies/mine", "Urgencias", "Mis urgencias (dueño) o las que acepté (veterinario)", [CLIENTE, VET], null],
  ["get", "/emergencies/open", "Urgencias", "Urgencias abiertas para el veterinario disponible", [VET], null],
  ["patch", "/emergencies/{id}/accept", "Urgencias", "Acepta una urgencia y ocupa la agenda 30 min (409 APPOINTMENT_CONFLICT si hay citas: reenviar con rescheduleConflicts)", [VET], { rescheduleConflicts: "boolean?" }],
  ["patch", "/emergencies/{id}/complete", "Urgencias", "Marca como atendida una urgencia sin mascota (con mascota se termina desde la cita)", [VET], null],
  ["patch", "/emergencies/{id}/release", "Urgencias", "Libera la urgencia (antes de iniciar la atención)", [VET], null],

  ["get", "/admin/metrics", "Administración", "Métricas: usuarios, citas, urgencias y calificaciones", [ADMIN], null],
  ["get", "/admin/users", "Administración", "Lista usuarios con filtros (status, role, q, page)", [ADMIN], null],
  ["get", "/admin/users/{id}/license-doc", "Administración", "Descarga la tarjeta profesional de un veterinario", [ADMIN], null],
  ["patch", "/admin/users/{id}/approve", "Administración", "Aprueba un veterinario", [ADMIN], null],
  ["patch", "/admin/users/{id}/reject", "Administración", "Rechaza un veterinario pendiente", [ADMIN], null],
  ["patch", "/admin/users/{id}/suspend", "Administración", "Suspende una cuenta (cancela las citas futuras del veterinario y devuelve sus urgencias)", [ADMIN], null],
  ["patch", "/admin/users/{id}/reactivate", "Administración", "Reactiva una cuenta suspendida", [ADMIN], null],
];

function construir() {
  const paths = {};
  for (const [metodo, ruta, etiqueta, resumen, roles, cuerpo] of ENDPOINTS) {
    const parametros = [...ruta.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "integer" } }));
    const operacion = {
      tags: [etiqueta],
      summary: resumen,
      ...(roles ? { description: `Roles: ${roles.join(", ")}.`, security: [{ bearerAuth: [] }] } : { security: [] }),
      ...(parametros.length ? { parameters: parametros } : {}),
      ...(cuerpo
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { type: "object", properties: Object.fromEntries(Object.entries(cuerpo).map(([k, v]) => [k, { type: "string", description: v }])) },
                },
              },
            },
          }
        : {}),
      responses: {
        200: { description: "Correcto" },
        400: { description: "Datos no válidos (errors: lista de mensajes)" },
        ...(roles ? { 401: { description: "Sin sesión o sesión vencida" }, 403: { description: "Rol sin permiso o cuenta bloqueada" } } : {}),
        404: { description: "No existe o no es tuyo" },
        409: { description: "Conflicto con el estado actual" },
      },
    };
    (paths[ruta] ||= {})[metodo] = operacion;
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "AnimalCare API",
      version: "1.0.0",
      description:
        "API REST de AnimalCare. Todas las fechas y horas son de la clínica (America/Bogota). " +
        "Para probar en Swagger UI: inicia sesión con POST /auth/login, copia el token y pulsa Authorize.",
    },
    servers: [{ url: "/api" }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    paths,
  };
}

if (require.main === module) {
  const destino = path.join(__dirname, "../openapi.json");
  fs.writeFileSync(destino, JSON.stringify(construir(), null, 2) + "\n");
  console.log(`openapi.json generado: ${ENDPOINTS.length} endpoints.`);
}

module.exports = { ENDPOINTS, construir };
