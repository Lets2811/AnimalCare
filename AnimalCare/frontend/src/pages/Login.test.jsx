// Pruebas de la pantalla de inicio de sesion y de la proteccion de rutas por rol.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../services/auth.service", () => ({
  iniciarSesion: vi.fn(),
  tomarAvisoDeSesion: vi.fn(() => ""),
  haySesionActiva: vi.fn(),
  obtenerUsuario: vi.fn(),
}));
vi.mock("../components/Carrusel", () => ({ default: () => null }));

import * as auth from "../services/auth.service";
import Login from "./Login";
import RutaPrivada from "../components/RutaPrivada";

function pantalla() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<p>PANEL</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.tomarAvisoDeSesion.mockReturnValue("");
});

describe("Login", () => {
  test("avisa de los campos vacios y no llama al servicio", async () => {
    pantalla();
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByText("El correo es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La contraseña es obligatoria.")).toBeInTheDocument();
    expect(auth.iniciarSesion).not.toHaveBeenCalled();
  });

  test("con datos validos inicia sesion (correo sin espacios) y va al panel", async () => {
    auth.iniciarSesion.mockResolvedValue({});
    pantalla();
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), "  a@b.co ");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "Demo1234");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(screen.getByText("PANEL")).toBeInTheDocument());
    expect(auth.iniciarSesion).toHaveBeenCalledWith({ email: "a@b.co", password: "Demo1234" });
  });

  test("muestra el error del servidor y deja volver a intentar", async () => {
    auth.iniciarSesion.mockRejectedValue({ response: { data: { message: "Credenciales inválidas." } } });
    pantalla();
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), "a@b.co");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(/Credenciales inválidas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("muestra el motivo si la sesion se cerro por suspension", () => {
    auth.tomarAvisoDeSesion.mockReturnValue("Tu cuenta fue suspendida.");
    pantalla();
    expect(screen.getByText("Tu cuenta fue suspendida.")).toBeInTheDocument();
  });
});

describe("RutaPrivada", () => {
  function ruta(roles) {
    render(
      <MemoryRouter initialEntries={["/privada"]}>
        <Routes>
          <Route path="/login" element={<p>LOGIN</p>} />
          <Route path="/dashboard" element={<p>PANEL</p>} />
          <Route path="/privada" element={<RutaPrivada roles={roles}><p>SECRETO</p></RutaPrivada>} />
        </Routes>
      </MemoryRouter>
    );
  }

  test("sin sesion manda al login", () => {
    auth.haySesionActiva.mockReturnValue(false);
    ruta();
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });

  test("con sesion y sin restriccion de rol muestra el contenido", () => {
    auth.haySesionActiva.mockReturnValue(true);
    ruta();
    expect(screen.getByText("SECRETO")).toBeInTheDocument();
  });

  test("con un rol no permitido vuelve al panel; con el rol correcto entra", () => {
    auth.haySesionActiva.mockReturnValue(true);
    auth.obtenerUsuario.mockReturnValue({ role: "CLIENT" });
    ruta(["ADMIN"]);
    expect(screen.getByText("PANEL")).toBeInTheDocument();
  });

  test("el rol permitido ve el contenido", () => {
    auth.haySesionActiva.mockReturnValue(true);
    auth.obtenerUsuario.mockReturnValue({ role: "ADMIN" });
    ruta(["ADMIN"]);
    expect(screen.getByText("SECRETO")).toBeInTheDocument();
  });
});
