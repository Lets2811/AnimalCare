import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import AdminAuditoria from "./AdminAuditoria";
import { listarAuditoria } from "../services/admin.service";

vi.mock("../services/admin.service", async (original) => ({ ...(await original()), listarAuditoria: vi.fn() }));
vi.mock("../components/Cabecera", () => ({ default: () => <header>Cabecera</header> }));

const REGISTRO = { id: 1, action: "VIEW_HISTORY", label: "Consultó la historia clínica", actor: "Dra. Rojas", role: "VETERINARIAN", petId: 5, ip: "::1", at: "2026-11-15T14:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  listarAuditoria.mockResolvedValue({ total: 1, page: 1, totalPages: 1, logs: [REGISTRO] });
});

const pintar = () =>
  render(
    <MemoryRouter>
      <AdminAuditoria />
    </MemoryRouter>
  );

describe("AdminAuditoria", () => {
  test("lista quien hizo que sobre que mascota", async () => {
    pintar();
    expect(await screen.findByText("Consultó la historia clínica")).toBeInTheDocument();
    expect(screen.getByText(/Dra. Rojas/)).toBeInTheDocument();
    expect(screen.getByText("1 registro(s) · página 1 de 1")).toBeInTheDocument();
  });

  test("filtra por accion y por mascota y vuelve a la primera pagina", async () => {
    pintar();
    await screen.findByText("Consultó la historia clínica");
    await userEvent.selectOptions(screen.getByLabelText("Acción"), "EXPORT_DATA");
    expect(listarAuditoria).toHaveBeenLastCalledWith({ page: 1, action: "EXPORT_DATA", petId: "" });
    await userEvent.type(screen.getByLabelText("Número de mascota"), "12");
    expect(listarAuditoria).toHaveBeenLastCalledWith({ page: 1, action: "EXPORT_DATA", petId: "12" });
  });

  test("sin registros lo avisa", async () => {
    listarAuditoria.mockResolvedValue({ total: 0, page: 1, totalPages: 1, logs: [] });
    pintar();
    expect(await screen.findByText("No hay registros con ese filtro.")).toBeInTheDocument();
  });
});
