// Lista (y con --borrar elimina) los archivos de uploads/ que ya no estan en la base de datos:
// restos de pruebas interrumpidas, de una foto reemplazada o de un adjunto eliminado.
//
//   npx tsx scripts/huerfanos.ts            solo muestra
//   npx tsx scripts/huerfanos.ts --borrar   elimina los huerfanos
//
// Un archivo referenciado por la base NUNCA se toca.
import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";

import prisma from "../src/prisma";
import { RAIZ_BACKEND } from "../src/utils/raiz";

const UPLOADS = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(RAIZ_BACKEND, "uploads");

async function huerfanosDe(subcarpeta: string, referenciados: Set<string>) {
  const dir = path.join(UPLOADS, subcarpeta);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isFile() && !referenciados.has(f))
    .map((f) => path.join(dir, f));
}

async function main() {
  const borrar = process.argv.includes("--borrar");
  const [adjuntos, perfiles] = await Promise.all([
    prisma.medicalAttachment.findMany({ select: { storedName: true } }),
    prisma.vetProfile.findMany({ select: { photoUrl: true, licenseDocPath: true } }),
  ]);
  const records = new Set(adjuntos.map((a) => path.basename(a.storedName)));
  const docs = new Set(perfiles.map((p) => (p.licenseDocPath ? path.basename(p.licenseDocPath) : "")).filter(Boolean));
  const photos = new Set(perfiles.map((p) => (p.photoUrl ? path.basename(p.photoUrl) : "")).filter(Boolean));

  const lista = [
    ...(await huerfanosDe("records", records)),
    ...(await huerfanosDe("docs", docs)),
    ...(await huerfanosDe("photos", photos)),
  ];
  console.log(`${lista.length} archivo(s) huerfano(s) en ${UPLOADS}`);
  for (const f of lista) {
    console.log(`  ${borrar ? "borrado" : "huerfano"}: ${path.relative(UPLOADS, f)}`);
    if (borrar) fs.unlinkSync(f);
  }
  if (!borrar && lista.length > 0) console.log("Usa --borrar para eliminarlos.");
}

main()
  .catch((error) => {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
