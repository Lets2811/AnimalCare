// Pruebas unitarias de las reglas y ayudas puras de los servicios del frontend que aun no tenian cobertura:
// urgencias, cuentas, mascotas, veterinarios, notificaciones, sesion, citas (pago) y lectura de archivos.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { haceCuanto, horaLocal, telefonoValido, ESTADOS_URGENCIA, MIN_SINTOMAS, MAX_SINTOMAS } from "./emergency.service";
import { contrasenaValida } from "./account.service";
import api from "./api";
import { calcularEdad, ESPECIES } from "./pet.service";
import { formatearPrecio, urlDeFoto, describirTurno, MODALIDADES, DIAS_SEMANA } from "./vet.service";
import { formatearMomento } from "./notification.service";
import { esVeterinario, esAdministrador, esVeterinarioPendiente, guardarAvisoDeSesion, tomarAvisoDeSesion, obtenerUsuario, cerrarSesion } from "./auth.service";
import { formatoPesos, ESTADOS_PAGO, ESTADOS_CITA, formatearFecha } from "./appointment.service";
import { leerArchivo } from "./vetPanel.service";

// Lunes 16 de noviembre de 2026, 10:00 en Bogota.
const AHORA = new Date("2026-11-16T15:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(AHORA);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("urgencias: tiempos y telefono", () => {
  test("haceCuanto dice minutos y horas con el plural correcto", () => {
    const hace = (min) => new Date(AHORA.getTime() - min * 60000).toISOString();
    expect(haceCuanto(hace(0))).toBe("hace menos de 1 min");
    expect(haceCuanto(hace(7))).toBe("hace 7 min");
    expect(haceCuanto(hace(60))).toBe("hace 1 h");
    expect(haceCuanto(hace(65))).toBe("hace 1 h 5 min");
    expect(haceCuanto(hace(-5))).toBe("hace menos de 1 min"); // una fecha futura no da numeros negativos
  });

  test("horaLocal usa la zona de la clinica", () => {
    expect(horaLocal("2026-11-16T15:30:00Z")).toMatch(/10:30/);
  });

  test("telefonoValido acepta 7 a 15 digitos con +, espacios y guiones", () => {
    for (const bien of ["3001234567", "+57 300 123 4567", "300-123-4567", "1234567"]) expect(telefonoValido(bien)).toBe(true);
    for (const mal of ["", "123", "abc1234567", "1234567890123456", "300#1234567"]) expect(telefonoValido(mal)).toBe(false);
  });

  test("los limites de la descripcion y los estados coinciden con el backend", () => {
    expect([MIN_SINTOMAS, MAX_SINTOMAS]).toEqual([10, 500]);
    expect(Object.keys(ESTADOS_URGENCIA).sort()).toEqual(["ACCEPTED", "CANCELLED", "COMPLETED", "EXPIRED", "OPEN"]);
  });
});

describe("cuentas y mascotas", () => {
  test("contrasenaValida pide 8 a 72 caracteres con letra y numero", () => {
    expect(contrasenaValida("abcd1234")).toBe(true);
    expect(contrasenaValida("abc123")).toBe(false); // muy corta
    expect(contrasenaValida("abcdefgh")).toBe(false); // sin numero
    expect(contrasenaValida("12345678")).toBe(false); // sin letra
    expect(contrasenaValida("a1".repeat(40))).toBe(false); // mas de 72
    expect(contrasenaValida(undefined)).toBe(false);
  });

  test("calcularEdad: meses, años y plurales", () => {
    expect(calcularEdad("2026-11-10")).toBe("menos de 1 mes");
    expect(calcularEdad("2026-10-16")).toBe("1 mes");
    expect(calcularEdad("2026-05-16")).toBe("6 meses");
    expect(calcularEdad("2025-11-16")).toBe("1 año");
    expect(calcularEdad("2022-04-10")).toBe("4 años");
    expect(calcularEdad("2022-12-01")).toBe("3 años"); // aun no cumple el cuarto
  });

  test("las especies y las modalidades son las del backend", () => {
    expect(ESPECIES).toContain("Perro");
    expect(Object.keys(MODALIDADES).sort()).toEqual(["CLINIC", "HOME"]);
    expect(DIAS_SEMANA).toHaveLength(7);
  });
});

