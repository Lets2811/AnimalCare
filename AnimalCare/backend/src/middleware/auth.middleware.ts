import type { Request, Response, NextFunction } from "express";
// Middleware de autenticacion.
// Protege las rutas privadas: sin un JWT valido, la peticion no continua.
//
// IMPORTANTE: el id del usuario se obtiene SIEMPRE del token, nunca del body
// ni de la URL. Asi el cliente no puede hacerse pasar por otro usuario.
import jwt from "jsonwebtoken";

import prisma from "../prisma";
import { isBlocked, blockedResponse } from "../utils/accountStatus";
import { tokenDeLaPeticion, origenPermitido } from "../utils/sesion";
import { JWT_ALGORITMO, JWT_EMISOR, JWT_AUDIENCIA } from "../modules/auth/auth.service";

async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // El token llega por la cookie HttpOnly (navegador) o por Authorization: Bearer <token>.
    const entrada = tokenDeLaPeticion(req);
    if (!entrada) {
      return res.status(401).json({ message: "No autorizado. Debes iniciar sesion." });
    }
    const { token, porCookie } = entrada;

    // CSRF: con cookie, una peticion que cambia datos debe venir de un origen autorizado.
    if (porCookie && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !origenPermitido(req)) {
      return res.status(403).json({ message: "Origen no autorizado." });
    }

    // Verifica la firma y la expiracion del token.
    let payload;
    try {
      // Algoritmo, emisor y audiencia fijos: rechaza tokens con otra firma o de otro sistema.
      payload = jwt.verify(token, process.env.JWT_SECRET as string, {
        algorithms: [JWT_ALGORITMO],
        issuer: JWT_EMISOR,
        audience: JWT_AUDIENCIA,
      }) as { userId: number; tv?: number };
    } catch (error) {
      // Token invalido, manipulado o expirado.
      return res.status(401).json({ message: "Sesion invalida o expirada. Inicia sesion nuevamente." });
    }

    // El usuario podria haber sido eliminado despues de emitirse el token.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        privacyAcceptedAt: true,
        privacyVersion: true,
        createdAt: true,
        tokenVersion: true,
        // El perfil profesional solo existe si la cuenta es de un veterinario.
        vetProfile: {
          select: {
            id: true,
            license: true,
            specialty: true,
            homeService: true,
            clinicService: true,
          },
        },
      },
    });

    // Un cambio de clave o "cerrar todas las sesiones" sube tokenVersion y deja sin efecto los tokens anteriores.
    if (!user || (payload.tv ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ message: "Sesion invalida o expirada. Inicia sesion nuevamente." });
    }

    // AN-37: si el administrador suspendio la cuenta mientras tenia la sesion
    // abierta, el token deja de servir desde la siguiente peticion.
    if (isBlocked(user.status)) {
      return blockedResponse(res, user.status);
    }

    // Queda disponible para los controladores: req.user.id es el propietario.
    const { tokenVersion: _tv, ...publico } = user;
    req.user = { ...publico, emailVerified: Boolean(user.emailVerifiedAt) };
    return next();
  } catch (error) {
    console.error("Error en el middleware de autenticacion:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

export { authenticate };
