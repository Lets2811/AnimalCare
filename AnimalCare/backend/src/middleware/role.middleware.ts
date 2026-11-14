import type { Request, Response, NextFunction } from "express";
// Middleware de autorizacion por rol.
//
// La autenticacion responde "quien eres" (auth.middleware).
// Esto responde "que puedes hacer": agendar una cita es una accion del cliente,
// no del veterinario. Se usa siempre DESPUES de authenticate.
function requireRole(...roles: string[]) {
  return function verificarRol(req: Request, res: Response, next: NextFunction) {
    // Si authenticate no corrio antes, no hay usuario que revisar.
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado. Debes iniciar sesion." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "No tienes permiso para realizar esta accion." });
    }

    return next();
  };
}

export { requireRole };
