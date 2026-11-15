import type { Request, Response, NextFunction } from "express";
// Medidas basicas de seguridad HTTP.

// Cabeceras que evitan abusos comunes (sniffing de tipos, iframes ajenos,
// filtrado del referer). Equivalente reducido de helmet, sin dependencia.
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // Las respuestas de la API son JSON: no necesitan cargar nada. La documentacion (Swagger)
  // si ejecuta scripts propios, por eso queda fuera de esta politica.
  if (req.path?.startsWith("/api") && !req.path.startsWith("/api/docs")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    // Datos personales y clinicos: ni el navegador ni un proxy deben guardarlos.
    res.setHeader("Cache-Control", "no-store");
  }
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

// Limite de intentos para el inicio de sesion y la recuperacion de contrasena.
// Cuenta los fallos por IP + correo en memoria; tras `max` fallos en `windowMs`
// bloquea ese par durante `windowMs`. Sirve para una sola instancia del servidor.
interface OpcionesLimite {
  max?: number;
  windowMs?: number;
  keyFrom: (req: Request) => string;
}

function createRateLimit({ max = 5, windowMs = 15 * 60 * 1000, keyFrom }: OpcionesLimite) {
  const intentos = new Map<string, { fallos: number; hasta: number }>();

  function limpiar(ahora: number) {
    for (const [clave, dato] of intentos) {
      if (dato.hasta <= ahora) intentos.delete(clave);
    }
  }

  function middleware(req: Request, res: Response, next: NextFunction) {
    const ahora = Date.now();
    if (intentos.size > 1000) limpiar(ahora);
    const clave = keyFrom(req);
    const dato = intentos.get(clave);
    if (dato && dato.fallos >= max && dato.hasta > ahora) {
      const minutos = Math.ceil((dato.hasta - ahora) / 60000);
      res.setHeader("Retry-After", String(Math.ceil((dato.hasta - ahora) / 1000)));
      return res.status(429).json({
        message: `Demasiados intentos. Inténtalo de nuevo en ${minutos} minuto(s).`,
      });
    }
    // El controlador llama a req.rateLimit.fail() si el intento fracasa
    // y a req.rateLimit.reset() si tiene exito.
    req.rateLimit = {
      fail() {
        const actual = intentos.get(clave);
        if (!actual || actual.hasta <= ahora) {
          intentos.set(clave, { fallos: 1, hasta: ahora + windowMs });
        } else {
          actual.fallos += 1;
          actual.hasta = ahora + windowMs;
        }
      },
      reset() {
        intentos.delete(clave);
      },
    };
    return next();
  }

  middleware.clear = () => intentos.clear();
  return middleware;
}

function ipDe(req: Request) {
  return req.ip || req.socket?.remoteAddress || "desconocida";
}

// Junta varios limites: todos deben dejar pasar y un fallo se cuenta en todos.
// Un inicio de sesion correcto solo reinicia el primero (IP + correo), para que quien tenga
// una cuenta propia no pueda borrar el conteo global con el que se frena la fuerza bruta.
function combinarLimites(...limites: ReturnType<typeof createRateLimit>[]) {
  function middleware(req: Request, res: Response, next: NextFunction) {
    const controles: NonNullable<Request["rateLimit"]>[] = [];
    let i = 0;
    const paso = (): void => {
      if (i >= limites.length) {
        req.rateLimit = {
          fail: () => controles.forEach((c) => c.fail()),
          reset: () => controles[0]?.reset(),
        };
        return next();
      }
      limites[i++](req, res, () => {
        if (req.rateLimit) controles.push(req.rateLimit);
        paso();
      });
    };
    paso();
  }
  middleware.clear = () => limites.forEach((l) => l.clear());
  return middleware;
}

const loginPorParejaIpCorreo = createRateLimit({
  max: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  windowMs: (Number(process.env.LOGIN_LOCK_MINUTES) || 15) * 60 * 1000,
  keyFrom: (req: Request) => `${ipDe(req)}|${String(req.body?.email ?? "").trim().toLowerCase()}`,
});
// Contra el ataque que prueba un mismo correo desde muchas IP.
const loginPorCorreo = createRateLimit({
  max: Number(process.env.LOGIN_MAX_PER_EMAIL) || 20,
  windowMs: 60 * 60 * 1000,
  keyFrom: (req: Request) => `correo|${String(req.body?.email ?? "").trim().toLowerCase()}`,
});
// Contra el ataque que prueba muchos correos desde una misma IP.
const loginPorIp = createRateLimit({
  max: Number(process.env.LOGIN_MAX_PER_IP) || 40,
  windowMs: 15 * 60 * 1000,
  keyFrom: (req: Request) => `ip|${ipDe(req)}`,
});
const loginLimiter = combinarLimites(loginPorParejaIpCorreo, loginPorCorreo, loginPorIp);

// Limites por volumen, cada peticion cuenta. Solo se activan en produccion (o con
// LIMITES_ESTRICTOS=true) para no estorbar al desarrollo ni a las pruebas.
function limitePorVolumen(clave: string, max: number, windowMs: number) {
  const base = createRateLimit({ max, windowMs, keyFrom: (req: Request) => `${clave}|${ipDe(req)}` });
  function middleware(req: Request, res: Response, next: NextFunction) {
    if (process.env.NODE_ENV !== "production" && process.env.LIMITES_ESTRICTOS !== "true") return next();
    base(req, res, () => {
      req.rateLimit?.fail();
      next();
    });
  }
  middleware.clear = base.clear;
  return middleware;
}

// Toda la API: 600 peticiones por minuto y por IP (un uso normal queda muy por debajo).
const generalLimiter = limitePorVolumen("api", Number(process.env.API_MAX_PER_MINUTE) || 600, 60 * 1000);
// Altas de cuenta: frena la creacion masiva de usuarios falsos.
const registerLimiter = limitePorVolumen("registro", Number(process.env.REGISTER_MAX_PER_HOUR) || 10, 60 * 60 * 1000);

// Recuperacion de contrasena: cada peticion cuenta (no hay "fallo"), 5 por IP y correo cada hora.
// (Por IP y correo: una oficina o un colegio detras de la misma IP no se bloquean entre si.)
const forgotLimiter = createRateLimit({
  max: Number(process.env.FORGOT_MAX_REQUESTS) || 5,
  windowMs: 60 * 60 * 1000,
  keyFrom: (req: Request) => `forgot|${ipDe(req)}|${String(req.body?.email ?? "").trim().toLowerCase()}`,
});

export { securityHeaders, createRateLimit, combinarLimites, limitePorVolumen, loginLimiter, forgotLimiter, generalLimiter, registerLimiter };
