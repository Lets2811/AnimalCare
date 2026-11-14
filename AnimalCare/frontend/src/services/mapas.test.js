import { describe, expect, test } from "vitest";

import { direccionCompleta, urlMapaIncrustado, urlRuta, urlVerEnMapa } from "./mapas";

describe("direccionCompleta", () => {
  test("agrega la ciudad de la clinica si la direccion no la menciona", () => {
    expect(direccionCompleta("Calle 5 # 10-20")).toBe("Calle 5 # 10-20, Popayán, Cauca, Colombia");
  });

  test("no la repite si ya viene (con o sin tilde, sin importar mayusculas)", () => {
    expect(direccionCompleta("Carrera 9 # 4-12, Popayán")).toBe("Carrera 9 # 4-12, Popayán");
    expect(direccionCompleta("cra 9, POPAYAN")).toBe("cra 9, POPAYAN");
  });

  test("una direccion vacia queda vacia", () => {
    expect(direccionCompleta("   ")).toBe("");
    expect(direccionCompleta(undefined)).toBe("");
  });
});

describe("enlaces de Google Maps", () => {
  test("el mapa incrustado codifica la direccion", () => {
    const url = new URL(urlMapaIncrustado("Calle 5 # 10-20"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps");
    expect(url.searchParams.get("q")).toBe("Calle 5 # 10-20, Popayán, Cauca, Colombia");
    expect(url.searchParams.get("output")).toBe("embed");
  });

  test("abrir en Google Maps usa la busqueda de Maps URLs", () => {
    const url = new URL(urlVerEnMapa("Calle 5 # 10-20"));
    expect(url.pathname).toBe("/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toContain("Calle 5 # 10-20");
  });

  test("la ruta no lleva origen: Google parte de la ubicacion actual de quien abre el enlace", () => {
    const url = new URL(urlRuta("Calle 3 # 2-45"));
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("destination")).toBe("Calle 3 # 2-45, Popayán, Cauca, Colombia");
    expect(url.searchParams.get("travelmode")).toBe("driving");
    expect(url.searchParams.has("origin")).toBe(false);
  });

  test("si se indica un origen, se incluye", () => {
    expect(new URL(urlRuta("Calle 3 # 2-45", "Carrera 9 # 4-12")).searchParams.get("origin")).toContain("Carrera 9 # 4-12");
  });
});
