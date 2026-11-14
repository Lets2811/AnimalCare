// Mascotas del dueño: registrar, editar y quitar de la lista.
// Al agendar una cita se elige cuál de ellas se atiende.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Selector from "../components/Selector";
import { usarTitulo } from "../hooks/usarTitulo";
import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import Icono from "../components/Icono";
import IconoEspecie from "../components/IconoEspecie";
import {
  listarMascotas,
  registrarMascota,
  actualizarMascota,
  desactivarMascota,
  ESPECIES,
  calcularEdad,
} from "../services/pet.service";
import { hoyLocal } from "../services/appointment.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

const VACIA = {
  name: "",
  species: "Perro",
  sex: "Macho",
  birthDate: "",
  weight: "",
  breed: "",
  color: "",
  microchip: "",
  sterilized: "",
  allergies: "",
};

// De la mascota guardada al formulario (los nulos pasan a texto vacio).
function aFormulario(m) {
  return {
    ...m,
    weight: m.weight === null ? "" : String(m.weight),
    breed: m.breed ?? "",
    color: m.color ?? "",
    microchip: m.microchip ?? "",
    sterilized: m.sterilized === null || m.sterilized === undefined ? "" : String(m.sterilized),
    allergies: m.allergies ?? "",
  };
}

function FormularioMascota({ inicial, textoBoton, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  function cambiar(e) {
    const { name, value } = e.target;
    const limpio = name === "weight" ? value.replace(/[^0-9.]/g, "") : name === "microchip" ? value.replace(/\D/g, "") : value;
    setDatos((a) => ({ ...a, [name]: limpio }));
  }

  async function enviar(e) {
    e.preventDefault();
    const mensajes = [];
    if (datos.name.trim() === "") mensajes.push("El nombre de la mascota es obligatorio.");
    if (!datos.birthDate) mensajes.push("La fecha de nacimiento es obligatoria (puede ser aproximada).");
    if (datos.microchip !== "" && !/^\d{9,15}$/.test(datos.microchip)) mensajes.push("El microchip debe tener entre 9 y 15 dígitos.");
    if (mensajes.length > 0) {
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setGuardando(true);
    try {
      await onGuardar({
        ...datos,
        name: datos.name.trim(),
        weight: datos.weight || null,
        sterilized: datos.sterilized === "" ? null : datos.sterilized === "true",
      });
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  const id = (campo) => `${campo}-${textoBoton.replace(/\s/g, "")}`;

  return (
    <form onSubmit={enviar} noValidate>
      <Alerta tipo="error" mensajes={errores} />
      <div className="fila">
        <div className="campo">
          <label htmlFor={id("nombre")}>
            Nombre <span className="obligatorio">*</span>
          </label>
          <input id={id("nombre")} name="name" maxLength={40} value={datos.name} onChange={cambiar} placeholder="Luna" autoFocus />
        </div>
        <div className="campo">
          <label htmlFor={id("especie")}>
            Especie <span className="obligatorio">*</span>
          </label>
          <Selector id={id("especie")} name="species" value={datos.species} onChange={cambiar}>
            {ESPECIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Selector>
        </div>
      </div>
      <div className="fila fila-tres">
        <div className="campo">
          <label htmlFor={id("sexo")}>
            Sexo <span className="obligatorio">*</span>
          </label>
          <Selector id={id("sexo")} name="sex" value={datos.sex} onChange={cambiar}>
            <option value="Macho">Macho</option>
            <option value="Hembra">Hembra</option>
          </Selector>
        </div>
        <div className="campo">
          <label htmlFor={id("nacimiento")}>
            Nacimiento <span className="obligatorio">*</span>
          </label>
          <input id={id("nacimiento")} type="date" name="birthDate" max={hoyLocal()} value={datos.birthDate} onChange={cambiar} />
        </div>
        <div className="campo">
          <label htmlFor={id("peso")}>Peso (kg)</label>
          <input id={id("peso")} name="weight" inputMode="decimal" value={datos.weight} onChange={cambiar} placeholder="4.5" />
        </div>
      </div>

      <fieldset className="ficha-clinica">
        <legend>Ficha clínica (opcional, la ve el veterinario)</legend>
        <div className="fila">
          <div className="campo">
            <label htmlFor={id("raza")}>Raza</label>
            <input id={id("raza")} name="breed" maxLength={40} value={datos.breed} onChange={cambiar} placeholder="Criollo" />
          </div>
          <div className="campo">
            <label htmlFor={id("color")}>Color</label>
            <input id={id("color")} name="color" maxLength={40} value={datos.color} onChange={cambiar} placeholder="Blanco con manchas" />
          </div>
        </div>
        <div className="fila">
          <div className="campo">
            <label htmlFor={id("microchip")}>Microchip</label>
            <input id={id("microchip")} name="microchip" inputMode="numeric" maxLength={15} value={datos.microchip} onChange={cambiar} placeholder="9 a 15 dígitos" />
          </div>
          <div className="campo">
            <label htmlFor={id("esterilizado")}>Esterilizado</label>
            <Selector id={id("esterilizado")} name="sterilized" value={datos.sterilized} onChange={cambiar}>
              <option value="">Sin indicar</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </Selector>
          </div>
        </div>
        <div className="campo">
          <label htmlFor={id("alergias")}>Alergias o condiciones</label>
          <textarea id={id("alergias")} name="allergies" rows={2} maxLength={500} value={datos.allergies} onChange={cambiar} placeholder="Penicilina, pollo..." />
        </div>
      </fieldset>

      <div className="acciones-linea">
        <button type="submit" className="boton boton-primario boton-auto" disabled={guardando}>
          {guardando ? "Guardando..." : textoBoton}
        </button>
        {onCancelar && (
          <button type="button" className="boton boton-secundario boton-auto" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function MisMascotas() {
  usarTitulo("Mis mascotas");
  const [mascotas, setMascotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);
  const [editando, setEditando] = useState(null);
  const [quitando, setQuitando] = useState(null);
  // Desde el panel, "Agregar mascota" llega con ?nueva=1 y abre el formulario directamente.
  const [parametros] = useSearchParams();
  const [mostrarAlta, setMostrarAlta] = useState(parametros.get("nueva") === "1");

  async function cargar() {
    const datos = await listarMascotas();
    setMascotas(datos.pets);
    if (datos.pets.length === 0) setMostrarAlta(true);
  }

  useEffect(() => {
    setCargando(true);
    cargar()
      .catch((error) => {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      })
      .finally(() => setCargando(false));
  }, [intento]);

  async function alta(datos) {
    const r = await registrarMascota(datos);
    await cargar();
    setExito([r.message]);
    setMostrarAlta(false);
  }

  async function edicion(id, datos) {
    const r = await actualizarMascota(id, datos);
    await cargar();
    setEditando(null);
    setExito([r.message]);
  }

  async function quitar(id) {
    setErrores([]);
    try {
      const r = await desactivarMascota(id);
      await cargar();
      setExito([r.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setQuitando(null);
    }
  }

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">
        <div className="tarjeta">
          <div className="encabezado-seccion">
            <h1>Mis mascotas</h1>
            <button
              type="button"
              className={`boton boton-primario boton-auto ${mostrarAlta ? "boton-seleccionado" : ""}`}
              aria-pressed={mostrarAlta}
              onClick={() => setMostrarAlta((abierto) => (abierto && mascotas.length > 0 ? false : true))}
            >
              {mostrarAlta ? (
                <>
                  <Icono nombre="check" tamano={18} grosor={2.4} />
                  Agregando mascota
                </>
              ) : (
                <>
                  <Icono nombre="mas" tamano={18} grosor={2.4} />
                  Agregar mascota
                </>
              )}
            </button>
          </div>
          <p className="texto-suave">
            Registra a tus mascotas para elegir a cuál llevas al agendar. El veterinario verá su especie,
            edad y peso antes de la cita.
          </p>
        </div>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {mostrarAlta && (
          <div className="tarjeta">
            <h3>Nueva mascota</h3>
            <FormularioMascota
              inicial={VACIA}
              textoBoton="Registrar mascota"
              onGuardar={alta}
              onCancelar={mascotas.length > 0 ? () => setMostrarAlta(false) : undefined}
            />
          </div>
        )}

        {cargando && <p className="texto-suave">Cargando mascotas...</p>}

        <div className="lista-mascotas">
          {mascotas.map((m) => (
            <article key={m.id} className="tarjeta mascota mascota-ficha">
              {editando === m.id ? (
                <FormularioMascota
                  inicial={aFormulario(m)}
                  textoBoton="Guardar cambios"
                  onGuardar={(datos) => edicion(m.id, datos)}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <>
                  <div className="mascota-cabeza">
                    <div className="mascota-icono" aria-hidden="true">
                      <IconoEspecie especie={m.species} tamano={28} />
                    </div>
                    <div className="mascota-datos">
                      <h3>{m.name}</h3>
                      <p className="texto-suave">{m.species}</p>
                    </div>
                  </div>

                  <ul className="mascota-chips" aria-label={`Datos de ${m.name}`}>
                    <li>{m.sex}</li>
                    <li>{calcularEdad(m.birthDate)}</li>
                    {m.weight !== null && <li>{m.weight} kg</li>}
                    {m.breed && <li>{m.breed}</li>}
                    {m.color && <li>{m.color}</li>}
                    {m.sterilized !== null && m.sterilized !== undefined && <li>{m.sterilized ? "Esterilizado" : "Sin esterilizar"}</li>}
                    {m.microchip && <li>Microchip {m.microchip}</li>}
                  </ul>
                  {m.allergies && (
                    <p className="alerta-alergias" role="note">
                      <strong>Alergias:</strong> {m.allergies}
                    </p>
                  )}

                  {quitando === m.id ? (
                    <div className="mascota-confirmar" role="alertdialog" aria-label={`Quitar a ${m.name}`}>
                      <span>¿Quitar a {m.name}?</span>
                      <div className="acciones-linea">
                        <button type="button" className="boton boton-peligro boton-auto" onClick={() => quitar(m.id)}>
                          Sí, quitar
                        </button>
                        <button type="button" className="boton boton-secundario boton-auto" onClick={() => setQuitando(null)}>
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mascota-acciones">
                      <Link to={`/mascotas/${m.id}/historia`} className="boton boton-primario boton-auto">
                        <Icono nombre="documento" tamano={18} />
                        Historia clínica
                      </Link>
                      <button
                        type="button"
                        className="boton boton-secundario boton-auto boton-cuadrado"
                        aria-label={`Editar a ${m.name}`}
                        title="Editar"
                        onClick={() => setEditando(m.id)}
                      >
                        <Icono nombre="editar" tamano={18} />
                      </button>
                      <button
                        type="button"
                        className="boton boton-peligro boton-auto boton-cuadrado"
                        aria-label={`Quitar a ${m.name}`}
                        title="Quitar"
                        onClick={() => setQuitando(m.id)}
                      >
                        <Icono nombre="papelera" tamano={18} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

export default MisMascotas;
