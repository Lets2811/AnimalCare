// Mapa de Google de una direccion, con enlace para abrirlo y, opcionalmente, para trazar la ruta
// desde la ubicacion actual de quien lo abre (el veterinario que va a un domicilio).
import { urlMapaIncrustado, urlRuta, urlVerEnMapa } from "../services/mapas";

// modo "ver": solo ubicacion. modo "ruta": agrega el boton "Cómo llegar desde mi ubicación".
function MapaUbicacion({ direccion, modo = "ver", mostrarMapa = true }) {
  if (!direccion || direccion.trim() === "") return null;

  return (
    <div className="mapa-bloque">
      {mostrarMapa && (
        <iframe
          className="mapa"
          title={`Mapa: ${direccion}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={urlMapaIncrustado(direccion)}
        />
      )}
      <div className="acciones-linea">
        {modo === "ruta" && (
          <a className="boton boton-primario boton-auto" href={urlRuta(direccion)} target="_blank" rel="noreferrer">
            Cómo llegar desde mi ubicación
          </a>
        )}
        <a className="enlace-seccion" href={urlVerEnMapa(direccion)} target="_blank" rel="noreferrer">
          Abrir en Google Maps
        </a>
      </div>
    </div>
  );
}

export default MapaUbicacion;
