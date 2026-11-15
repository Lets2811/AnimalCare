// Pruebas del formulario de registro: validaciones de cliente y veterinario, y el cuerpo que se envia.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/auth.service", () => ({ registrar: vi.fn() }));
vi.mock("../components/Carrusel", () => ({ default: () => null }));

import { registrar } from "../services/auth.service";
import Register from "./Register";

function pantalla() {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

const enviar = () => userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

async function llenarCliente({ correo = "ana@correo.co", clave = "Clave12345", acepta = true } = {}) {
  await userEvent.type(screen.getByLabelText(/Nombre/), "Ana");
  await userEvent.type(screen.getByLabelText(/Correo electrónico/), correo);
  await userEvent.type(screen.getByLabelText(/^Contraseña/), clave);
  if (acepta) await userEvent.click(screen.getByRole("checkbox", { name: /política de privacidad/ }));
}

beforeEach(() => vi.clearAllMocks());

describe("Register (cliente)", () => {
  test("formulario vacio: pide nombre, correo, contrasena y aceptar la politica", async () => {
    pantalla();
    await enviar();
    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("El correo es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La contraseña es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText(/aceptar la política de privacidad/)).toBeInTheDocument();
    expect(registrar).not.toHaveBeenCalled();
  });

  test("rechaza correo mal formado y contrasena sin numero", async () => {
    pantalla();
    await llenarCliente({ correo: "no-es-correo", clave: "solotexto" });
    await enviar();
    expect(screen.getByText("El correo no tiene un formato válido.")).toBeInTheDocument();
    expect(screen.getByText(/entre 8 y 72 caracteres/)).toBeInTheDocument();
    expect(registrar).not.toHaveBeenCalled();
  });

  test("datos validos: envia el rol CLIENT con el consentimiento y muestra el exito", async () => {
    registrar.mockResolvedValue({});
    pantalla();
    await llenarCliente();
    await enviar();
    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
    expect(registrar).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@correo.co",
      password: "Clave12345",
      role: "CLIENT",
      acceptPrivacy: true,
    });
    expect(await screen.findByText(/cuenta fue creada correctamente/)).toBeInTheDocument();
  });

  test("muestra el error del servidor (correo repetido)", async () => {
    registrar.mockRejectedValue({ response: { data: { message: "El correo ya está registrado." } } });
    pantalla();
    await llenarCliente();
    await enviar();
    expect(await screen.findByText(/ya está registrado/)).toBeInTheDocument();
  });
});

describe("Register (veterinario)", () => {
  async function elegirVeterinario() {
    await userEvent.click(screen.getByRole("radio", { name: /Veterinario/ }));
  }

  test("pide matricula, especialidad y direccion del consultorio", async () => {
    pantalla();
    await elegirVeterinario();
    await llenarCliente();
    await enviar();
    expect(screen.getByText("El número de matrícula es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("La especialidad es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText(/dirección del consultorio es obligatoria/)).toBeInTheDocument();
    expect(registrar).not.toHaveBeenCalled();
  });

  test("valida el formato de la matricula y el precio de los servicios", async () => {
    pantalla();
    await elegirVeterinario();
    await llenarCliente();
    await userEvent.type(screen.getByLabelText(/Matrícula|matrícula/), "AB#1");
    await userEvent.type(screen.getByLabelText(/Especialidad/), "Cirugía");
    await userEvent.type(screen.getByLabelText(/^Servicio 1/), "Consulta");
    await userEvent.type(screen.getByLabelText("Precio"), "0");
    await enviar();
    expect(screen.getAllByText(/solo puede contener letras, números y guiones/).length).toBeGreaterThan(0);
    expect(screen.getByText(/precio del servicio 1 debe ser un número mayor que cero/)).toBeInTheDocument();
  });
});
