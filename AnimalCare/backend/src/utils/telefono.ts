// Validacion unica de telefonos: solo digitos, +, espacios y guiones, con 7 a 15 DIGITOS.
// (Antes se contaban tambien los espacios y el signo +, y "+57 300 123 4567" se rechazaba.)
export function telefonoValido(texto: unknown): boolean {
  const valor = String(texto ?? "").trim();
  if (valor.length > 25 || !/^[0-9+\s-]+$/.test(valor)) return false;
  const digitos = valor.replace(/\D/g, "").length;
  return digitos >= 7 && digitos <= 15;
}
