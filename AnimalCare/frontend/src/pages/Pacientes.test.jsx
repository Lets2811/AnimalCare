import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Pacientes from "./Pacientes";
import RecordatoriosClinicos from "../components/RecordatoriosClinicos";
import { listarPacientes } from "../services/vetPanel.service";
import { obtenerRecordatorios } from "../services/pet.service";

vi.mock("../services/vetPanel.service", async (original) => ({ ...(await original()), listarPacientes: vi.fn() }));
vi.mock("../services/pet.service", async (original) => ({ ...(await original()), obtenerRecordatorios: vi.fn() }));
vi.mock("../components/Cabecera", () => ({ default: () => <header>Cabecera</header> }));

const LUNA = {
  id: 5, name: "Luna", species: "Perro", breed: "Labrador", allergies: "Penicilina", owner: "Laura Gómez",
  visits: 3, lastVisit: "2026-10-01", nextAppointment: "lunes 23 de noviembre a las 9:00 a. m.",
};

beforeEach(() => vi.clearAllMocks());

const pintar = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Pacientes", () => {
  test("lista los pacientes con dueño, visitas, alergias y enlace a la historia", async () => {
    listarPacientes.mockResolvedValue([LUNA]);
    pintar(<Pacientes />);
    expect(await screen.findByText("Luna")).toBeInTheDocument();
    expect(screen.getByText(/Dueño: Laura Gómez/)).toBeInTheDocument();
    expect(screen.getByText("3 visitas")).toBeInTheDocument();
    expect(screen.getByText(/Penicilina/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Historia clínica" })).toHaveAttribute("href", "/pacientes/5");
  });

  test("busca por nombre (con una pequeña espera) y avisa si nada coincide", async () => {
    listarPacientes.mockResolvedValue([LUNA]);
    pintar(<Pacientes />);
    await screen.findByText("Luna");

    listarPacientes.mockResolvedValue([]);
    await userEvent.type(screen.getByLabelText("Buscar"), "zzz");
    expect(await screen.findByText("Ningún paciente coincide con la búsqueda.")).toBeInTheDocument();
    expect(listarPacientes).toHaveBeenLastCalledWith("zzz");
  });

  test("sin pacientes explica cuando apareceran", async () => {
    listarPacientes.mockResolvedValue([]);
    pintar(<Pacientes />);
    expect(await screen.findByText(/aparecerán cuando atiendas tu primera cita/)).toBeInTheDocument();
  });
});

describe("RecordatoriosClinicos", () => {
  test("muestra vacunas y controles, marcando los atrasados", async () => {
    obtenerRecordatorios.mockResolvedValue({
      vaccines: [{ petId: 5, petName: "Luna", name: "Rabia", dueDate: "2026-12-01", overdue: false }],
      followUps: [{ petId: 5, petName: "Luna", date: "2026-11-01", vet: "Dra. Rojas", overdue: true }],
    });
    pintar(<RecordatoriosClinicos />);
    expect(await screen.findByText(/Rabia/)).toBeInTheDocument();
    expect(screen.getByText(/control con Dra. Rojas/)).toBeInTheDocument();
    expect(screen.getByText(/Atrasado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agendar una cita" })).toHaveAttribute("href", "/veterinarios");
  });

  test("sin pendientes no pinta nada", async () => {
    obtenerRecordatorios.mockResolvedValue({ vaccines: [], followUps: [] });
    const { container } = pintar(<RecordatoriosClinicos />);
    await vi.waitFor(() => expect(obtenerRecordatorios).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
