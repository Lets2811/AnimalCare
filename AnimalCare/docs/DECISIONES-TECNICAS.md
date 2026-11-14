# Decisiones técnicas

Registro de las decisiones de arquitectura de esta etapa: qué se hizo, qué se aplazó y **por qué**. Sirve para que
quien llegue después no tenga que adivinar si algo falta por olvido o por decisión.

Estado: ✅ hecho · ⏸ aplazado (con motivo) · ⛔ descartado.

## Lo que se hizo

| # | Decisión | Estado | Motivo |
|---|---|---|---|
| D1 | **Mantener Express** (no pasar a NestJS ni Fastify) | ✅ (decisión del equipo) | El código ya está en capas claras y probado; cambiar de framework no aporta valor al usuario |
| D2 | **Backend en TypeScript estricto** (`strict`) | ✅ | Atrapa errores de tipos antes de ejecutar (ya lo hizo: un import sin usar y varios nulos sin revisar). Prisma ya genera los tipos de la base |
| D3 | **Organización por dominios** (`src/modules/<dominio>/{controller,service,routes}`) | ✅ | Lo que cambia junto vive junto; cada módulo se entiende y se prueba por separado. Se migró con un script y se comprobó con el compilador y las pruebas |
| D4 | **Producción compilada**: `tsc` a `dist/`, imagen Docker de dos etapas con Node 22 | ✅ | La imagen final no lleva TypeScript ni dependencias de desarrollo |
| D5 | **Rutas independientes del código** (`RAIZ_BACKEND`, `UPLOADS_DIR`) | ✅ | `uploads/` y `openapi.json` se encuentran igual en `src/` y en `dist/` |
| D6 | **Archivos en disco** (fotos, tarjetas, adjuntos) hasta producción | ✅ (decisión del equipo) | Sin dependencias nuevas. `UPLOADS_DIR` permite apuntar a otro volumen |
| D7 | **Pagos simulados**, sin pasarela | ✅ (decisión del equipo) | Se ensaya el flujo (pagar, reembolsar) sin manejar datos de tarjetas |
| D8 | **Sin servicio de errores externo** (Sentry u otro) | ✅ (decisión del equipo) | Los datos de salud y de dueños no deben salir a un tercero sin un contrato de transmisión |
| D9 | **Mapas con enlaces públicos de Google Maps**, sin clave de API | ✅ | Cero costo y cero configuración. Contrapartida: la dirección se escribe a mano y no se valida; está informado en la política de privacidad |
| D10 | **Registro de auditoría sin llaves foráneas** | ✅ | Debe sobrevivir a la eliminación de la cuenta; por eso guarda el nombre y el rol del actor en el momento |
| D11 | **Vacunas estructuradas** (con próxima dosis y lote) **conviviendo con el texto libre** | ✅ | Las consultas antiguas solo tienen texto: el carnet usa las estructuradas y, si no hay, ese texto |
| D12 | **Candado por veterinario** (`SELECT … FOR UPDATE`) contra doble reserva | ✅ | Corrige un error real encontrado al revisar los flujos; ver la guía de cambios |
| D13 | **Documentación OpenAPI verificada por una prueba** | ✅ | Una ruta nueva sin documentar hace fallar el CI |

## Lo que se aplazó

| # | Tema | Por qué se aplazó | Cuándo conviene retomarlo |
|---|---|---|---|
| A1 | **PostgreSQL** en lugar de MySQL | El candado de D12 ya evita el doble agendado; migrar datos reales tiene riesgo y no hay producción todavía. Con PostgreSQL se podría garantizar el no-solapamiento **en la propia base** (restricción de exclusión) y se eliminarían las diferencias de mayúsculas en nombres de tablas | Antes de tener datos reales de varios consultorios |
| A2 | **Redis** (límites de intentos y recordatorios compartidos) | Hoy corre **una sola instancia**; el límite de intentos y el recordatorio viven en memoria | Cuando haya más de una instancia del backend (los recordatorios se duplicarían) |
| A3 | **Cola de trabajos** (BullMQ) para recordatorios y vencimiento de urgencias | Igual que A2: con una instancia, el temporizador interno basta | Junto con A2 |
| A4 | **Sesión en cookie `HttpOnly`** con renovación | El token en `localStorage` es vulnerable a XSS, pero cambiarlo toca el login, CORS, las pruebas y el frontend a la vez. Mitigado: vence a las 2 h, hay cabeceras de seguridad y no se inyecta HTML sin escapar | Antes de publicar en Internet |
| A5 | **Validación con Zod** | Cada controlador valida a mano y esas reglas (y sus mensajes, que prueban los tests) funcionan. Reescribirlas todas arriesga cambiar mensajes | Al agregar endpoints nuevos grandes, o junto con un cambio de API |
| A6 | **Frontend en TypeScript** | El frontend es JavaScript y tiene 123 pruebas; convertirlo no cambia lo que el usuario ve | Cuando el equipo del frontend crezca; se puede hacer carpeta por carpeta |
| A7 | **Logs estructurados (pino)** | `console.error` alcanza para un solo proceso; no hay dónde enviarlos todavía | Al desplegar con un recolector de logs |
| A8 | **Tests y scripts de desarrollo en TypeScript** | Las pruebas (JS) cubren el comportamiento y no hacen parte de la imagen; tipar 2.800 líneas de pruebas no reduce riesgo | Opcional |
| A9 | **Inventario de medicamentos, facturación real, hospitalización** | Son funciones de la administración interna de una clínica; AnimalCare conecta a dueños con veterinarios independientes | Si el producto pasa a ser software de gestión para una clínica |
| A10 | **Firma electrónica de recetas** | Requiere un proveedor y definir qué recetas la exigen (ver `cumplimiento-normativo.md`) | Con asesoría jurídica |

## Lo que se descartó

| # | Tema | Motivo |
|---|---|---|
| X1 | Microservicios | Un monolito modular escala bien para este tamaño; separar ahora solo añadiría operación y fallos de red |
| X2 | NestJS | Habría exigido reescribir controladores y servicios; ver D1 |

## Dónde mirar si algo falla

| Síntoma | Probable causa |
|---|---|
| `npm run dev` no arranca tras un pull | Falta `npm install` (nuevas dependencias) o `npx prisma generate` (cambió el esquema) |
| Prisma da `EPERM` al generar | El backend está corriendo y bloquea el motor: apágalo y vuelve a generar |
| Las pruebas de urgencias se omiten | Faltan menos de 30 minutos para la medianoche en Bogotá (la urgencia ocupa 30 min dentro del día) |
| `tsc` se queja de `req.user` | Falta `types/express.d.ts` en el `include` de `tsconfig.json` |
