import { RAIZ_BACKEND } from "./raiz";
// Archivos que suben los usuarios: foto del veterinario (publica) y
// tarjeta profesional (privada, solo la ve el administrador).
//
// Llegan como data URL en JSON ("data:image/png;base64,...") para no sumar
// dependencias. Se validan tipo y tamano antes de escribir en disco.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// UPLOADS_DIR permite apuntar a otro disco o volumen; por defecto, backend/uploads.
const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(RAIZ_BACKEND, "uploads");
const PHOTOS_DIR = path.join(UPLOADS_DIR, "photos"); // se sirve en /uploads/photos
const DOCS_DIR = path.join(UPLOADS_DIR, "docs"); // NO se sirve publicamente
const RECORDS_DIR = path.join(UPLOADS_DIR, "records"); // adjuntos de historias clinicas: NO publico

const TIPOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Firma de los primeros bytes de cada tipo: evita aceptar un archivo que
// solo dice ser una imagen.
const FIRMAS = {
  "image/jpeg": (b: any) => b[0] === 0xff && b[1] === 0xd8,
  "image/png": (b: any) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b: any) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP",
  "application/pdf": (b: any) => b.slice(0, 4).toString() === "%PDF",
};

// Devuelve { error } o { buffer, mime, extension }.
type ResultadoDataUrl = { error: string } | { error?: undefined; buffer: Buffer; mime: string; extension: string };

function parseDataUrl(dataUrl: unknown, { tipos, maxBytes }: { tipos: string[]; maxBytes: number }): ResultadoDataUrl {
  const match = /^data:([a-z/]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl ?? ""));
  if (!match) {
    return { error: "El archivo no es válido." };
  }
  const mime = match[1];
  if (!tipos.includes(mime)) {
    return { error: `Formato no permitido. Usa: ${tipos.map((t) => TIPOS[t as keyof typeof TIPOS].toUpperCase()).join(", ")}.` };
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) {
    return { error: "El archivo está vacío." };
  }
  if (buffer.length > maxBytes) {
    return { error: `El archivo no puede pesar más de ${Math.round(maxBytes / (1024 * 1024))} MB.` };
  }
  if (!FIRMAS[mime as keyof typeof FIRMAS](buffer)) {
    return { error: "El contenido del archivo no coincide con su formato." };
  }
  return { buffer, mime, extension: TIPOS[mime as keyof typeof TIPOS] };
}

async function guardar(dir: any, prefijo: any, archivo: any) {
  await fs.mkdir(dir, { recursive: true });
  const nombre = `${prefijo}-${crypto.randomBytes(8).toString("hex")}.${archivo.extension}`;
  await fs.writeFile(path.join(dir, nombre), archivo.buffer);
  return nombre;
}

// Borra un archivo anterior sin fallar si ya no existe.
async function borrar(rutaAbsoluta: any) {
  try {
    await fs.unlink(rutaAbsoluta);
  } catch {
    // Ya no estaba.
  }
}

// La foto se guarda como ruta publica relativa: "/uploads/photos/vet-7-ab12.jpg".
async function savePhoto(vetProfileId: number, archivo: any) {
  const nombre = await guardar(PHOTOS_DIR, `vet-${vetProfileId}`, archivo);
  return `/uploads/photos/${nombre}`;
}

async function deletePhoto(photoUrl: any) {
  if (photoUrl && photoUrl.startsWith("/uploads/photos/")) {
    await borrar(path.join(PHOTOS_DIR, path.basename(photoUrl)));
  }
}

// El documento se guarda solo con su nombre; se lee con docAbsolutePath.
async function saveDoc(vetProfileId: number, archivo: any) {
  return guardar(DOCS_DIR, `tarjeta-${vetProfileId}`, archivo);
}

function docAbsolutePath(nombre: string) {
  // basename evita que un valor manipulado salga de la carpeta.
  return path.join(DOCS_DIR, path.basename(nombre));
}

async function deleteDoc(nombre: string) {
  if (nombre) {
    await borrar(docAbsolutePath(nombre));
  }
}

// Adjuntos de la historia clinica: se guardan con nombre aleatorio y solo se
// entregan por la API, verificando sesion y permiso.
async function saveRecordFile(archivo: any) {
  return guardar(RECORDS_DIR, "adjunto", archivo);
}

function recordFileAbsolutePath(nombre: string) {
  return path.join(RECORDS_DIR, path.basename(nombre));
}

async function deleteRecordFile(nombre: string) {
  if (nombre) {
    await borrar(recordFileAbsolutePath(nombre));
  }
}

// Nombre de archivo seguro para mostrar y para la cabecera de descarga:
// sin rutas, sin caracteres de control y de largo acotado.
function cleanFileName(value: unknown, extension: any) {
  let nombre = String(value ?? "").split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim();
  if (nombre === "" || nombre === "." || nombre === "..") {
    nombre = `adjunto.${extension}`;
  }
  if (nombre.length > 100) {
    const punto = nombre.lastIndexOf(".");
    const ext = punto > 0 ? nombre.slice(punto) : "";
    nombre = nombre.slice(0, 100 - ext.length) + ext;
  }
  return nombre;
}

export { UPLOADS_DIR, PHOTOS_DIR, parseDataUrl, savePhoto, deletePhoto, saveDoc, docAbsolutePath, deleteDoc, saveRecordFile, recordFileAbsolutePath, deleteRecordFile, cleanFileName };
