// Evolucion del peso de la mascota a partir de las consultas (SVG sencillo, sin librerias).
import { pesosDeLaHistoria } from "../../services/medicalRecord.service";
import { formatearFecha } from "../../services/appointment.service";

const ANCHO = 520;
const ALTO = 160;
const MARGEN = 28;

function GraficoPeso({ entradas }) {
  const puntos = pesosDeLaHistoria(entradas);
  if (puntos.length < 2) return null; // con un solo dato no hay evolucion que mostrar

  const pesos = puntos.map((p) => p.peso);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const rango = max - min || 1;
  const x = (i) => MARGEN + (i * (ANCHO - 2 * MARGEN)) / (puntos.length - 1);
  const y = (peso) => ALTO - MARGEN - ((peso - min) / rango) * (ALTO - 2 * MARGEN);
  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.peso).toFixed(1)}`).join(" ");
  const descripcion = puntos.map((p) => `${formatearFecha(p.fecha)}: ${p.peso} kg`).join("; ");

  return (
    <div className="tarjeta grafico-peso">
      <h3>Evolución del peso</h3>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`Evolución del peso. ${descripcion}`} className="grafico-peso-svg">
        <path d={linea} fill="none" stroke="var(--verde-600)" strokeWidth="2.5" strokeLinejoin="round" />
        {puntos.map((p, i) => (
          <g key={p.fecha + i}>
            <circle cx={x(i)} cy={y(p.peso)} r="4" fill="var(--verde-600)" />
            <text x={x(i)} y={y(p.peso) - 9} textAnchor="middle" fontSize="11" fill="currentColor">
              {p.peso}
            </text>
            <text x={x(i)} y={ALTO - 8} textAnchor="middle" fontSize="10" fill="currentColor">
              {p.fecha.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <p className="texto-suave">
        Del {formatearFecha(puntos[0].fecha)} al {formatearFecha(puntos[puntos.length - 1].fecha)} (kg).
      </p>
    </div>
  );
}

export default GraficoPeso;
