// Transparencia (Ley 1581): el dueño ve quien consulto, descargo o cambio la historia de su mascota.
import { useState } from "react";

import { obtenerAccesos } from "../../services/medicalRecord.service";
import { obtenerMensajesDeError } from "../../services/api";

const ROLES = { VETERINARIAN: "Veterinario", ADMIN: "Administrador", CLIENT: "Dueño" };

function formatoFechaHora(fecha) {
  return new Date(fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
}

function AccesosHistoria({ petId }) {
  const [abierto, setAbierto] = useState(false);
  const [accesos, setAccesos] = useState(null);
  const [error, setError] = useState("");

  async function alternar() {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (nuevo && accesos === null) {
      try {
        setAccesos(await obtenerAccesos(petId));
      } catch (e) {
        setError(obtenerMensajesDeError(e).join(" "));
      }
    }
  }

  return (
    <div className="tarjeta no-imprimir">
      <button type="button" className="enlace-accion" aria-expanded={abierto} onClick={alternar}>
        {abierto ? "Ocultar" : "Ver"} quién ha consultado esta historia
      </button>
      {abierto && (
        <div>
          <p className="texto-suave">
            Aquí aparecen los profesionales que han abierto, descargado o modificado esta historia clínica.
          </p>
          {error && <p className="error-campo">{error}</p>}
          {accesos !== null && accesos.length === 0 && <p className="texto-suave">Nadie más ha consultado esta historia.</p>}
          {accesos !== null && accesos.length > 0 && (
            <ul className="accesos">
              {accesos.map((a) => (
                <li key={a.id}>
                  <strong>{a.actor || "Usuario eliminado"}</strong>
                  {a.role && <span className="texto-suave"> ({ROLES[a.role] || a.role})</span>} · {a.label}
                  <span className="texto-suave"> · {formatoFechaHora(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default AccesosHistoria;
