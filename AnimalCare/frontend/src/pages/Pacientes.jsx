// Directorio de pacientes del veterinario: las mascotas que atiende o atendio, con su dueño,
// visitas, ultima visita y proxima cita. Cada una lleva a su historia clinica.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import IconoEspecie from "../components/IconoEspecie";
import { usarTitulo } from "../hooks/usarTitulo";
import { listarPacientes } from "../services/vetPanel.service";
import { formatearFecha } from "../services/appointment.service";
import { obtenerMensajesDeError } from "../services/api";

function Pacientes() {
  usarTitulo("Pacientes");
  const [busqueda, setBusqueda] = useState("");
  const [pacientes, setPacientes] = useState(null);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    let cancelado = false;
    // Se espera un instante tras teclear para no consultar en cada letra.
    const temporizador = setTimeout(() => {
      listarPacientes(busqueda.trim())
        .then((lista) => {
          if (!cancelado) {
            setPacientes(lista);
            setErrores([]);
          }
        })
        .catch((error) => !cancelado && setErrores(obtenerMensajesDeError(error)));
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [busqueda]);

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">
        <div className="tarjeta">
          <h1>Mis pacientes</h1>
          <p className="texto-suave">
            Las mascotas que has atendido o tienes agendadas. Busca por el nombre de la mascota o de su dueño.
          </p>
          <div className="campo">
            <label htmlFor="busqueda-pacientes">Buscar</label>
            <input
              id="busqueda-pacientes"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Luna, Laura Gómez..."
            />
          </div>
        </div>

        <Alerta tipo="error" mensajes={errores} />
        {pacientes === null && errores.length === 0 && <p className="texto-suave">Cargando pacientes...</p>}

        {pacientes && pacientes.length === 0 && (
          <div className="tarjeta">
            <p className="texto-suave">
              {busqueda.trim() ? "Ningún paciente coincide con la búsqueda." : "Todavía no tienes pacientes: aparecerán cuando atiendas tu primera cita."}
            </p>
          </div>
        )}

        <div className="lista-mascotas">
          {pacientes?.map((p) => (
            <article key={p.id} className="tarjeta mascota mascota-ficha">
              <div className="mascota-cabeza">
                <div className="mascota-icono" aria-hidden="true">
                  <IconoEspecie especie={p.species} tamano={28} />
                </div>
                <div className="mascota-datos">
                  <h3>{p.name}</h3>
                  <p className="texto-suave">
                    {p.species}
                    {p.breed ? ` · ${p.breed}` : ""} · Dueño: {p.owner}
                  </p>
                </div>
              </div>
              <ul className="mascota-chips" aria-label={`Datos de ${p.name}`}>
                <li>{p.visits} {p.visits === 1 ? "visita" : "visitas"}</li>
                <li>{p.lastVisit ? `Última: ${formatearFecha(p.lastVisit)}` : "Sin visitas atendidas"}</li>
                {p.nextAppointment && <li>Próxima: {p.nextAppointment}</li>}
              </ul>
              {p.allergies && (
                <p className="alerta-alergias" role="note">
                  <strong>Alergias:</strong> {p.allergies}
                </p>
              )}
              <div className="mascota-acciones">
                <Link to={`/pacientes/${p.id}`} className="boton boton-primario boton-auto">
                  Historia clínica
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Pacientes;
