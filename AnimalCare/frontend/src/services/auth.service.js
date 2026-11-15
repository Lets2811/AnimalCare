// Operaciones de autenticacion contra la API y manejo de la sesion local.
import api from "./api";

// POST /api/auth/register
// datos lleva siempre name, email y password. Si el tipo de cuenta es
// VETERINARIAN, incluye ademas los datos profesionales (AN-7).
export async function registrar(datos) {
  const respuesta = await api.post("/auth/register", datos);
  return respuesta.data;
}

// POST /api/auth/login
// Si las credenciales son correctas, el backend deja la sesion en una cookie HttpOnly.
// Aqui solo se guardan los datos publicos del usuario y cuando vence la sesion;
// el token NO se guarda en el navegador.
export async function iniciarSesion({ email, password }) {
  const respuesta = await api.post("/auth/login", { email, password });
  const { user, expiresAt } = respuesta.data;

  localStorage.setItem("usuario", JSON.stringify(user));
  localStorage.setItem("sesionExpira", String(expiresAt || Date.now() + 2 * 60 * 60 * 1000));

  return respuesta.data;
}

// GET /api/auth/me
// Vuelve a pedir los datos del usuario y actualiza la copia local.
// Sirve para que el veterinario vea el cambio de estado (por ejemplo, cuando
// el administrador aprueba su cuenta) sin tener que cerrar sesion.
export async function actualizarUsuario() {
  const respuesta = await api.get("/auth/me");
  const { user } = respuesta.data;
  localStorage.setItem("usuario", JSON.stringify(user));
  return user;
}

// Cierra la sesion: borra los datos locales y le pide al backend que elimine la cookie.
export function cerrarSesion() {
  localStorage.removeItem("sesionExpira");
  localStorage.removeItem("usuario");
  // Si falla (sin conexion) la cookie vence sola; no debe bloquear la salida.
  api.post("/auth/logout").catch(() => {});
}

export function obtenerUsuario() {
  const guardado = localStorage.getItem("usuario");
  if (!guardado) {
    return null;
  }
  try {
    return JSON.parse(guardado);
  } catch {
    return null;
  }
}

// Solo sirve para no mostrar pantallas privadas con una sesion que el backend ya va a
// rechazar. La fecha la entrega el backend al iniciar sesion.
export function sesionVencida(expira, ahora = Date.now()) {
  const limite = Number(expira);
  return Number.isFinite(limite) && limite > 0 && limite <= ahora;
}

export function haySesionActiva() {
  if (!obtenerUsuario()) {
    return false;
  }
  if (sesionVencida(localStorage.getItem("sesionExpira"))) {
    cerrarSesion();
    guardarAvisoDeSesion("Tu sesión expiró. Inicia sesión de nuevo para continuar.");
    return false;
  }
  return true;
}

// El rol decide que panel y que opciones ve la persona que inicio sesion.
export function esVeterinario() {
  return obtenerUsuario()?.role === "VETERINARIAN";
}

export function esAdministrador() {
  return obtenerUsuario()?.role === "ADMIN";
}

// AN-8 escenario 3: veterinario registrado cuya matricula aun no se valida.
export function esVeterinarioPendiente(usuario = obtenerUsuario()) {
  return usuario?.role === "VETERINARIAN" && usuario?.status === "PENDING";
}

// Aviso que se muestra en el login cuando la sesion se cerro sola
// (por ejemplo, porque el administrador suspendio la cuenta).
const CLAVE_AVISO = "avisoSesion";

export function guardarAvisoDeSesion(mensaje) {
  sessionStorage.setItem(CLAVE_AVISO, mensaje);
}

export function tomarAvisoDeSesion() {
  const mensaje = sessionStorage.getItem(CLAVE_AVISO);
  sessionStorage.removeItem(CLAVE_AVISO);
  return mensaje;
}
