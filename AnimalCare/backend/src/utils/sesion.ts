// Sesion por cookie HttpOnly: el navegador guarda el JWT y JavaScript no puede leerlo,
// asi un fallo de XSS no permite robar la sesion. Los clientes que no son navegador
// (pruebas, scripts) siguen pudiendo usar la cabecera Authorization: Bearer.
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

export const COOKIE_SESION = "ac_sesion";

// Lee las cookies de la peticion sin depender de una libreria.
export function leerCookies(cabecera: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const parte of (cabecera || "").split(";")) {
    const i = parte.indexOf("=");
    if (i < 1) continue;
    const nombre = parte.slice(0, i).trim();
    if (nombre === "") continue;
    try {
      cookies[nombre] = decodeURIComponent(parte.slice(i + 1).trim());
    } catch {
      // cookie mal codificada: se ignora
    }
  }
  return cookies;
}

// De donde viene el token: la cabecera Bearer tiene prioridad sobre la cookie.
export function tokenDeLaPeticion(req: Request): { token: string; porCookie: boolean } | null {
  const cabecera = req.headers.authorization || "";
  if (cabecera.startsWith("Bearer ")) {
    const token = cabecera.substring(7).trim();
    return token ? { token, porCookie: false } : null;
  }
  const token = leerCookies(req.headers.cookie)[COOKIE_SESION];
  return token ? { token, porCookie: true } : null;
}

function esHttps(req: Request): boolean {
  // Secure solo con HTTPS (directo o detras de un proxy): en http la cookie no se guardaria.
  // COOKIE_SECURE=true lo fuerza, por ejemplo si el proxy no envia X-Forwarded-Proto.
  return process.env.COOKIE_SECURE === "true" || req.secure || req.headers["x-forwarded-proto"] === "https";
}

// Milisegundos de vigencia del token (lee el exp del propio JWT).
export function vencimientoDelToken(token: string): number {
  const carga = jwt.decode(token) as { exp?: number } | null;
  return carga?.exp ? carga.exp * 1000 : Date.now() + 2 * 60 * 60 * 1000;
}

export function ponerCookieDeSesion(req: Request, res: Response, token: string): void {
  const expira = vencimientoDelToken(token);
  const partes = [
    `${COOKIE_SESION}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor((expira - Date.now()) / 1000))}`,
  ];
  if (esHttps(req)) partes.push("Secure");
  res.append("Set-Cookie", partes.join("; "));
}

export function borrarCookieDeSesion(req: Request, res: Response): void {
  const partes = [`${COOKIE_SESION}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (esHttps(req)) partes.push("Secure");
  res.append("Set-Cookie", partes.join("; "));
}

// Proteccion CSRF para las peticiones que se autentican por cookie: si cambian datos,
// el origen debe ser uno autorizado o el propio sitio (SameSite=Lax ya cubre lo demas).
export function origenesAutorizados(): string[] {
  return (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function origenPermitido(req: Request, permitidos: string[] = origenesAutorizados()): boolean {
  const origen = req.headers.origin;
  if (!origen) return true;
  if (permitidos.includes(origen)) return true;
  try {
    return new URL(origen).host === req.headers.host;
  } catch {
    return false;
  }
}
