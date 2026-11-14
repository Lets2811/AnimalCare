// Historias clinicas: /api/medical-records  (AN-18, AN-19, AN-20, AN-21)
import api from "./api";
import { leerArchivo } from "./vetPanel.service";

// { pet, records, pendingAppointments? }  (pendingAppointments solo para el veterinario)
export async function obtenerHistoria(petId) {
  const respuesta = await api.get(`/medical-records/pets/${petId}`);
  return respuesta.data;
}

// GET /api/medical-records/pets/:id/pdf: se descarga con el token (la ruta es privada) y se guarda el archivo.
export async function descargarHistoriaPdf(petId, nombreMascota = "mascota") {
  const respuesta = await api.get(`/medical-records/pets/${petId}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `historia-${nombreMascota}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Carnet de vacunas, de la mas reciente a la mas antigua. Junta las vacunas estructuradas (con proxima dosis
// y lote) y, para las consultas antiguas que solo tienen el texto libre, ese texto.
export function carnetDeVacunas(entradas) {
  const items = [];
  for (const r of entradas) {
    if (r.status === "ANNULLED") continue;
    const estructuradas = r.vaccinations || [];
    for (const v of estructuradas) {
      items.push({ id: `v${v.id}`, fecha: v.appliedAt, vacunas: v.name, proxima: v.nextDueAt, lote: v.lot, veterinario: r.vet?.name, orden: r.id });
    }
    if (estructuradas.length === 0 && r.vaccines && r.vaccines.trim() !== "") {
      items.push({ id: r.id, fecha: r.visitDate, vacunas: r.vaccines.trim(), proxima: null, lote: null, veterinario: r.vet?.name, orden: r.id });
    }
  }
  return items.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.orden - a.orden);
}

// Proximas dosis pendientes (desde hoy), la mas cercana primero. Se repite una vacuna solo en su ultima aplicacion.
export function proximasDosis(carnet, hoy) {
  const ultimaPorNombre = new Map();
  for (const v of carnet) {
    const clave = v.vacunas.trim().toLowerCase();
    if (!ultimaPorNombre.has(clave)) ultimaPorNombre.set(clave, v); // el carnet viene de lo mas reciente a lo mas antiguo
  }
  return [...ultimaPorNombre.values()].filter((v) => v.proxima && v.proxima >= hoy).sort((a, b) => a.proxima.localeCompare(b.proxima));
}

// Peso en cada consulta (de la mas antigua a la mas reciente), para el grafico de evolucion.
export function pesosDeLaHistoria(entradas) {
  return entradas
    .filter((r) => r.status !== "ANNULLED" && r.weight !== null && r.weight !== undefined)
    .map((r) => ({ fecha: r.visitDate, peso: r.weight, id: r.id }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
}

// Descarga la receta de una consulta (PDF). Se pide con el token porque la ruta es privada.
export async function descargarRecetaPdf(recordId) {
  const respuesta = await api.get(`/medical-records/${recordId}/prescription.pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `receta-${recordId}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Quien consulto, descargo o cambio la historia de la mascota (solo el dueño).
export async function obtenerAccesos(petId) {
  const respuesta = await api.get(`/medical-records/pets/${petId}/accesses`);
  return respuesta.data.accesses;
}

export async function crearEntrada(entrada) {
  const respuesta = await api.post("/medical-records", entrada);
  return respuesta.data;
}

export async function modificarEntrada(id, entrada) {
  const respuesta = await api.put(`/medical-records/${id}`, entrada);
  return respuesta.data;
}

export async function eliminarEntrada(id, reason) {
  const respuesta = await api.patch(`/medical-records/${id}/annul`, { reason });
  return respuesta.data;
}

// ---------- Adjuntos (examenes, radiografias) ----------

export const TIPOS_ADJUNTO = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_ADJUNTO_MB = 5;
export const MAX_ADJUNTOS = 10;

// Debe coincidir con los limites del backend.
export async function adjuntarArchivo(recordId, archivo) {
  const dataUrl = await leerArchivo(archivo);
  const respuesta = await api.post(`/medical-records/${recordId}/attachments`, { file: dataUrl, name: archivo.name });
  return respuesta.data;
}

export async function quitarAdjunto(id) {
  const respuesta = await api.delete(`/medical-records/attachments/${id}`);
  return respuesta.data;
}

// El archivo es privado: se pide con la sesion y se abre en otra pestana.
// La pestana se abre primero (con el clic) para que el navegador no la bloquee.
export async function abrirAdjunto(id) {
  const ventana = window.open("", "_blank");
  try {
    const respuesta = await api.get(`/medical-records/attachments/${id}`, { responseType: "blob" });
    const url = URL.createObjectURL(respuesta.data);
    if (ventana) {
      ventana.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    if (ventana) ventana.close();
    throw error;
  }
}

export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
