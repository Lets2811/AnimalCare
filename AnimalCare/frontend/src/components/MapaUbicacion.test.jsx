import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import MapaUbicacion from "./MapaUbicacion";
import CitaTarjeta from "./CitaTarjeta";

describe("MapaUbicacion", () => {
  test("muestra el mapa con titulo accesible y el enlace para abrirlo", () => {
    render(<MapaUbicacion direccion="Calle 5 # 10-20" />);
    expect(screen.getByTitle("Mapa: Calle 5 # 10-20")).toHaveAttribute("src", expect.stringContaining("output=embed"));
    expect(screen.getByRole("link", { name: "Abrir en Google Maps" })).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("link", { name: /Cómo llegar/ })).not.toBeInTheDocument();
  });

  test("en modo ruta ofrece llegar desde la ubicacion del veterinario", () => {
    render(<MapaUbicacion direccion="Calle 3 # 2-45" modo="ruta" />);
    const ruta = screen.getByRole("link", { name: "Cómo llegar desde mi ubicación" });
    expect(ruta.getAttribute("href")).toContain("/maps/dir/");
    expect(ruta.getAttribute("href")).not.toContain("origin=");
  });

  test("sin direccion no pinta nada", () => {
    const { container } = render(<MapaUbicacion direccion="  " />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("mapas en la tarjeta de cita", () => {
  const base = {
    id: 1, date: "2099-01-05", time: "09:00", status: "CONFIRMED", durationMinutes: 30, notes: null,
    client: { name: "Laura Gómez", email: "laura@test.com" },
    vet: { id: 7, name: "Dra. Camila Rojas", specialty: "General", address: "Carrera 9 # 4-12", phone: "3105551234" },
    service: null, pet: null, review: null, medicalRecordId: null,
  };
  const pintar = (cita, perspectiva) =>
    render(
      <MemoryRouter>
        <CitaTarjeta cita={cita} perspectiva={perspectiva} onActualizada={() => {}} />
      </MemoryRouter>
    );

  test("a domicilio, el veterinario traza la ruta hacia la direccion del cliente", () => {
    pintar({ ...base, mode: "HOME", address: "Calle 3 # 2-45" }, "veterinario");
    const href = screen.getByRole("link", { name: "Cómo llegar desde mi ubicación" }).getAttribute("href");
    expect(new URL(href).searchParams.get("destination")).toContain("Calle 3 # 2-45");
  });

  test("en consultorio, el dueño ve donde queda y el veterinario no recibe ruta", () => {
    pintar({ ...base, mode: "CLINIC", address: null }, "cliente");
    expect(screen.getByRole("link", { name: "Abrir en Google Maps" }).getAttribute("href")).toContain(
      encodeURIComponent("Carrera 9 # 4-12")
    );
    pintar({ ...base, id: 2, mode: "CLINIC", address: null }, "veterinario");
    expect(screen.queryByRole("link", { name: /Cómo llegar/ })).not.toBeInTheDocument();
  });

  test("una cita cancelada ya no muestra enlaces de mapa", () => {
    pintar({ ...base, status: "CANCELLED", mode: "HOME", address: "Calle 3 # 2-45" }, "veterinario");
    expect(screen.queryByRole("link", { name: /Google Maps|Cómo llegar/ })).not.toBeInTheDocument();
  });
});
