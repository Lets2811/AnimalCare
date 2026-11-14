import { describe, expect, test } from "vitest";

import { carnetDeVacunas, proximasDosis, pesosDeLaHistoria } from "./medicalRecord.service";

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

describe("carnetDeVacunas con vacunas estructuradas", () => {
  const conVacunas = (id, visitDate, vaccinations, vaccines = null) => ({ id, visitDate, status: "ACTIVE", vaccines, vaccinations, vet: { name: "Dra. Rojas" } });

  test("usa las estructuradas (con proxima dosis y lote) y el texto libre solo si no hay estructuradas", () => {
    const carnet = carnetDeVacunas([
      conVacunas(1, "2026-01-10", [{ id: 5, name: "Rabia", appliedAt: "2026-01-10", nextDueAt: "2027-01-10", lot: "L1" }], "texto que se ignora"),
      conVacunas(2, "2025-05-01", [], "Triple canina"),
    ]);
    expect(carnet.map((v) => [v.vacunas, v.proxima, v.lote])).toEqual([
      ["Rabia", "2027-01-10", "L1"],
      ["Triple canina", null, null],
    ]);
  });
});

describe("proximasDosis", () => {
  const carnet = [
    { id: "v3", fecha: "2026-10-01", vacunas: "Rabia", proxima: "2027-10-01" },
    { id: "v2", fecha: "2026-05-01", vacunas: "Rabia", proxima: "2026-11-01" }, // dosis anterior ya superada
    { id: "v1", fecha: "2026-03-01", vacunas: "Triple", proxima: "2026-12-15" },
    { id: "v0", fecha: "2025-03-01", vacunas: "Parvovirus", proxima: "2026-02-01" }, // ya paso
  ];

  test("solo cuenta la ultima aplicacion de cada vacuna, desde hoy, la mas cercana primero", () => {
    expect(proximasDosis(carnet, "2026-11-16").map((v) => v.vacunas)).toEqual(["Triple", "Rabia"]);
  });
});

describe("pesosDeLaHistoria", () => {
  test("ordena de la consulta mas antigua a la mas reciente y omite eliminadas y sin peso", () => {
    const pesos = pesosDeLaHistoria([
      { id: 3, visitDate: "2026-09-01", weight: 6, status: "ACTIVE" },
      { id: 1, visitDate: "2026-01-01", weight: 4.5, status: "ACTIVE" },
      { id: 2, visitDate: "2026-05-01", weight: null, status: "ACTIVE" },
      { id: 4, visitDate: "2026-10-01", weight: 9, status: "ANNULLED" },
    ]);
    expect(pesos.map((p) => p.peso)).toEqual([4.5, 6]);
  });
});