describe("veterinarios y notificaciones", () => {
  test("formatearPrecio usa pesos colombianos sin decimales", () => {
    expect(formatearPrecio(60000)).toMatch(/60\.000/);
    expect(formatearPrecio("45000.00")).toMatch(/45\.000/);
  });

  test("urlDeFoto deja intacto lo externo y apunta las subidas al servidor de la API", () => {
    expect(urlDeFoto(null)).toBeNull();
    expect(urlDeFoto("https://x.test/a.png")).toBe("https://x.test/a.png");
    expect(urlDeFoto("/uploads/photos/a.png")).toMatch(/\/uploads\/photos\/a\.png$/);
  });

  test("describirTurno dice Hoy, Mañana o la fecha", () => {
    expect(describirTurno(null)).toBeNull();
    expect(describirTurno({ date: "2026-11-16", time: "15:00" })).toBe("Hoy 15:00");
    expect(describirTurno({ date: "2026-11-17", time: "09:00" })).toBe("Mañana 09:00");
    expect(describirTurno({ date: "2026-11-20", time: "09:00" })).toMatch(/09:00/);
  });

  test("formatearMomento muestra dia y hora", () => {
    expect(formatearMomento("2026-11-16T15:30:00Z")).toMatch(/16/);
  });
});

describe("sesion y roles", () => {
  const guardar = (usuario) => localStorage.setItem("usuario", JSON.stringify(usuario));

  test("los roles salen del usuario guardado", () => {
    expect([esVeterinario(), esAdministrador()]).toEqual([false, false]);
    guardar({ role: "VETERINARIAN", status: "ACTIVE" });
    expect([esVeterinario(), esAdministrador(), esVeterinarioPendiente()]).toEqual([true, false, false]);
    guardar({ role: "VETERINARIAN", status: "PENDING" });
    expect(esVeterinarioPendiente()).toBe(true);
    guardar({ role: "ADMIN" });
    expect(esAdministrador()).toBe(true);
  });

  test("un usuario guardado corrupto se trata como sin sesion", () => {
    localStorage.setItem("usuario", "{no es json");
    expect(obtenerUsuario()).toBeNull();
  });

  test("cerrarSesion borra los datos locales", () => {
    api.defaults.adapter = async (config) => ({ status: 200, config, headers: {}, statusText: "OK", data: {} });
    localStorage.setItem("sesionExpira", "1");
    guardar({ role: "CLIENT" });
    cerrarSesion();
    expect([localStorage.getItem("sesionExpira"), obtenerUsuario()]).toEqual([null, null]);
  });

  test("el aviso de sesion se muestra una sola vez", () => {
    guardarAvisoDeSesion("Tu cuenta fue suspendida.");
    expect(tomarAvisoDeSesion()).toBe("Tu cuenta fue suspendida.");
    expect(tomarAvisoDeSesion()).toBeNull();
  });
});

describe("citas: pago, estados y fechas", () => {
  test("formatoPesos y etiquetas", () => {
    expect(formatoPesos(60000)).toMatch(/60\.000/);
    expect(ESTADOS_PAGO.PAID).toBe("Pagada");
    expect(ESTADOS_CITA.IN_PROGRESS).toBe("En atención");
  });

  test("formatearFecha no se corre de dia por la zona horaria", () => {
    expect(formatearFecha("2026-11-16")).toMatch(/16 de noviembre de 2026/);
    expect(formatearFecha("2027-01-01")).toMatch(/1 de enero de 2027/);
  });
});

describe("leerArchivo", () => {
  test("devuelve el contenido como data URL", async () => {
    const archivo = new File(["hola"], "nota.txt", { type: "text/plain" });
    await expect(leerArchivo(archivo)).resolves.toMatch(/^data:text\/plain;base64,/);
  });
});
