# Cumplimiento normativo (Colombia)

> **Aviso:** este documento describe lo que el software hace para apoyar el cumplimiento de la normativa colombiana
> y lo que queda como tarea del responsable del tratamiento. **No es asesoría jurídica.** Antes de operar con datos
> reales, un abogado debe revisar la política de privacidad, los plazos de conservación y los trámites ante la
> Superintendencia de Industria y Comercio (SIC).

## 1. Normas que se tomaron como referencia

| Norma | De qué trata | Por qué aplica a AnimalCare |
|---|---|---|
| **Ley 1581 de 2012** y **Decreto 1377 de 2013** (hoy compilado en el Decreto 1074 de 2015) | Protección de datos personales (habeas data): autorización, finalidad, derechos del titular, seguridad, reclamos | La plataforma guarda datos personales de dueños (nombre, correo, dirección a domicilio, teléfono) y de veterinarios (matrícula, consultorio) |
| **Ley 576 de 2000** (código de ética del médico veterinario) | Deberes del profesional, entre ellos la reserva sobre la historia clínica | Las historias clínicas son de las mascotas, pero llevan el nombre de su dueño y notas del profesional |
| **Ley 527 de 1999** | Validez de los mensajes de datos y documentos electrónicos | Recetas y historias en PDF generadas por la plataforma |

## 2. Qué hace el sistema por cada obligación

Leyenda: ✅ implementado · 🔧 implementado en parte · ⚠️ pendiente (lo debe hacer el responsable).

### Ley 1581 de 2012: principios y derechos del titular

| Obligación | Cómo se cumple | Dónde | Estado |
|---|---|---|---|
| **Autorización previa, expresa e informada** | Casilla obligatoria al registrarse; se guarda la fecha y la **versión** de la política aceptada | Registro; `User.privacyAcceptedAt`, `privacyVersion` | ✅ |
| **Aviso / política de privacidad** | Página pública con responsable, datos, finalidades, destinatarios, derechos, seguridad, conservación y Google Maps | `/privacidad` (versión 2026-11-14) | ✅ |
| **Finalidad** | Cada dato se usa para citas, historia clínica, avisos y verificación de veterinarios; la política lo dice | `/privacidad` | ✅ |
| **Derecho de acceso (conocer)** | **Descargar todos mis datos** en JSON (cuenta, mascotas, historias, citas, avisos, reseñas, urgencias); queda en el registro de auditoría | Mi cuenta → "Descargar mis datos"; `GET /api/account/export` | ✅ |
| **Rectificación / actualización** | El titular edita su nombre, correo, contraseña, perfil y mascotas | Mi cuenta, Mi perfil, Mis mascotas | ✅ |
| **Supresión y revocatoria** | Eliminar la cuenta anonimiza los datos personales y cancela lo pendiente. Las citas y las historias clínicas se conservan sin identificar al titular | Mi cuenta → Eliminar | 🔧 (ver 4) |
| **Transparencia** | El dueño ve **quién consultó, descargó o cambió** la historia de su mascota | Historia → "Ver quién ha consultado"; `GET /api/medical-records/pets/:id/accesses` | ✅ |
| **Seguridad** | Contraseñas con bcrypt; sesión con JWT de 2 h y cierre automático al vencer; límite de intentos de inicio de sesión y de recuperación; cabeceras de seguridad; archivos médicos **privados** (solo con sesión y permiso) y sin caché; acceso a la historia solo para el dueño y para el veterinario con relación con la mascota | Varios | ✅ |
| **Registro de accesos (trazabilidad)** | Cada consulta, descarga, creación, edición o anulación de una historia, y cada exportación, queda en `AuditLog` (quién, rol, qué, cuándo, IP). Sobrevive a la eliminación de la cuenta | `AuditLog`; el administrador la ve en Auditoría | ✅ |
| **Limitación de la conservación** | Script `npm run retencion` (simula por defecto): depura tokens vencidos, notificaciones leídas antiguas y cuentas eliminadas sin datos que conservar. Plazos configurables | `backend/scripts/retencion.ts` | 🔧 (hay que programarlo) |
| **Atención de consultas y reclamos** | La política indica el canal (el administrador) y el plazo de 15 días hábiles | `/privacidad` | 🔧 (designar persona y correo) |

