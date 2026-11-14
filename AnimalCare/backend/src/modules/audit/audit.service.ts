// Registro de auditoria (Ley 1581 de 2012, principios de seguridad y transparencia):
// deja constancia de quien consulto, descargo o cambio datos sensibles (historias clinicas) y de
// las exportaciones de datos personales. El dueño puede ver quien consulto la historia de su mascota.
//
// Un fallo al registrar NUNCA debe romper la accion principal: se informa por consola y se sigue.
import type { Request } from "express";

import prisma from "../../prisma";

export const ACCIONES = {
  VER_HISTORIA: "VIEW_HISTORY",
  DESCARGAR_PDF: "DOWNLOAD_PDF",
  DESCARGAR_RECETA: "DOWNLOAD_PRESCRIPTION",
  DESCARGAR_ADJUNTO: "DOWNLOAD_ATTACHMENT",
  CREAR_ENTRADA: "CREATE_RECORD",
  EDITAR_ENTRADA: "UPDATE_RECORD",
  ANULAR_ENTRADA: "ANNUL_RECORD",
  EXPORTAR_DATOS: "EXPORT_DATA",
} as const;

export type AccionAuditoria = (typeof ACCIONES)[keyof typeof ACCIONES];

export interface DatosAuditoria {
  entityType?: string;
  entityId?: number;
  petId?: number;
  // Dueño de los datos consultados (para que el pueda ver quien los consulto).
  ownerId?: number;
}

export async function auditar(req: Request, action: AccionAuditoria, datos: DatosAuditoria = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId: req.user?.id ?? null,
        actorName: req.user?.name ?? null,
        actorRole: req.user?.role ?? null,
        ip: req.ip ?? null,
        ...datos,
      },
    });
  } catch (error) {
    console.error("No se pudo registrar la auditoria:", error);
  }
}

// Texto para mostrar la accion en pantalla.
export const ETIQUETAS_ACCION: Record<string, string> = {
  VIEW_HISTORY: "Consultó la historia clínica",
  DOWNLOAD_PDF: "Descargó la historia en PDF",
  DOWNLOAD_PRESCRIPTION: "Descargó una receta",
  DOWNLOAD_ATTACHMENT: "Abrió un archivo adjunto",
  CREATE_RECORD: "Agregó una consulta",
  UPDATE_RECORD: "Modificó una consulta",
  ANNUL_RECORD: "Eliminó una consulta",
  EXPORT_DATA: "Exportó datos personales",
};
