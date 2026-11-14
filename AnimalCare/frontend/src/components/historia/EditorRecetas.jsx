// Lista editable de medicamentos recetados en la consulta (se imprime como receta).
export const RECETA_VACIA = { medication: "", dose: "", frequency: "", duration: "", instructions: "" };

function EditorRecetas({ valor, onChange }) {
  function cambiar(indice, campo, texto) {
    onChange(valor.map((r, i) => (i === indice ? { ...r, [campo]: texto } : r)));
  }

  return (
    <fieldset className="editor-lista">
      <legend>Receta (medicamentos)</legend>
      {valor.length === 0 && <p className="texto-suave">Sin medicamentos recetados.</p>}
      {valor.map((r, i) => (
        <div key={i} className="editor-fila editor-fila-receta">
          <div className="campo">
            <label htmlFor={`receta-medicamento-${i}`}>Medicamento {i + 1}</label>
            <input id={`receta-medicamento-${i}`} maxLength={100} value={r.medication} onChange={(e) => cambiar(i, "medication", e.target.value)} placeholder="Amoxicilina" />
          </div>
          <div className="campo">
            <label htmlFor={`receta-dosis-${i}`}>Dosis</label>
            <input id={`receta-dosis-${i}`} maxLength={60} value={r.dose} onChange={(e) => cambiar(i, "dose", e.target.value)} placeholder="250 mg" />
          </div>
          <div className="campo">
            <label htmlFor={`receta-frecuencia-${i}`}>Frecuencia</label>
            <input id={`receta-frecuencia-${i}`} maxLength={60} value={r.frequency} onChange={(e) => cambiar(i, "frequency", e.target.value)} placeholder="cada 12 horas" />
          </div>
          <div className="campo">
            <label htmlFor={`receta-duracion-${i}`}>Duración</label>
            <input id={`receta-duracion-${i}`} maxLength={60} value={r.duration} onChange={(e) => cambiar(i, "duration", e.target.value)} placeholder="7 días" />
          </div>
          <div className="campo campo-ancho">
            <label htmlFor={`receta-indicaciones-${i}`}>Indicaciones</label>
            <input id={`receta-indicaciones-${i}`} maxLength={300} value={r.instructions} onChange={(e) => cambiar(i, "instructions", e.target.value)} placeholder="Con comida" />
          </div>
          <button type="button" className="boton boton-peligro boton-auto" onClick={() => onChange(valor.filter((_, j) => j !== i))}>
            Quitar medicamento {i + 1}
          </button>
        </div>
      ))}
      {valor.length < 15 && (
        <button type="button" className="boton boton-secundario boton-auto" onClick={() => onChange([...valor, { ...RECETA_VACIA }])}>
          + Agregar medicamento
        </button>
      )}
    </fieldset>
  );
}

export default EditorRecetas;
