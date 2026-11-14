import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import api from "./api";
import { haySesionActiva, tokenVencido, tomarAvisoDeSesion } from "./auth.service";

// Un JWT con la carga indicada (la firma no importa: el frontend no la valida).
function jwt(carga) {
  const base64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${base64({ alg: "HS256" })}.${base64(carga)}.firma`;
}

// Responde a la siguiente peticion con un error HTTP, como lo haria el backend.
function responderCon(status, data = {}) {
  api.defaults.adapter = async (config) => {
    const error = new Error(`HTTP ${status}`);
    error.config = config;
    error.response = { status, data, config };
    throw error;
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("location", { pathname: "/dashboard", assign: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("sesion vencida", () => {
  test("un 401 con sesion guardada la borra y lleva al login con un aviso", async () => {
    localStorage.setItem("token", "abc");
    localStorage.setItem("usuario", "{}");
    responderCon(401, { message: "Sesion invalida o expirada." });

    await expect(api.get("/pets")).rejects.toBeDefined();

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("usuario")).toBeNull();
    expect(window.location.assign).toHaveBeenCalledWith("/login");
    expect(tomarAvisoDeSesion()).toMatch(/sesión expiró/);
  });

  test("un 401 del propio login (clave incorrecta) no cierra nada ni redirige", async () => {
    localStorage.setItem("token", "abc");
    responderCon(401, { message: "Correo o contraseña incorrectos." });

    await expect(api.post("/auth/login", {})).rejects.toBeDefined();

    expect(localStorage.getItem("token")).toBe("abc");
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test("sin sesion guardada un 401 no redirige", async () => {
    responderCon(401);
    await expect(api.get("/pets")).rejects.toBeDefined();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test("ya estando en el login no se vuelve a redirigir", async () => {
    vi.stubGlobal("location", { pathname: "/login", assign: vi.fn() });
    localStorage.setItem("token", "abc");
    responderCon(401);
    await expect(api.get("/pets")).rejects.toBeDefined();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});

describe("token vencido antes de pedir nada", () => {
  test("tokenVencido lee la fecha exp del JWT", () => {
    const ahora = Date.UTC(2026, 10, 16, 15, 0, 0);
    expect(tokenVencido(jwt({ exp: ahora / 1000 - 60 }), ahora)).toBe(true);
    expect(tokenVencido(jwt({ exp: ahora / 1000 + 60 }), ahora)).toBe(false);
    expect(tokenVencido("no-es-un-jwt", ahora)).toBe(false);
  });

  test("haySesionActiva cierra la sesion si el token ya vencio", () => {
    localStorage.setItem("token", jwt({ exp: Math.floor(Date.now() / 1000) - 10 }));
    expect(haySesionActiva()).toBe(false);
    expect(localStorage.getItem("token")).toBeNull();
    expect(tomarAvisoDeSesion()).toMatch(/sesión expiró/);
  });

  test("con un token vigente la sesion sigue activa", () => {
    localStorage.setItem("token", jwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    expect(haySesionActiva()).toBe(true);
  });
});
