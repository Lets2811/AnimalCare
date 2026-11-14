# Evaluación de procesos: pruebas y mejoras

Para cada proceso del sistema: qué pruebas lo cubren, qué tan sólido está y qué mejoraría, en orden de prioridad.
Prioridad: **A** = antes de producción, **B** = al crecer, **C** = deseable.

## Cómo correr las pruebas

| Capa | Comando (carpeta) | Qué cubre |
|---|---|---|
| Unitarias backend | `node --import tsx --test "tests/unit/*.test.js"` (backend) | validadores, servicios de dominio, utilidades y middleware, sin BD |
| Integración API | `npm test` / `node scripts/coverage.js` (backend) | rutas completas con base de datos, en proceso |
| Unitarias frontend | `npm test` (frontend) | ayudantes, servicios, formularios y componentes |
| Extremo a extremo | `npx playwright test` (frontend, con servidores en 4100 y 5199) | flujos de cliente, veterinario, urgencias, clínico y accesibilidad |

Estado de referencia: backend 250 pasan / 2 omitidas (cobertura de líneas 92,8 %), frontend 155 pasan, e2e 21.

## 1. Cuentas y autenticación
- **Pruebas:** validadores de registro, matrícula, servicios y perfil (unitarias); registro, login, bloqueo por intentos, recuperación y verificación de correo (API); formularios Login y Register y `RutaPrivada` (frontend); flujos e2e.
- **Hallazgo corregido:** el teléfono `+57 300 123 4567` se rechazaba porque se contaban espacios y el `+`. Ahora hay una sola regla (`utils/telefono.ts`, 7 a 15 dígitos) y el frontend la replica.
- **Mejoras:**
  - A: pasar el token a cookie HttpOnly con SameSite (hoy vive en el almacenamiento del navegador).
  - A: el límite de intentos es en memoria; con más de una instancia debe pasar a Redis.
  - B: validación con un esquema único (Zod) compartido entre rutas y documentación OpenAPI.
  - C: segundo factor para administradores.

## 2. Mascotas y ficha clínica
- **Pruebas:** `validatePet` (unitarias), CRUD y permisos por dueño (API), pantalla de mascotas (e2e).
- **Mejoras:** B: borrado lógico con ventana de recuperación; C: foto de la mascota con recorte y reducción de tamaño en el navegador.

## 3. Veterinarios, perfil, servicios y horarios
- **Pruebas:** `validateVetProfile`, `validateServices`, `validateAvailabilities` (unitarias); horarios y zona horaria (`schedule.test.js`); API de panel; e2e del veterinario.
- **Mejoras:** B: excepciones de agenda (vacaciones, festivos) además del horario semanal; B: calendario de festivos de Colombia; C: duración y precio por servicio en el buscador.

## 4. Citas
- **Pruebas:** disponibilidad, reglas de zona horaria, candado contra doble reserva, cancelación y estados (API); `AgendarCita` por pasos y `CitaTarjeta` (frontend); flujo e2e completo.
- **Fortalezas:** reserva protegida con `SELECT … FOR UPDATE`; todo en hora de Bogotá.
- **Mejoras:** A: prueba de concurrencia real (dos reservas simultáneas) en CI; B: recordatorio de cita por correo; B: reprogramar sin cancelar; C: lista de espera cuando un horario se llena.

## 5. Urgencias
- **Pruebas:** ayudantes de urgencias y teléfono (unitarias frontend), flujo de estados, tiempos y cita asociada (API), `UrgenciaCliente`/`UrgenciaVeterinario` (frontend), e2e.
- **Mejoras:** A: aviso al veterinario fuera de la pantalla (notificación push o correo), porque hoy depende de tener la página abierta; B: tiempo máximo de espera con reasignación automática; C: seguimiento en el mapa.

## 6. Historia clínica, vacunas y recetas
- **Pruebas:** `validateRecord`, `toPublicRecord`, `validarVacunas`, `validarRecetas` (unitarias); adjuntos, PDFs y permisos (API); formularios de historia (frontend); e2e clínico.
- **Mejoras:** A: firma o sello del veterinario en recetas (requisito legal a confirmar); B: plantillas de consulta; B: versionado de correcciones (hoy se edita sobre el registro); C: gráficas de peso por especie.

## 7. Pagos (simulados)
- **Pruebas:** estados del pago simulado y cálculo de totales (API y frontend, ayudantes de pago).
- **Mejoras:** A (cuando se decida cobrar): pasarela real con webhooks idempotentes y conciliación; hasta entonces mantener claramente rotulado como simulación.

## 8. Notificaciones y recordatorios
- **Pruebas:** formato de momentos (frontend), listado y marcado de leídas (API), job de recordatorios de vacunas.
- **Mejoras:** B: preferencias por canal; B: cola con reintentos para correos; C: resumen semanal.

## 9. Administración, métricas y auditoría
- **Pruebas:** aprobación y suspensión de cuentas, métricas, auditoría (API); `AdminMetricas` y `AdminAuditoria` (frontend).
- **Mejoras:** B: exportar auditoría a CSV; B: alertas ante patrones (muchos accesos a historias ajenas); C: panel de salud del sistema.

## 10. Privacidad y cumplimiento (Ley 1581)
- **Pruebas:** versión de la política y consentimiento, exportación de datos, retención, vista «quién accedió» (API); constante de versión (unitaria).
- **Mejoras:** A: definir el plazo legal de retención de historias y registrar la base de datos ante la SIC si aplica; A: canal de reclamos con responsable nombrado; B: ejecutar `npm run retencion` programado.

## 11. Infraestructura transversal
- **Pruebas:** `parseId`, errores, estado de cuenta, subida de archivos (firma real del contenido), límite de intentos con reloj simulado, cabeceras de seguridad y permisos por rol (unitarias); coherencia de OpenAPI con las rutas (`openapi.test.js`).
- **Mejoras:** A: HSTS y CSP estricta en el proxy de producción; B: registros estructurados con identificador de petición; B: archivos a almacenamiento de objetos al pasar a producción (hoy en disco, ver `npm run huerfanos`); C: migrar el frontend a TypeScript.

## Orden sugerido
1. Cookie HttpOnly y límite de intentos compartido (1).
2. Aviso externo de urgencias (5) y prueba de concurrencia de citas (4).
3. Trámites legales pendientes (6, 10).
4. Resto por prioridad B y C según uso real.
