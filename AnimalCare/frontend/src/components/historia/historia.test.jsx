import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import EditorVacunas from "./EditorVacunas";
import EditorRecetas from "./EditorRecetas";
import GraficoPeso from "./GraficoPeso";
import CarnetVacunas from "./CarnetVacunas";
import AccesosHistoria from "./AccesosHistoria";
import { obtenerAccesos } from "../../services/medicalRecord.service";

vi.mock("../../services/medicalRecord.service", async (original) => ({ ...(await original()), obtenerAccesos: vi.fn() }));

// Lunes 16 de noviembre de 2026, 10:00 en Bogota.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-11-16T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("EditorVacunas", () => {
  test("agrega, edita y quita filas", async () => {
    const cambios = vi.fn();
    const { rerender } = render(<EditorVacunas valor={[]} onChange={cambios} />);
    expect(screen.getByText("Ninguna en esta consulta.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "+ Agregar vacuna" }));
    expect(cambios).toHaveBeenLastCalledWith([{ name: "", nextDueAt: "", lot: "" }]);

    rerender(<EditorVacunas valor={[{ name: "Rabia", nextDueAt: "2027-01-10", lot: "L1" }]} onChange={cambios} />);
    expect(screen.getByLabelText("Vacuna 1")).toHaveValue("Rabia");
    expect(screen.getByLabelText("Próxima dosis")).toHaveAttribute("min", "2026-11-16");
    await userEvent.click(screen.getByRole("button", { name: "Quitar vacuna 1" }));
    expect(cambios).toHaveBeenLastCalledWith([]);
  });
});

describe("EditorRecetas", () => {
  test("pide medicamento, dosis y frecuencia por fila", async () => {
    const cambios = vi.fn();
    render(<EditorRecetas valor={[{ medication: "", dose: "", frequency: "", duration: "", instructions: "" }]} onChange={cambios} />);
    await userEvent.type(screen.getByLabelText("Medicamento 1"), "A");
    expect(cambios).toHaveBeenLastCalledWith([{ medication: "A", dose: "", frequency: "", duration: "", instructions: "" }]);
    expect(screen.getByLabelText("Dosis")).toBeInTheDocument();
    expect(screen.getByLabelText("Frecuencia")).toBeInTheDocument();
  });
});

describe("GraficoPeso", () => {
  const entrada = (id, visitDate, weight) => ({ id, visitDate, weight, status: "ACTIVE" });

  test("con un solo peso no muestra grafico", () => {
    const { container } = render(<GraficoPeso entradas={[entrada(1, "2026-01-10", 4.5)]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("con varios pesos describe la evolucion para lectores de pantalla", () => {
    render(<GraficoPeso entradas={[entrada(2, "2026-06-01", 5.2), entrada(1, "2026-01-10", 4.5), { ...entrada(3, "2026-08-01", 9), status: "ANNULLED" }]} />);
    const grafico = screen.getByRole("img");
    expect(grafico.getAttribute("aria-label")).toContain("4.5 kg");
    expect(grafico.getAttribute("aria-label")).toContain("5.2 kg");
    expect(grafico.getAttribute("aria-label")).not.toContain("9 kg");
  });
});

describe("CarnetVacunas", () => {
  const entradas = [
    { id: 1, visitDate: "2026-06-01", status: "ACTIVE", vet: { name: "Dra. Rojas" }, vaccines: null, vaccinations: [{ id: 10, name: "Rabia", appliedAt: "2026-06-01", nextDueAt: "2026-11-30", lot: "L-7" }] },
    { id: 2, visitDate: "2025-03-01", status: "ACTIVE", vet: { name: "Dr. Mora" }, vaccines: "Triple felina", vaccinations: [] },
  ];

  test("muestra las proximas dosis (con 'Pronto' si faltan menos de 30 dias) y todo lo aplicado", () => {
    render(<CarnetVacunas entradas={entradas} />);
    const proximas = screen.getByText("Próximas dosis").closest("div");
    expect(within(proximas).getByText(/Rabia/)).toBeInTheDocument();
    expect(within(proximas).getByText(/Pronto/)).toBeInTheDocument();
    expect(screen.getByText(/lote L-7/)).toBeInTheDocument();
    expect(screen.getByText("Triple felina")).toBeInTheDocument(); // consulta antigua con texto libre
  });

  test("sin vacunas no pinta nada", () => {
    const { container } = render(<CarnetVacunas entradas={[{ id: 1, visitDate: "2026-01-01", status: "ACTIVE", vaccinations: [] }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AccesosHistoria", () => {
  test("carga quien consulto la historia solo al abrirla", async () => {
    obtenerAccesos.mockResolvedValue([
      { id: 1, action: "VIEW_HISTORY", label: "Consultó la historia clínica", actor: "Dra. Camila Rojas", role: "VETERINARIAN", at: "2026-11-15T14:00:00Z" },
    ]);
    render(<AccesosHistoria petId={7} />);
    expect(obtenerAccesos).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Ver quién ha consultado/ }));
    expect(await screen.findByText("Dra. Camila Rojas")).toBeInTheDocument();
    expect(screen.getByText(/Consultó la historia clínica/)).toBeInTheDocument();
    expect(obtenerAccesos).toHaveBeenCalledWith(7);
  });

  test("si nadie la consulto lo dice", async () => {
    obtenerAccesos.mockResolvedValue([]);
    render(<AccesosHistoria petId={7} />);
    await userEvent.click(screen.getByRole("button", { name: /Ver quién ha consultado/ }));
    expect(await screen.findByText("Nadie más ha consultado esta historia.")).toBeInTheDocument();
  });
});
