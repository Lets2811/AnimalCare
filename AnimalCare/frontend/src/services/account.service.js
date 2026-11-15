// Cuenta: recuperar contrasena, verificar correo, editar datos y eliminar la cuenta.
import api from "./api";

export async function solicitarRecuperacion(email) {
  const respuesta = await api.post("/auth/forgot-password", { email });
  return respuesta.data;
}

export async function restablecerContrasena(token, password) {
  const respuesta = await api.post("/auth/reset-password", { token, password });
  return respuesta.data;
}

export async function verificarCorreo(token) {
  const respuesta = await api.post("/auth/verify-email", { token });
  return respuesta.data;
}

export async function reenviarVerificacion() {
  const respuesta = await api.post("/account/resend-verification");
  return respuesta.data;
}

// Derecho de acceso (habeas data): descarga todos mis datos en un archivo JSON.
export async function exportarMisDatos() {
  const respuesta = await api.get("/account/export", { responseType: "blob" });
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "animalcare-mis-datos.json";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function actualizarCuenta(datos) {
  const respuesta = await api.put("/account", datos);
  return respuesta.data;
}

export async function cambiarContrasena(currentPassword, newPassword) {
  const respuesta = await api.put("/account/password", { currentPassword, newPassword });
  return respuesta.data;
}

export async function eliminarCuenta(password) {
  const respuesta = await api.delete("/account", { data: { password } });
  return respuesta.data;
}

// Cierra la sesion en todos los dispositivos (invalida los tokens anteriores).
export async function cerrarTodasLasSesiones() {
  const respuesta = await api.post("/auth/logout-all");
  return respuesta.data;
}

// Misma politica que el backend: 8 a 72 caracteres, con letra y numero.
// (El backend ademas rechaza las claves muy comunes, como "password123".)
export function contrasenaValida(password) {
  const clave = String(password ?? "");
  return clave.length >= 8 && clave.length <= 72 && /\d/.test(clave) && /\p{L}/u.test(clave);
}
export const MENSAJE_CONTRASENA =
  "La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número, y no ser una clave común";
