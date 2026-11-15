# Matriz de trazabilidad

> Generada con `npm run matriz` (en `backend/`). No se edita a mano: se regenera a partir del README,
> los criterios de aceptación y los títulos de las pruebas.

## Resumen

- Historias de usuario en el README: **27**
- Pruebas de API (backend, node:test): **208** casos en 51 grupos
- Pruebas de interfaz (frontend, vitest): **156** casos en 23 archivos
- Pruebas de extremo a extremo (Playwright): ver `frontend/e2e/`
- Cobertura de líneas: backend **93.3 %** (6709/7190), frontend **35.2 %** (3054/8666)

## Historia → criterios → pruebas

| Historia | Título | Estado | Criterios de aceptación | Pruebas de API | Pruebas de interfaz |
|---|---|---|---|---|---|
| AN-6 | Registrar usuario para acceder a servicios veterinarios | Listo | — | 3 | — |
| AN-7 | Registrar veterinario para ofrecer servicios | Listo | — | 4 | — |
| AN-8 | Iniciar sesion | Listo | — | 4 | 8 |
| AN-10 | Seleccionar modalidad de atencion a domicilio | Listo | — | 6 | 13 |
| AN-11 | Seleccionar modalidad de atencion en veterinaria | Listo | — | 6 | 13 |
| AN-12 | Visualizar precios de veterinarios | Implementada | — | 1 | — |
| AN-13 | Escoger fecha y hora de la cita | Listo | — | 2 | 8 |
| AN-14 | Cancelar cita por usuario | Implementada | — | 5 | 18 |
| AN-15 | Cancelar citas por veterinario (con motivo opcional) | Implementada | [4 escenarios](criterios-aceptacion-sprint3.md#an-15-cancelar-citas-por-veterinario) | 2 | 14 |
| AN-16 | Modificar citas por veterinario (reprogramar, confirmar, marcar atendida) | Implementada | [5 escenarios](criterios-aceptacion-sprint3.md#an-16-modificar-citas-por-veterinario) | 11 | 18 |
| AN-17 | Visualizar citas pendientes de un dia por veterinario | Implementada | [5 escenarios](criterios-aceptacion-sprint3.md#an-17-visualizar-citas-pendientes-por-veterinario) | 5 | 4 |
| AN-18 | Crear historia clinica | Implementada | [7 escenarios](criterios-aceptacion-sprint3.md#an-18-crear-historia-clínica) | 20 | 19 |
| AN-19 | Eliminar historia clinica (anula la entrada con motivo) | Implementada | [3 escenarios](criterios-aceptacion-sprint3.md#an-19-eliminar-historia-clínica) | 3 | — |
| AN-20 | Modificar historia clinica | Implementada | [3 escenarios](criterios-aceptacion-sprint3.md#an-20-modificar-historia-clínica) | 3 | — |
| AN-21 | El dueño accede a la historia clinica de su mascota | Implementada | [7 escenarios](criterios-aceptacion-sprint3.md#an-21-acceder-a-la-historia-clínica-de-la-mascota-por-usuario) | 12 | 25 |
| AN-22 | Visualizar notificaciones por usuario | Implementada | [5 escenarios](criterios-aceptacion-sprint3.md#an-22-visualizar-notificaciones-por-usuario) | 6 | — |
| AN-23 | Visualizar notificaciones por veterinario | Implementada (incluye las urgencias, ver abajo) | [7 escenarios](criterios-aceptacion-sprint3.md#an-23-visualizar-notificaciones-por-veterinario) | 24 | 15 |
| AN-26 | Visualizar perfil detallado y servicios del veterinario | Listo | — | 5 | — |
| AN-27 | Buscar veterinarios por nombre o por servicio | Implementada | — | 10 | — |
| AN-28 | Agregar servicios al perfil profesional | Implementada | — | 3 | — |
| AN-29 | Eliminar servicios del perfil | Implementada | — | 3 | — |
| AN-30 | Asignar y modificar precios de los servicios | Implementada | — | 5 | — |
| AN-31 | Configurar horario base y bloqueos excepcionales | Implementada | — | 11 | — |
| AN-32 | Cerrar sesion | Listo | — | — | — |
| AN-35 | Verificacion de cuentas de veterinarios | Implementada | — | 10 | — |
| AN-37 | Suspension y bloqueo de cuentas | Implementada | — | 6 | 8 |
| AN-38 | Visualizacion y gestion general de usuarios | Implementada | — | 10 | 6 |

> Historias sin pruebas automáticas ligadas por título: AN-32.

## Detalle de pruebas de API por historia

### AN-6 — Registrar usuario para acceder a servicios veterinarios

**Cuenta: consentimiento y verificacion de correo**
- el registro exige aceptar la politica de privacidad
- al registrarse se envia un correo de verificacion y el enlace confirma el correo
- un enlace invalido responde 400

### AN-7 — Registrar veterinario para ofrecer servicios

**AN-7 / AN-8: el veterinario nuevo queda pendiente de verificacion**
- el registro deja la cuenta PENDING con el mensaje de revision
- el veterinario pendiente puede iniciar sesion y /me informa su estado
- credenciales incorrectas muestran el mensaje de AN-8
- un veterinario pendiente no aparece en el buscador ni se puede ver su perfil

### AN-8 — Iniciar sesion

**AN-7 / AN-8: el veterinario nuevo queda pendiente de verificacion**
- el registro deja la cuenta PENDING con el mensaje de revision
- el veterinario pendiente puede iniciar sesion y /me informa su estado
- credenciales incorrectas muestran el mensaje de AN-8
- un veterinario pendiente no aparece en el buscador ni se puede ver su perfil

### AN-10 — Seleccionar modalidad de atencion a domicilio

**Mejora: buscador con filtros, orden y proximo turno**
- cada veterinario trae su proximo turno libre
- filtra por zona del consultorio
- filtra por precio maximo
- ordena por precio de menor a mayor
- 'atiende hoy' solo deja a quienes tienen turno hoy
- parametros invalidos responden 400

### AN-11 — Seleccionar modalidad de atencion en veterinaria

**Mejora: buscador con filtros, orden y proximo turno**
- cada veterinario trae su proximo turno libre
- filtra por zona del consultorio
- filtra por precio maximo
- ordena por precio de menor a mayor
- 'atiende hoy' solo deja a quienes tienen turno hoy
- parametros invalidos responden 400

### AN-12 — Visualizar precios de veterinarios

**AN-12: visualizar precios de veterinarios**
- el perfil trae nombre, descripcion, matricula, correo, telefono y servicios con precio

### AN-13 — Escoger fecha y hora de la cita

**Mejora: dias con turnos disponibles al agendar**
- devuelve 14 dias y los fines de semana sin turnos (solo atiende de lunes a viernes)
- una modalidad que no ofrece responde 400

### AN-14 — Cancelar cita por usuario

**AN-14: cancelar cita por usuario**
- otro cliente no puede cancelarla
- un administrador no cancela citas
- el dueño la cancela, se libera el horario y se avisa al veterinario
- cancelarla de nuevo responde 409

**Mejora: politica de cancelacion**
- el cliente no puede cancelar a menos de 2 horas, el veterinario si

### AN-15 — Cancelar citas por veterinario (con motivo opcional)

**AN-15: el veterinario cancela citas de su agenda**
- un motivo de mas de 200 caracteres responde 400
- cancela con motivo, libera el horario y avisa al cliente

### AN-16 — Modificar citas por veterinario (reprogramar, confirmar, marcar atendida)

**AN-16: el veterinario modifica las citas de su agenda**
- confirma una cita pendiente y avisa al cliente
- el cliente no puede confirmar, reprogramar ni completar
- no puede marcar como atendida una cita futura
- validaciones al reprogramar
- no puede mover la cita a un horario bloqueado
- reprograma a otro horario libre, libera el anterior y avisa al cliente
- marca como atendida una cita cuya hora ya llegó

**Atencion de la cita: iniciar, llenar la historia clinica y terminar**
- no se inicia una cita que aun no llega, ni se registra ni se termina sin iniciarla
- al iniciar, la cita queda en atencion y no se cancela ni se reagenda
- guardar avance y terminar: pide la historia clinica antes de cerrar y avisa al dueño
- terminar sin registrar es una decision explicita

### AN-17 — Visualizar citas pendientes de un dia por veterinario

**AN-17: el veterinario ve las citas de un dia especifico**
- al agendar, el veterinario recibe una notificacion de nueva cita
- filtra la agenda por dia, ordenada por hora
- filtra por estado pendiente
- cada veterinario o cliente solo ve sus propias citas del dia
- fecha o estado invalidos responden 400

### AN-18 — Crear historia clinica

**AN-18: crear historia clinica**
- un veterinario sin citas con la mascota no puede verla ni escribir en ella
- valida los campos obligatorios y los rangos
- el veterinario registra la consulta de una cita atendida y se avisa al dueño
- una cita solo admite una entrada
- toda entrada pertenece a una cita: sin cita no se registra
- la consulta se registra mientras la cita esta en curso, sin esperar a que termine
- un cliente no puede escribir en la historia

**Atencion de la cita: iniciar, llenar la historia clinica y terminar**
- no se inicia una cita que aun no llega, ni se registra ni se termina sin iniciarla
- al iniciar, la cita queda en atencion y no se cancela ni se reagenda
- guardar avance y terminar: pide la historia clinica antes de cerrar y avisa al dueño
- terminar sin registrar es una decision explicita

**Adjuntos de la historia clinica (extiende AN-18 y AN-21)**
- un cliente no puede adjuntar archivos
- rechaza formatos no permitidos, archivos falsos y archivos muy grandes
- el veterinario adjunta un PDF y una imagen; el nombre se limpia
- la historia lista los adjuntos sin exponer rutas de disco, al dueño y al veterinario
- el dueño descarga el archivo; otros no
- otro veterinario ve el archivo pero no puede agregar ni quitar
- una entrada admite hasta 10 archivos
- el autor elimina un archivo: desaparece de la lista y del disco
- al eliminar la entrada, el dueño deja de ver sus archivos y no se pueden agregar mas

### AN-19 — Eliminar historia clinica (anula la entrada con motivo)

**AN-19: eliminar historia clinica**
- pide un motivo para eliminar
- al eliminar, el dueño deja de verla y el veterinario la ve anulada con su motivo
- una entrada eliminada no se puede modificar ni volver a eliminar

### AN-20 — Modificar historia clinica

**AN-20: modificar historia clinica**
- el autor modifica su entrada
- otro veterinario que atiende a la mascota ve la historia pero no puede modificarla
- el cliente no puede modificar entradas

### AN-21 — El dueño accede a la historia clinica de su mascota

**AN-21: el dueño accede a la historia clinica de su mascota**
- ve las entradas de su mascota, de la mas reciente a la mas antigua
- otro cliente no puede ver la historia
- el veterinario ve ademas sus citas pasadas sin registrar

**Adjuntos de la historia clinica (extiende AN-18 y AN-21)**
- un cliente no puede adjuntar archivos
- rechaza formatos no permitidos, archivos falsos y archivos muy grandes
- el veterinario adjunta un PDF y una imagen; el nombre se limpia
- la historia lista los adjuntos sin exponer rutas de disco, al dueño y al veterinario
- el dueño descarga el archivo; otros no
- otro veterinario ve el archivo pero no puede agregar ni quitar
- una entrada admite hasta 10 archivos
- el autor elimina un archivo: desaparece de la lista y del disco
- al eliminar la entrada, el dueño deja de ver sus archivos y no se pueden agregar mas

### AN-22 — Visualizar notificaciones por usuario

**AN-22 y AN-23: visualizar notificaciones**
- el cliente ve sus avisos, del mas reciente al mas antiguo, con el contador de sin leer
- el veterinario ve los avisos de nuevas citas y cancelaciones
- marcar todas como leidas deja el contador en cero solo para ese usuario
- sin sesion responde 401

**Mejora: recordatorios de 24 horas**
- avisa al cliente y al veterinario una sola vez
- el veterinario si puede cancelar aunque falte poco

### AN-23 — Visualizar notificaciones por veterinario

**AN-22 y AN-23: visualizar notificaciones**
- el cliente ve sus avisos, del mas reciente al mas antiguo, con el contador de sin leer
- el veterinario ve los avisos de nuevas citas y cancelaciones
- marcar todas como leidas deja el contador en cero solo para ese usuario
- sin sesion responde 401

**Urgencias (lo que AN-23 llamaba emergencias)**
- sin veterinarios en su horario se avisa y no se crea la urgencia
- la mascota es obligatoria al pedir una urgencia
- valida descripcion, modalidad, direccion, telefono y la mascota
- ya no existe el turno aparte; un veterinario sin aprobar no atiende urgencias
- los veterinarios reciben urgencias segun su horario de atencion (Mi horario)
- otro cliente no puede cancelar la urgencia ajena
- un veterinario con un bloqueo de agenda no recibe urgencias; los demas ven los datos de contacto
- una urgencia a domicilio solo llega a veterinarios que atienden a domicilio
- si dos veterinarios la aceptan a la vez, solo uno se queda con ella
- al aceptar, la urgencia ocupa la agenda del veterinario con una cita confirmada
- el dueño ve quien la atiende y como contactarlo, y recibe un aviso
- un veterinario con una urgencia en curso no recibe ni acepta otra
- al aceptar una urgencia, el veterinario accede a la historia de esa mascota hasta que la libera
- si el veterinario tiene una cita en ese rato, la urgencia tiene prioridad y se pide reagendar
- si el dueño cancela una urgencia aceptada, se avisa al veterinario y se libera la agenda
- la urgencia se atiende como una cita: iniciar, historia clinica y terminar
- terminar sin registrar una urgencia la devuelve a las urgencias abiertas
- el dueño no puede cancelar una urgencia que ya se esta atendiendo
- una urgencia que nadie acepta a tiempo vence
- fuera de su horario el veterinario deja de recibir urgencias

### AN-26 — Visualizar perfil detallado y servicios del veterinario

**Mejora: perfil editable, foto y tarjeta profesional**
- el veterinario ve y edita su perfil
- sube una foto y queda publica
- rechaza archivos que no son imagenes aunque digan serlo
- la tarjeta profesional solo la descarga el administrador
- quitar la foto vuelve a las iniciales

### AN-27 — Buscar veterinarios por nombre o por servicio

**AN-27: buscar veterinarios por nombre o servicio**
- por nombre del profesional, sin distinguir mayusculas
- por nombre de un servicio que ofrece
- combinado con la modalidad: no atiende a domicilio (criterio 2)
- busqueda demasiado larga responde 400

**Mejora: buscador con filtros, orden y proximo turno**
- cada veterinario trae su proximo turno libre
- filtra por zona del consultorio
- filtra por precio maximo
- ordena por precio de menor a mayor
- 'atiende hoy' solo deja a quienes tienen turno hoy
- parametros invalidos responden 400

### AN-28 — Agregar servicios al perfil profesional

**AN-28: agregar servicios al perfil profesional**
- con la cuenta pendiente el servicio se guarda pero queda oculto (criterio 2)
- con el nombre en blanco se bloquea el guardado (criterio 3)
- un cliente no puede usar el panel del veterinario

### AN-29 — Eliminar servicios del perfil

**AN-30 y AN-29: el historial de citas no cambia**
- cambiar el precio de un servicio ya agendado no altera la cita anterior
- eliminar un servicio lo quita del perfil y ya no se puede agendar (AN-29 criterio 1)
- las citas agendadas con el servicio eliminado conservan su detalle (AN-29 criterio 2)

### AN-30 — Asignar y modificar precios de los servicios

**AN-30: asignar y modificar precios**
- un cliente no puede editar servicios
- modificar el precio responde 'Precio actualizado correctamente' y se ve en el perfil

**AN-30 y AN-29: el historial de citas no cambia**
- cambiar el precio de un servicio ya agendado no altera la cita anterior
- eliminar un servicio lo quita del perfil y ya no se puede agendar (AN-29 criterio 1)
- las citas agendadas con el servicio eliminado conservan su detalle (AN-29 criterio 2)

### AN-31 — Configurar horario base y bloqueos excepcionales

**AN-31: horario base y bloqueos excepcionales**
- el veterinario tiene el horario inicial de lunes a viernes
- rechaza franjas invalidas o que se cruzan
- un horario de 07:00 a 12:00 se aplica a todos los dias laborales (criterio 1)
- el cliente agenda el lunes a las 08:00
- validaciones del bloqueo: sin horas, fin antes que inicio, fecha pasada
- bloquear el martes de 07:00 a 09:00 oculta esos turnos al cliente (criterios 2 y 3)
- el cliente no puede agendar dentro del bloqueo
- si hay citas en el rango, avisa y pide confirmacion (criterio 4)
- al confirmar, bloquea, cancela la cita y avisa al cliente (criterio 4)
- el listado muestra los bloqueos y quitar uno libera los turnos
- un bloqueo de dia completo deja el dia sin turnos

### AN-35 — Verificacion de cuentas de veterinarios

**AN-35 y AN-38: verificacion de veterinarios y listado de usuarios**
- solo el administrador entra al panel de usuarios
- el listado muestra nombre, rol, fecha de registro y estado (AN-38 criterio 1)
- el filtro de estado devuelve solo ese estado (AN-38 criterio 2)
- una busqueda sin coincidencias devuelve una lista vacia (AN-38 criterio 3)
- filtros invalidos responden 400
- aprobar o rechazar solo aplica a veterinarios
- al aprobar, el estado pasa a ACTIVE y se notifica al veterinario (criterio 2)
- aprobar dos veces responde 409
- ya aprobado, el perfil y su servicio son publicos (AN-28 criterio 1)
- al rechazar, la cuenta queda denegada y no puede iniciar sesion (criterio 3)

### AN-37 — Suspension y bloqueo de cuentas

**AN-37: suspension y bloqueo de cuentas**
- al suspender, la sesion activa deja de servir y no puede volver a entrar
- al suspender a un veterinario sus citas futuras se cancelan y se avisa a los clientes
- un veterinario suspendido desaparece de las busquedas
- suspender dos veces responde 409 y a un administrador 403
- al reactivar recupera su visibilidad y sus funciones (criterio 3)
- id inexistente responde 404

### AN-38 — Visualizacion y gestion general de usuarios

**AN-35 y AN-38: verificacion de veterinarios y listado de usuarios**
- solo el administrador entra al panel de usuarios
- el listado muestra nombre, rol, fecha de registro y estado (AN-38 criterio 1)
- el filtro de estado devuelve solo ese estado (AN-38 criterio 2)
- una busqueda sin coincidencias devuelve una lista vacia (AN-38 criterio 3)
- filtros invalidos responden 400
- aprobar o rechazar solo aplica a veterinarios
- al aprobar, el estado pasa a ACTIVE y se notifica al veterinario (criterio 2)
- aprobar dos veces responde 409
- ya aprobado, el perfil y su servicio son publicos (AN-28 criterio 1)
- al rechazar, la cuenta queda denegada y no puede iniciar sesion (criterio 3)

## Funcionalidad sin código de historia (mejoras y transversales)

**Documentacion OpenAPI** (3)
- cada ruta del backend esta documentada y no hay rutas documentadas que no existan
- openapi.json esta al dia (se regenera con npm run openapi)
- cada operacion tiene resumen, etiqueta y respuestas; las privadas piden token

**zona horaria de la clinica** (8)
- una hora de pared de Bogota es un instante 5 horas despues en UTC
- ida y vuelta: fecha, hora y dia de la semana se conservan
- parseDate rechaza fechas inexistentes y formatos malos
- 'hoy' se calcula con la hora de Bogota, no con UTC
- a las 8:20 de la manana se ofrecen los turnos desde las 09:00
- a las 10:10 ya no se ofrecen los turnos de las 09:00 ni de las 10:00
- las citas ocupadas y los bloqueos se descuentan
- describeDateTime usa la hora de la clinica

**sesion por cookie HttpOnly** (4)
- el login deja una cookie HttpOnly con SameSite y vencimiento
- la cookie autentica sin cabecera Authorization
- sin cookie ni token responde 401
- logout borra la cookie (Max-Age=0)

**proteccion CSRF para peticiones con cookie** (2)
- una peticion que cambia datos desde otro origen es rechazada; desde el origen autorizado pasa
- con Bearer no aplica la comprobacion de origen (no es un ataque de cookie)

**tokens** (4)
- rechaza un token firmado con otra clave, sin emisor o con otro algoritmo
- rechaza un token con algoritmo none
- logout-all invalida todas las sesiones anteriores
- cambiar la contrasena cierra las demas sesiones pero conserva la actual

**contrasenas** (1)
- rechaza cortas, sin numero, sin letra, comunes y de mas de 72 bytes

**cabeceras y sondeo** (3)
- la API responde sin cache, con CSP restrictiva y sin X-Powered-By
- CORS permite credenciales solo al origen autorizado
- el login no revela si el correo existe (mismo mensaje y codigo)

**todas las rutas privadas exigen sesion** (1)
- cada ruta registrada, salvo las publicas conocidas, responde 401 sin sesion

**Mejora: mascotas del dueño** (7)
- registra una mascota
- valida nombre, especie, sexo, fecha y peso
- lista solo las mascotas propias y activas
- actualiza los datos y otro cliente no puede tocarla
- un veterinario no gestiona mascotas
- se agenda una cita con la mascota y el veterinario la ve en su agenda
- no se puede agendar con la mascota de otro cliente

**Mejora: resenas despues de una cita atendida** (3)
- no se puede calificar una cita que no fue atendida
- despues de atendida, el cliente la califica y se actualiza el promedio
- solo se califica una vez y el veterinario no puede calificar

**PDF de la historia clinica y carnet de vacunas** (2)
- el dueño descarga el PDF de su mascota
- el veterinario con relacion tambien; otro cliente o sin sesion no

**Mejora: paginacion del panel de administracion** (2)
- pagina el listado y pone primero a los pendientes
- pagina o tamano invalidos responden 400

**Cuenta: recuperar contrasena** (2)
- responde igual exista o no el correo, y solo crea token para correos registrados
- con el enlace del correo se cambia la contrasena y el enlace deja de servir

**Cuenta: mi cuenta** (3)
- edita el nombre
- cambiar la contrasena exige la actual y una nueva valida
- eliminar la cuenta exige la contrasena, anonimiza y cancela citas futuras

**Seguridad: limite de intentos de inicio de sesion** (2)
- tras 5 intentos fallidos el sexto responde 429 aunque la clave sea correcta
- las respuestas llevan cabeceras de seguridad

**Pago simulado de la cita** (4)
- el cliente paga su cita con servicio; ya no se puede pagar dos veces
- solo el dueño de la cita paga; el veterinario y otro cliente no
- una cita sin servicio (sin valor) no se paga
- cancelar una cita pagada registra el reembolso simulado

**Ficha de la mascota (raza, microchip, alergias)** (3)
- se guarda la ficha basica y aparece en la lista
- modificar sin enviar la ficha no la borra; enviarla vacia si
- valida el microchip y que no se repita en otra mascota

**Vacunas con proxima dosis, recetas y control de seguimiento** (5)
- una consulta guarda vacunas, receta y proximo control
- valida vacunas, medicamentos y fecha del control
- modificar reemplaza las listas que se envian y respeta las que no
- la receta se descarga en PDF: dueño y veterinario si; otro cliente y una consulta sin receta no
- avisa al dueño de la vacuna y del control proximos, una sola vez

**Auditoria de accesos a la historia clinica (Ley 1581)** (3)
- el dueño ve quien consulto la historia de su mascota, sin contar sus propias consultas
- solo el dueño ve los accesos; el resto no
- el administrador consulta el registro completo con filtros; los demas no

**Directorio de pacientes del veterinario** (2)
- lista las mascotas que atiende, con dueño, visitas y filtro por nombre
- un veterinario no ve los pacientes de otro, y un cliente no entra

**Recordatorios de vacunas y controles del dueño** (3)
- el dueño ve las proximas dosis y controles de sus mascotas
- solo cuenta la ultima aplicacion: una dosis posterior reemplaza el recordatorio anterior
- otro dueño no ve nada ajeno; un veterinario no usa este endpoint

**Datos personales: exportar y version de la politica (habeas data)** (3)
- el titular descarga todos sus datos en JSON y queda registrado
- el veterinario exporta tambien su perfil profesional
- al registrarse se guarda la version de la politica aceptada

**Panel de metricas del administrador** (2)
- el administrador ve el resumen; un cliente o un veterinario no
- cuenta las citas atendidas y las calificaciones

**Robustez: reservas simultaneas y limites** (2)
- dos clientes que reservan la misma hora a la vez: solo uno la consigue
- recuperar contraseña: tras 5 pedidos para el mismo correo se limita, sin revelar si existe

## Pruebas de interfaz por archivo

| Archivo | Casos | Historias |
|---|---|---|
| components/Adjuntos.test.jsx | 6 | AN-18, AN-21 |
| components/AgendaSemanal.test.jsx | 4 | AN-17 |
| components/Alerta.test.jsx | 4 | Transversal |
| components/CitaTarjeta.test.jsx | 14 | AN-14, AN-15, AN-16 |
| components/historia/historia.test.jsx | 8 | AN-18, AN-21 |
| components/MapaUbicacion.test.jsx | 6 | AN-10, AN-11 |
| components/Selector.test.jsx | 6 | Transversal |
| components/ToastProvider.test.jsx | 9 | Transversal |
| components/UrgenciaCliente.test.jsx | 7 | AN-23 |
| components/UrgenciaVeterinario.test.jsx | 8 | AN-23 |
| pages/AdminAuditoria.test.jsx | 3 | AN-38 |
| pages/AdminMetricas.test.jsx | 3 | AN-38 |
| pages/AgendarCita.test.jsx | 8 | AN-13 |
| pages/Login.test.jsx | 8 | Transversal |
| pages/Pacientes.test.jsx | 5 | AN-18, AN-21 |
| pages/Register.test.jsx | 6 | Transversal |
| services/api.test.js | 8 | AN-8, AN-37 |
| services/appointment.service.test.js | 4 | AN-14, AN-16 |
| services/ayudantes.test.js | 18 | Transversal |
| services/mapas.test.js | 7 | AN-10, AN-11 |
| services/medicalRecord.service.test.js | 6 | AN-21 |
| services/zona.test.js | 3 | Transversal |
| utils/nombres.test.js | 5 | Transversal |
