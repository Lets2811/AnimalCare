import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AgendaSemanal, { diasDeLaSemana, lunesDeLaSemana } from "./AgendaSemanal";
import { listarMisCitas } from "../services/appointment.service";

vi.mock("../services/appointment.service", async (original) => ({ ...(await original()), listarMisCitas: vi.fn() }));

// Miercoles 18 de noviembre de 2026, 10:00 en Bogota.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-11-18T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const cita = (id, date, time, status = "CONFIRMED", nombre = "Laura Gómez") => ({ id, date, time, status, client: { name: nombre } });

describe("semana", () => {
  test("la semana va de lunes a domingo, tambien cuando la fecha cae en domingo", () => {
    expect(lunesDeLaSemana("2026-11-18")).toBe("2026-11-16");
    expect(lunesDeLaSemana("2026-11-22")).toBe("2026-11-16"); // domingo
    expect(lunesDeLaSemana("2026-11-16")).toBe("2026-11-16");
    expect(diasDeLaSemana("2026-11-18")).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
  });
});

describe("AgendaSemanal", () => {
  test("agrupa las citas por dia, ordenadas por hora, sin las canceladas", async () => {
    listarMisCitas.mockResolvedValue([
      cita(1, "2026-11-18", "14:00", "CONFIRMED", "Pedro Ruiz"),
      cita(2, "2026-11-18", "09:00", "PENDING", "Ana Mora"),
      cita(3, "2026-11-18", "11:00", "CANCELLED", "Cancelada Cita"),
      cita(4, "2026-11-25", "09:00", "CONFIRMED", "Otra Semana"),
    ]);
    render(<AgendaSemanal onElegirDia={() => {}} />);

    expect(await screen.findByText("2 cita(s) esta semana (sin contar las canceladas).")).toBeInTheDocument();
    expect(screen.queryByText(/Cancelada Cita/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Otra Semana/)).not.toBeInTheDocument();
    const miercoles = screen.getByRole("button", { name: /Mié/ }).closest(".semana-dia");
    const horas = within(miercoles).getAllByRole("button").slice(1).map((b) => b.textContent);
    expect(horas[0]).toContain("Ana Mora");
    expect(horas[1]).toContain("Pedro Ruiz");
  });

  test("cambia de semana y vuelve a la actual", async () => {
    listarMisCitas.mockResolvedValue([cita(4, "2026-11-25", "09:00", "CONFIRMED", "Otra Semana")]);
    render(<AgendaSemanal onElegirDia={() => {}} />);
    await screen.findByText("0 cita(s) esta semana (sin contar las canceladas).");

    await userEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(screen.getByText(/Otra Semana/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Esta semana" }));
    expect(screen.queryByText(/Otra Semana/)).not.toBeInTheDocument();
  });

  test("elegir un dia o una cita lleva a la vista diaria de esa fecha", async () => {
    listarMisCitas.mockResolvedValue([cita(1, "2026-11-19", "10:00", "CONFIRMED", "Pedro Ruiz")]);
    const elegir = vi.fn();
    render(<AgendaSemanal onElegirDia={elegir} />);

    await userEvent.click(await screen.findByRole("button", { name: /Pedro Ruiz/ }));
    expect(elegir).toHaveBeenLastCalledWith("2026-11-19");
    await userEvent.click(screen.getByRole("button", { name: /Lun/ }));
    expect(elegir).toHaveBeenLastCalledWith("2026-11-16");
  });
});
