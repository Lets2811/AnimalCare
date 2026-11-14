// Vista semanal de la agenda del veterinario: siete columnas (lunes a domingo) con las citas de cada dia.
// Al elegir una cita o un dia se vuelve a la vista diaria, donde estan las acciones.
import { useEffect, useMemo, useState } from "react";

import Icono from "./Icono";
import { listarMisCitas, ESTADOS_CITA } from "../services/appointment.service";
import { hoyLocal, sumarDias } from "../services/zona";
import { obtenerMensajesDeError } from "../services/api";

const NOMBRES_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Lunes de la semana a la que pertenece una fecha "AAAA-MM-DD".
export function lunesDeLaSemana(fecha) {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

export function diasDeLaSemana(fecha) {
  const lunes = lunesDeLaSemana(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

function etiquetaRango(dias) {
  const formato = (f) =>
    new Date(`${f}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${formato(dias[0])} – ${formato(dias[6])}`;
}

function AgendaSemanal({ inicial, onElegirDia }) {
  const [referencia, setReferencia] = useState(inicial || hoyLocal());
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    let cancelado = false;
    listarMisCitas({})
      .then((lista) => !cancelado && setCitas(lista))
      .catch((error) => !cancelado && setErrores(obtenerMensajesDeError(error)))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, []);

  const dias = useMemo(() => diasDeLaSemana(referencia), [referencia]);
  const hoy = hoyLocal();
  const porDia = useMemo(() => {
    const mapa = Object.fromEntries(dias.map((d) => [d, []]));
    for (const c of citas) {
      if (c.status !== "CANCELLED" && mapa[c.date]) mapa[c.date].push(c);
    }
    for (const lista of Object.values(mapa)) lista.sort((a, b) => a.time.localeCompare(b.time));
    return mapa;
  }, [citas, dias]);
  const total = dias.reduce((n, d) => n + porDia[d].length, 0);

  return (
    <section className="tarjeta" aria-label="Agenda de la semana">
      <div className="navegador-dia">
        <button
          type="button"
          className="boton boton-secundario boton-auto boton-cuadrado"
          aria-label="Semana anterior"
          onClick={() => setReferencia(sumarDias(referencia, -7))}
        >
          <Icono nombre="izquierda" tamano={18} grosor={2.2} />
        </button>
        <strong className="semana-rango">{etiquetaRango(dias)}</strong>
        <button
          type="button"
          className="boton boton-secundario boton-auto boton-cuadrado"
          aria-label="Semana siguiente"
          onClick={() => setReferencia(sumarDias(referencia, 7))}
        >
          <Icono nombre="flecha" tamano={18} grosor={2.2} />
        </button>
        <button type="button" className="boton boton-secundario boton-auto" onClick={() => setReferencia(hoy)}>
          Esta semana
        </button>
      </div>
      <p className="texto-suave" role="status">
        {cargando ? "Cargando..." : `${total} cita(s) esta semana (sin contar las canceladas).`}
      </p>
      {errores.length > 0 && <p className="error-campo">{errores.join(" ")}</p>}

      <div className="semana">
        {dias.map((fecha, i) => (
          <div key={fecha} className={`semana-dia ${fecha === hoy ? "semana-hoy" : ""}`}>
            <button type="button" className="semana-cabecera" onClick={() => onElegirDia(fecha)}>
              <span>{NOMBRES_DIA[i]}</span>
              <strong>{fecha.slice(8)}</strong>
            </button>
            <ul className="semana-citas">
              {porDia[fecha].length === 0 && <li className="semana-vacio">—</li>}
              {porDia[fecha].map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`semana-cita semana-${c.status.toLowerCase()}`}
                    onClick={() => onElegirDia(fecha)}
                    title={`${c.time} · ${c.client?.name} · ${ESTADOS_CITA[c.status]}`}
                  >
                    <strong>{c.time}</strong> {c.client?.name}
                    <span className="semana-estado">{ESTADOS_CITA[c.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AgendaSemanal;
