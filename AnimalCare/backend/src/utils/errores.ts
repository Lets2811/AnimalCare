// Ayudas para trabajar con `unknown` en los bloques catch.

// Error de Prisma con codigo (por ejemplo P2002: valor unico repetido).
export function esErrorPrisma(error: unknown): error is { code: string; meta?: { target?: unknown } } {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string";
}

// Error de Express/body-parser (entity.too.large, entity.parse.failed...) o con status HTTP.
export function datosDeError(error: unknown): { type?: string; status?: number } {
  return typeof error === "object" && error !== null ? (error as { type?: string; status?: number }) : {};
}

export function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
