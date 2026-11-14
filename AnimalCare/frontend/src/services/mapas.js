// Enlaces a Google Maps sin clave de API (no hay que registrar nada ni pagar):
//   - mapa incrustado de una direccion (iframe de maps?q=...&output=embed)
//   - "abrir en Google Maps" (Maps URLs: https://developers.google.com/maps/documentation/urls)
//   - ruta hacia un destino: sin origen, Google Maps parte de la ubicacion actual del dispositivo.
//
// Las direcciones se escriben como las da la gente ("Calle 5 # 10-20, Barrio Centro"): para que Google
// no las confunda con otra ciudad, se agrega la ciudad de la clinica si la direccion no la menciona.
// Se cambia con VITE_MAPS_CIUDAD en el .env del frontend.
const CIUDAD = import.meta.env?.VITE_MAPS_CIUDAD || "Popayán, Cauca, Colombia";
const BASE = "https://www.google.com/maps";

export function direccionCompleta(direccion, ciudad = CIUDAD) {
  const limpia = String(direccion ?? "").trim();
  if (limpia === "") return "";
  const principal = ciudad.split(",")[0].trim().toLowerCase();
  const normaliza = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return normaliza(limpia).includes(normaliza(principal)) ? limpia : `${limpia}, ${ciudad}`;
}

export function urlMapaIncrustado(direccion) {
  return `${BASE}?q=${encodeURIComponent(direccionCompleta(direccion))}&output=embed`;
}

export function urlVerEnMapa(direccion) {
  return `${BASE}/search/?api=1&query=${encodeURIComponent(direccionCompleta(direccion))}`;
}

// Ruta en coche hacia la direccion. Sin `origen`, parte de donde esta quien abre el enlace.
export function urlRuta(destino, origen) {
  const params = new URLSearchParams({ api: "1", destination: direccionCompleta(destino), travelmode: "driving" });
  if (origen) params.set("origin", direccionCompleta(origen));
  return `${BASE}/dir/?${params.toString()}`;
}
