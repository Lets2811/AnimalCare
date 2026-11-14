import { describe, expect, test } from "vitest";

import { carnetDeVacunas } from "./medicalRecord.service";

const entrada = (id, visitDate, vaccines, status = "ACTIVE") => ({ id, visitDate, vaccines, status, vet: { name: "Dra. Rojas" } });

describe("carnetDeVacunas", () => {
  test("lista solo las consultas con vacunas, de la mas reciente a la mas antigua", () => {
    const carnet = carnetDeVacunas([
      entrada(1, "2026-01-10", "Rabia"),
      entrada(2, "2026-03-05", null),
      entrada(3, "2026-06-20", "Triple canina (refuerzo)"),
      entrada(4, "2026-06-20", "   "),
    ]);
    expect(carnet.map((v) => v.id)).toEqual([3, 1]);
    expect(carnet[0]).toMatchObject({ fecha: "2026-06-20", vacunas: "Triple canina (refuerzo)", veterinario: "Dra. Rojas" });
  });

  test("ignora las entradas eliminadas (anuladas)", () => {
    expect(carnetDeVacunas([entrada(1, "2026-01-10", "Rabia", "ANNULLED")])).toEqual([]);
  });

  test("sin entradas, el carnet esta vacio", () => {
    expect(carnetDeVacunas([])).toEqual([]);
  });
});
