// Registro de auditoria del administrador: quien consulto, descargo o cambio datos sensibles
// (historias clinicas) y quien exporto datos personales. Paginado, con filtros por accion y mascota.
import { useEffect, useState } from "react";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import { usarTitulo } from "../hooks/usarTitulo";
import { listarAuditoria } from "../services/admin.service";
import { obtenerMensajesDeError } from "../services/api";

const ACCIONES = [
  ["", "Todas las acciones"],
  ["VIEW_HISTORY", "Consultó la historia"],
  ["DOWNLOAD_PDF", "Descargó la historia en PDF"],
  ["DOWNLOAD_PRESCRIPTION", "Descargó una receta"],
  ["DOWNLOAD_ATTACHMENT", "Abrió un adjunto"],
  ["CREATE_RECORD", "Agregó una consulta"],
  ["UPDATE_RECORD", "Modificó una consulta"],
  ["ANNUL_RECORD", "Eliminó una consulta"],
  ["EXPORT_DATA", "Exportó datos personales"],
];

const ROLES = { VETERINARIAN: "Veterinario", ADMIN: "Administrador", CLIENT: "Dueño" };

function formatoFechaHora(fecha) {
  return new Date(fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Bogota" });
}

function AdminAuditoria() {
  usarTitulo("Auditoría");
  const [accion, setAccion] = useState("");
  const [mascota, setMascota] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    let cancelado = false;
    listarAuditoria({ page: pagina, action: accion, petId: mascota.trim() })
      .then((r) => {
        if (!cancelado) {
          setDatos(r);
          setErrores([]);
        }
      })
      .catch((error) => !cancelado && setErrores(obtenerMensajesDeError(error)));
    return () => {
      cancelado = true;
    };
  }, [pagina, accion, mascota]);

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor contenedor-ancho">
        <div className="tarjeta">
          <h1>Auditoría de accesos</h1>
          <p className="texto-suave">
            Constancia de quién consultó, descargó o cambió historias clínicas y de las exportaciones de datos
            personales (Ley 1581 de 2012). Lo más reciente primero.
          </p>
          <div className="fila">
            <div className="campo">
              <label htmlFor="auditoria-accion">Acción</label>
              <select
                id="auditoria-accion"
                value={accion}
                onChange={(e) => {
                  setAccion(e.target.value);
                  setPagina(1);
                }}
              >
                {ACCIONES.map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="auditoria-mascota">Número de mascota</label>
              <input
                id="auditoria-mascota"
                inputMode="numeric"
                value={mascota}
                onChange={(e) => {
                  setMascota(e.target.value.replace(/\D/g, ""));
                  setPagina(1);
                }}
                placeholder="Todas"
              />
            </div>
          </div>
        </div>

        <Alerta tipo="error" mensajes={errores} />
        {!datos && errores.length === 0 && <p className="texto-suave">Cargando...</p>}

        {datos && (
          <div className="tarjeta">
            <p className="texto-suave" role="status">
              {datos.total} registro(s) · página {datos.page} de {datos.totalPages}
            </p>
            {datos.logs.length === 0 ? (
              <p className="texto-suave">No hay registros con ese filtro.</p>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Quién</th>
                      <th scope="col">Acción</th>
                      <th scope="col">Mascota</th>
                      <th scope="col">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.logs.map((l) => (
                      <tr key={l.id}>
                        <td>{formatoFechaHora(l.at)}</td>
                        <td>
                          {l.actor || "Usuario eliminado"}
                          {l.role && <span className="texto-suave"> ({ROLES[l.role] || l.role})</span>}
                        </td>
                        <td>{l.label}</td>
                        <td>{l.petId ?? "—"}</td>
                        <td>{l.ip || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="acciones-linea">
              <button type="button" className="boton boton-secundario boton-auto" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </button>
              <button
                type="button"
                className="boton boton-secundario boton-auto"
                disabled={pagina >= datos.totalPages}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminAuditoria;
