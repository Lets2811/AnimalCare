// Carnet de vacunas de la mascota: proximas dosis (con aviso si estan cerca) y todo lo aplicado.
import { carnetDeVacunas, proximasDosis } from "../../services/medicalRecord.service";
import { formatearFecha, hoyLocal } from "../../services/appointment.service";
import { sumarDias } from "../../services/zona";

function CarnetVacunas({ entradas }) {
  const carnet = carnetDeVacunas(entradas);
  if (carnet.length === 0) return null;

  const hoy = hoyLocal();
  const limite = sumarDias(hoy, 30);
  const pendientes = proximasDosis(carnet, hoy);

  return (
    <div className="tarjeta">
      <h3>Carnet de vacunas</h3>

      {pendientes.length > 0 && (
        <div className="vacunas-proximas" role="note">
          <strong>Próximas dosis</strong>
          <ul>
            {pendientes.map((v) => (
              <li key={v.id} className={v.proxima <= limite ? "vacuna-pronto" : undefined}>
                {v.vacunas}: {formatearFecha(v.proxima)}
                {v.proxima <= limite && <span className="etiqueta etiqueta-pending"> Pronto</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="vacunas">
        {carnet.map((v) => (
          <li key={v.id}>
            <strong>{formatearFecha(v.fecha)}</strong>
            <span>
              {v.vacunas}
              {v.lote ? ` (lote ${v.lote})` : ""}
            </span>
            {v.veterinario && <span className="texto-suave">{v.veterinario}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CarnetVacunas;
