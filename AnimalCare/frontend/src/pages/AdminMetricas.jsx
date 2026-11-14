// Panel de metricas del administrador: usuarios, citas, urgencias y calificaciones.
import { useEffect, useState } from "react";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import { usarTitulo } from "../hooks/usarTitulo";
import { obtenerMetricas } from "../services/admin.service";
import { obtenerMensajesDeError } from "../services/api";

function Dato({ valor, texto }) {
  return (
    <div className="metrica">
      <strong className="metrica-valor">{valor ?? "—"}</strong>
      <span className="metrica-texto">{texto}</span>
    </div>
  );
}

// Barras sencillas en CSS (sin librerias): la altura es proporcional al maximo.
function BarrasPorDia({ dias }) {
  const maximo = Math.max(1, ...dias.map((d) => d.count));
  return (
    <ul className="barras" aria-label="Citas por día, últimos 14 días">
      {dias.map((d) => (
        <li key={d.date} className="barra-columna">
          <span className="barra-numero">{d.count}</span>
          <span className="barra" style={{ height: `${Math.round((d.count / maximo) * 100)}%` }} aria-hidden="true" />
          <span className="barra-dia">{d.date.slice(8)}</span>
        </li>
      ))}
    </ul>
  );
}

function AdminMetricas() {
  usarTitulo("Métricas");
  const [metricas, setMetricas] = useState(null);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    obtenerMetricas()
      .then(setMetricas)
      .catch((error) => setErrores(obtenerMensajesDeError(error)));
  }, []);

  const m = metricas;
  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor contenedor-ancho">
        <div className="tarjeta">
          <h1>Métricas</h1>
          <p className="texto-suave">Resumen de la plataforma. Los periodos son de los últimos 30 días.</p>
        </div>
        <Alerta tipo="error" mensajes={errores} />
        {!m && errores.length === 0 && <p className="texto-suave">Cargando métricas...</p>}

        {m && (
          <>
            <section className="tarjeta" aria-labelledby="met-usuarios">
              <h2 id="met-usuarios">Usuarios</h2>
              <div className="metricas">
                <Dato valor={m.users.clients} texto="Dueños de mascota" />
                <Dato valor={m.users.veterinarians} texto="Veterinarios" />
                <Dato valor={m.users.veterinariansByStatus.PENDING} texto="Veterinarios por aprobar" />
                <Dato valor={m.users.newLast30Days} texto="Cuentas nuevas (30 días)" />
              </div>
            </section>

            <section className="tarjeta" aria-labelledby="met-citas">
              <h2 id="met-citas">Citas</h2>
              <div className="metricas">
                <Dato valor={m.appointments.last30Days.total} texto="Citas (30 días)" />
                <Dato valor={m.appointments.last30Days.completed} texto="Atendidas" />
                <Dato valor={m.appointments.last30Days.cancelled} texto="Canceladas" />
                <Dato valor={m.appointments.upcoming} texto="Próximas agendadas" />
              </div>
              <BarrasPorDia dias={m.appointments.perDay} />
            </section>

            <section className="tarjeta" aria-labelledby="met-urgencias">
              <h2 id="met-urgencias">Urgencias</h2>
              <div className="metricas">
                <Dato valor={m.emergencies.last30Days.total} texto="Solicitadas (30 días)" />
                <Dato valor={m.emergencies.last30Days.completed} texto="Atendidas" />
                <Dato valor={m.emergencies.last30Days.expired} texto="Sin respuesta" />
                <Dato
                  valor={m.emergencies.averageMinutesToAccept === null ? null : `${m.emergencies.averageMinutesToAccept} min`}
                  texto="Tiempo promedio en aceptarse"
                />
              </div>
            </section>

            <section className="tarjeta" aria-labelledby="met-calidad">
              <h2 id="met-calidad">Calidad del servicio</h2>
              <div className="metricas">
                <Dato valor={m.reviews.average === null ? null : `${m.reviews.average} / 5`} texto="Calificación promedio" />
                <Dato valor={m.reviews.count} texto="Calificaciones recibidas" />
              </div>
              <h3>Veterinarios con más citas atendidas (30 días)</h3>
              {m.topVeterinarians.length === 0 ? (
                <p className="texto-suave">Todavía no hay citas atendidas en este periodo.</p>
              ) : (
                <ol className="ranking">
                  {m.topVeterinarians.map((v) => (
                    <li key={v.name}>
                      <span>{v.name}</span>
                      <strong>{v.completed}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminMetricas;
