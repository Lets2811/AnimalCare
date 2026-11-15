import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import api from "./api";
import { haySesionActiva, sesionVencida, tomarAvisoDeSesion } from "./auth.service";

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
    localStorage.setItem("usuario", "{}");
    responderCon(401, { message: "Sesion invalida o expirada." });

    await expect(api.get("/pets")).rejects.toBeDefined();

    expect(localStorage.getItem("usuario")).toBeNull();
    expect(window.location.assign).toHaveBeenCalledWith("/login");
    expect(tomarAvisoDeSesion()).toMatch(/sesión expiró/);
  });

  test("un 401 del propio login (clave incorrecta) no cierra nada ni redirige", async () => {
    localStorage.setItem("usuario", "{}");
    responderCon(401, { message: "Correo o contraseña incorrectos." });

    await expect(api.post("/auth/login", {})).rejects.toBeDefined();

    expect(localStorage.getItem("usuario")).toBe("{}");
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test("sin sesion guardada un 401 no redirige", async () => {
    responderCon(401);
    await expect(api.get("/pets")).rejects.toBeDefined();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test("ya estando en el login no se vuelve a redirigir", async () => {
    vi.stubGlobal("location", { pathname: "/login", assign: vi.fn() });
    localStorage.setItem("usuario", "{}");
    responderCon(401);
    await expect(api.get("/pets")).rejects.toBeDefined();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});

describe("sesion vencida antes de pedir nada", () => {
  test("sesionVencida compara la fecha de vencimiento con la hora actual", () => {
    const ahora = Date.UTC(2026, 10, 16, 15, 0, 0);
    expect(sesionVencida(ahora - 60_000, ahora)).toBe(true);
    expect(sesionVencida(ahora + 60_000, ahora)).toBe(false);
    expect(sesionVencida(null, ahora)).toBe(false);
    expect(sesionVencida("basura", ahora)).toBe(false);
  });

  test("haySesionActiva cierra la sesion si ya vencio", () => {
    localStorage.setItem("usuario", '{"role":"CLIENT"}');
    localStorage.setItem("sesionExpira", String(Date.now() - 10_000));
    expect(haySesionActiva()).toBe(false);
    expect(localStorage.getItem("usuario")).toBeNull();
    expect(tomarAvisoDeSesion()).toMatch(/sesión expiró/);
  });

  test("con la sesion vigente sigue activa; sin usuario guardado no hay sesion", () => {
    expect(haySesionActiva()).toBe(false);
    localStorage.setItem("usuario", '{"role":"CLIENT"}');
    localStorage.setItem("sesionExpira", String(Date.now() + 3_600_000));
    expect(haySesionActiva()).toBe(true);
  });

  test("el token no se guarda en el navegador al iniciar sesion", async () => {
    api.defaults.adapter = async (config) => ({
      status: 200, config, headers: {}, statusText: "OK",
      data: { token: "secreto", user: { role: "CLIENT" }, expiresAt: Date.now() + 1000 },
    });
    const { iniciarSesion } = await import("./auth.service");
    await iniciarSesion({ email: "a@b.co", password: "x" });
    expect(JSON.stringify(localStorage)).not.toContain("secreto");
    expect(api.defaults.withCredentials).toBe(true);
  });
});