### Ley 576 de 2000: reserva de la historia clínica

| Deber | Cómo lo apoya el sistema |
|---|---|
| **Reserva** | Solo ve una historia el dueño de la mascota y los veterinarios que tienen o tuvieron una cita no cancelada (o una urgencia aceptada) con ella. Un tercero recibe 404, sin revelar que existe |
| **Autoría y no alteración** | Solo el autor modifica o anula una entrada; "eliminar" **anula** con motivo y se conserva; cada cambio queda auditado |
| **Identificación del profesional** | Cada entrada y cada receta muestran el nombre, la especialidad y la **matrícula profesional** |
| **Continuidad de la atención** | El veterinario con relación ve la historia completa para dar seguimiento (alergias, vacunas, recetas, controles) |

### Ley 527 de 1999: documentos electrónicos

La receta y la historia se generan en PDF con la fecha, el profesional y su matrícula. Son documentos informativos de la
plataforma; para que una receta tenga el efecto que la regulación sanitaria exija (por ejemplo, medicamentos de venta
controlada) puede hacer falta **firma electrónica o certificada**, que hoy no se incluye.

## 3. Qué datos se guardan y por qué (minimización)

| Dato | Para qué | ¿Obligatorio? |
|---|---|---|
| Nombre y correo del dueño | Cuenta, avisos, contacto con el veterinario | Sí |
| Dirección | Solo en una cita o urgencia **a domicilio**, para que el veterinario llegue | Solo a domicilio |
| Teléfono | Solo en urgencias, para que el veterinario llame | Solo en urgencias |
| Ficha de la mascota (raza, color, microchip, esterilización, alergias) | Atención clínica segura (alergias, identificación) | No (opcional) |
| Historia clínica, vacunas, recetas, adjuntos | Atención veterinaria y continuidad | Los genera el veterinario |
| Matrícula y tarjeta profesional del veterinario | Verificar que puede ejercer; la tarjeta solo la ve el administrador | Sí (veterinarios) |

No se guardan datos de tarjetas ni de pagos: el pago es una **simulación**.

## 4. Lo que queda pendiente (decisiones del responsable)

1. **Registrar la base de datos en el RNBD** (Registro Nacional de Bases de Datos de la SIC), si la organización está obligada por su tamaño o activos.
2. **Designar quién atiende los reclamos** y publicar su correo en la política.
3. **Plazo de conservación de las historias clínicas.** El software las conserva sin límite; el plazo lo define el responsable con su asesor jurídico. La supresión de la cuenta las conserva anonimizadas en el momento de eliminar, pero **la historia sigue ligada a la mascota**; si se quisiera borrarla del todo habría que decidir quién custodia ese registro.
4. **Procedimiento de incidentes de seguridad:** quién avisa a los titulares y a la SIC si hay una filtración (el software no lo automatiza).
5. **Programar** `npm run retencion -- --aplicar` (por ejemplo, una vez al mes) y las copias de seguridad cifradas de la base de datos.
6. **Encargados y transferencias:** si se contrata un servicio de correo (SMTP), nube o pasarela de pago, formalizar el contrato de transmisión de datos. Hoy el único tercero es Google Maps (por la dirección que se abre en el mapa) y está informado en la política.
7. **Menores de edad:** el registro no verifica la edad; si pudieran usarlo menores, hay que decidir cómo obtener la autorización de sus representantes.
8. **Firma de las recetas** si la regulación lo exige (ver Ley 527).

## 5. Cómo comprobarlo

| Qué | Cómo |
|---|---|
| Versión de la política aceptada | Registrar un usuario y ver Mi cuenta → "Aceptaste la política (versión 2026-11-14)…" |
| Exportación de datos | Mi cuenta → "Descargar mis datos (JSON)"; probado en `tests/sprint2.test.js` ("Datos personales") y en `frontend/e2e/flujo-clinico.spec.js` |
| Quién consultó mi historia | Entrar como veterinario a la historia de una mascota; luego, como dueño, "Ver quién ha consultado esta historia" |
| Registro de auditoría | Administrador → Auditoría (filtros por acción y mascota) |
| Retención | `npm run retencion` (simulación) y `npm run retencion -- --aplicar` |
| Archivos privados | Intentar abrir `/api/medical-records/attachments/:id` sin sesión (401) o de otra cuenta (404) |
