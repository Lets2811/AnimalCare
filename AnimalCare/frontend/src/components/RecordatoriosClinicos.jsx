// Tarjeta del panel del dueño: proximas vacunas y controles de seguimiento de sus mascotas.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { obtenerRecordatorios } from "../services/pet.service";
import { formatearFecha } from "../services/appointment.service";

function RecordatoriosClinicos() {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    obtenerRecordatorios()
      .then(setDatos)
      .catch(() => setDatos(null)); // un fallo aqui no debe estorbar al resto del panel
  }, []);

  if (!datos || (datos.vaccines.length === 0 && datos.followUps.length === 0)) return null;

  return (
    <section className="tarjeta tarjeta-lateral" aria-label="Recordatorios de salud">
      <h3>Vacunas y controles</h3>
      <ul className="resumen-recordatorios">
        {datos.vaccines.map((v) => (
          <li key={`v-${v.petId}-${v.name}`} className={v.overdue ? "recordatorio-atrasado" : undefined}>
            <strong>{v.petName}</strong>: {v.name} · {formatearFecha(v.dueDate)}
            {v.overdue && <span className="etiqueta etiqueta-cancelled"> Atrasada</span>}
          </li>
        ))}
        {datos.followUps.map((c) => (
          <li key={`c-${c.petId}-${c.date}`} className={c.overdue ? "recordatorio-atrasado" : undefined}>
            <strong>{c.petName}</strong>: control con {c.vet} · {formatearFecha(c.date)}
            {c.overdue && <span className="etiqueta etiqueta-cancelled"> Atrasado</span>}
          </li>
        ))}
      </ul>
      <Link to="/veterinarios" className="enlace-seccion">
        Agendar una cita
      </Link>
    </section>
  );
}

export default RecordatoriosClinicos;
