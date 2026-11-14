import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import AdminMetricas from "./AdminMetricas";
import { obtenerMetricas } from "../services/admin.service";

vi.mock("../services/admin.service", async (original) => ({ ...(await original()), obtenerMetricas: vi.fn() }));
// La cabecera no es lo que se prueba aqui.
vi.mock("../components/Cabecera", () => ({ default: () => <header>Cabecera</header> }));

const METRICAS = {
  users: { clients: 12, veterinarians: 4, admins: 1, newLast30Days: 3, veterinariansByStatus: { ACTIVE: 3, PENDING: 1, SUSPENDED: 0, REJECTED: 0 } },
  appointments: {
    last30Days: { total: 20, completed: 14, cancelled: 4, pendingOrConfirmed: 2 },
    upcoming: 6,
    perDay: Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, count: i % 4 })),
  },
  emergencies: { last30Days: { total: 5, completed: 3, expired: 1, cancelled: 1, open: 0 }, averageMinutesToAccept: 2.5 },
  reviews: { count: 9, average: 4.6 },
  topVeterinarians: [{ name: "Dra. Camila Rojas", completed: 8, rating: 4.8 }],
};

beforeEach(() => vi.clearAllMocks());

describe("AdminMetricas", () => {
  test("muestra los totales, las citas por dia y el ranking", async () => {
    obtenerMetricas.mockResolvedValue(METRICAS);
    render(
      <MemoryRouter>
        <AdminMetricas />
      </MemoryRouter>
    );

    expect(await screen.findByText("Dueños de mascota")).toBeInTheDocument();
    expect(screen.getByText("Dueños de mascota").previousSibling).toHaveTextContent("12");
    expect(screen.getByText("4.6 / 5")).toBeInTheDocument();
    expect(screen.getByText("2.5 min")).toBeInTheDocument();
    expect(screen.getByText("Dra. Camila Rojas")).toBeInTheDocument();
    expect(screen.getByLabelText("Citas por día, últimos 14 días").children).toHaveLength(14);
  });

  test("sin datos de calificaciones ni urgencias muestra guiones, no NaN", async () => {
    obtenerMetricas.mockResolvedValue({
      ...METRICAS,
      reviews: { count: 0, average: null },
      emergencies: { ...METRICAS.emergencies, averageMinutesToAccept: null },
      topVeterinarians: [],
    });
    render(
      <MemoryRouter>
        <AdminMetricas />
      </MemoryRouter>
    );
    expect(await screen.findByText("Todavía no hay citas atendidas en este periodo.")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  test("si falla la carga lo avisa", async () => {
    obtenerMetricas.mockRejectedValue({ response: { data: { message: "No autorizado." } } });
    render(
      <MemoryRouter>
        <AdminMetricas />
      </MemoryRouter>
    );
    expect(await screen.findByText("No autorizado.")).toBeInTheDocument();
  });
});
