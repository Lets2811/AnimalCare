// Politica unica de contrasenas (guia NIST SP 800-63B): longitud antes que complejidad,
// un limite maximo por bcrypt (solo lee los primeros 72 bytes) y rechazo de claves comunes.
export const LARGO_MINIMO = 8;
export const LARGO_MAXIMO = 72;
export const MENSAJE_CONTRASENA =
  "La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número, y no ser una clave común";

// Claves muy usadas que cumplen el formato y por eso se rechazan por nombre.
const COMUNES = new Set([
  "12345678", "123456789", "1234567890", "password1", "password123", "qwerty123", "contrasena1",
  "contraseña1", "abc12345", "iloveyou1", "admin1234", "colombia1", "bogota123", "123qweasd",
  "1q2w3e4r", "qwertyuiop1", "q1w2e3r4", "pass1234", "welcome1", "letmein123",
]);

export function contrasenaValida(texto: unknown): boolean {
  const clave = String(texto ?? "");
  if (clave.length < LARGO_MINIMO || Buffer.byteLength(clave, "utf8") > LARGO_MAXIMO) return false;
  if (!/\d/.test(clave) || !/\p{L}/u.test(clave)) return false;
  return !COMUNES.has(clave.toLowerCase());
}
