// Lista editable de vacunas aplicadas en la consulta: nombre, proxima dosis y lote.
import { hoyLocal } from "../../services/appointment.service";

export const VACUNA_VACIA = { name: "", nextDueAt: "", lot: "" };

function EditorVacunas({ valor, onChange }) {
  function cambiar(indice, campo, texto) {
    onChange(valor.map((v, i) => (i === indice ? { ...v, [campo]: texto } : v)));
  }

  return (
    <fieldset className="editor-lista">
      <legend>Vacunas aplicadas</legend>
      {valor.length === 0 && <p className="texto-suave">Ninguna en esta consulta.</p>}
      {valor.map((v, i) => (
        <div key={i} className="editor-fila">
          <div className="campo">
            <label htmlFor={`vacuna-nombre-${i}`}>Vacuna {i + 1}</label>
            <input id={`vacuna-nombre-${i}`} maxLength={80} value={v.name} onChange={(e) => cambiar(i, "name", e.target.value)} placeholder="Rabia" />
          </div>
          <div className="campo">
            <label htmlFor={`vacuna-proxima-${i}`}>Próxima dosis</label>
            <input id={`vacuna-proxima-${i}`} type="date" min={hoyLocal()} value={v.nextDueAt} onChange={(e) => cambiar(i, "nextDueAt", e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor={`vacuna-lote-${i}`}>Lote</label>
            <input id={`vacuna-lote-${i}`} maxLength={40} value={v.lot} onChange={(e) => cambiar(i, "lot", e.target.value)} />
          </div>
          <button type="button" className="boton boton-peligro boton-auto" onClick={() => onChange(valor.filter((_, j) => j !== i))}>
            Quitar vacuna {i + 1}
          </button>
        </div>
      ))}
      {valor.length < 10 && (
        <button type="button" className="boton boton-secundario boton-auto" onClick={() => onChange([...valor, { ...VACUNA_VACIA }])}>
          + Agregar vacuna
        </button>
      )}
      <p className="ayuda">Si indicas la próxima dosis, el dueño recibe un aviso una semana antes.</p>
    </fieldset>
  );
}

export default EditorVacunas;
