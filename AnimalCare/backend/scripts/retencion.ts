// Politica de retencion de datos (Ley 1581 de 2012: los datos no se conservan mas de lo necesario).
//
//   npm run retencion              simula: muestra cuanto se borraria
//   npm run retencion -- --aplicar borra de verdad
//
// Que depura (con los plazos por defecto, configurables por variables de entorno):
//   - Tokens de verificacion/recuperacion vencidos o ya usados hace mas de 30 dias   (RETENCION_TOKENS_DIAS)
//   - Notificaciones leidas hace mas de 180 dias                                      (RETENCION_NOTIFICACIONES_DIAS)
//   - Cuentas eliminadas por su titular hace mas de 90 dias: ya estan anonimizadas; se borra el
//     usuario si no tiene ninguna cita, mascota ni historia que conservar            (RETENCION_CUENTAS_DIAS)
// NO toca: historias clinicas, citas ni el registro de auditoria (se conservan por su valor
// asistencial y de trazabilidad; su plazo lo define el responsable del tratamiento con asesoria juridica).
import dotenv from "dotenv";
dotenv.config();

import prisma from "../src/prisma";

const DIA_MS = 24 * 60 * 60 * 1000;
const dias = (nombre: string, porDefecto: number) => Number(process.env[nombre]) || porDefecto;

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const ahora = Date.now();
  const hace = (n: number) => new Date(ahora - n * DIA_MS);

  const tokensDias = dias("RETENCION_TOKENS_DIAS", 30);
  const avisosDias = dias("RETENCION_NOTIFICACIONES_DIAS", 180);
  const cuentasDias = dias("RETENCION_CUENTAS_DIAS", 90);

  const dondeTokens = { OR: [{ expiresAt: { lt: hace(tokensDias) } }, { usedAt: { lt: hace(tokensDias) } }] };
  const dondeAvisos = { read: true, createdAt: { lt: hace(avisosDias) } };
  const cuentas = await prisma.user.findMany({
    where: { status: "DELETED", deletedAt: { lt: hace(cuentasDias) } },
    select: { id: true, _count: { select: { appointments: true, pets: true, emergencies: true, reviews: true } } },
  });
  const cuentasLibres = cuentas.filter((c) => Object.values(c._count).every((n) => n === 0)).map((c) => c.id);

  const [tokens, avisos] = await Promise.all([prisma.authToken.count({ where: dondeTokens }), prisma.notification.count({ where: dondeAvisos })]);
  console.log(`${aplicar ? "Aplicando" : "Simulacion"} de retencion:`);
  console.log(`  tokens vencidos o usados (> ${tokensDias} dias): ${tokens}`);
  console.log(`  notificaciones leidas y antiguas (> ${avisosDias} dias): ${avisos}`);
  console.log(`  cuentas eliminadas sin datos que conservar (> ${cuentasDias} dias): ${cuentasLibres.length}`);

  if (aplicar) {
    await prisma.authToken.deleteMany({ where: dondeTokens });
    await prisma.notification.deleteMany({ where: dondeAvisos });
    if (cuentasLibres.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: cuentasLibres } } });
      await prisma.authToken.deleteMany({ where: { userId: { in: cuentasLibres } } });
      await prisma.user.deleteMany({ where: { id: { in: cuentasLibres } } });
    }
    console.log("Listo.");
  } else {
    console.log("Nada se borro. Usa --aplicar para ejecutar.");
  }
}

main()
  .catch((error) => {
    console.error("Error en la retencion:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
