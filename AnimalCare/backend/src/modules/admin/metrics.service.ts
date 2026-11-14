// Metricas del panel del administrador: usuarios, citas, urgencias y calificaciones.
// Todas las fechas se agrupan por dia de la clinica (America/Bogota).
import prisma from "../../prisma";
import { startOfDay, addDays, toDateString } from "../../utils/schedule";

const DIA_MS = 24 * 60 * 60 * 1000;

function contar(grupos: any, clave: any) {
  const fila = grupos.find((g: any) => g[clave.campo] === clave.valor);
  return fila ? fila._count._all : 0;
}

async function getMetrics(ahora = new Date()) {
  const desde30 = new Date(ahora.getTime() - 30 * DIA_MS);
  const hoy = startOfDay(ahora);
  const desde14 = addDays(hoy, -13);

  const [usuarios, nuevos30, citas30, proximas, citas14, urgencias30, aceptadas, resenas, completadasPorVet] = await Promise.all([
    prisma.user.groupBy({ by: ["role", "status"], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: desde30 }, status: { not: "DELETED" } } }),
    prisma.appointment.groupBy({ by: ["status"], where: { scheduledAt: { gte: desde30, lte: ahora } }, _count: { _all: true } }),
    prisma.appointment.count({ where: { status: { in: ["PENDING", "CONFIRMED"] }, scheduledAt: { gt: ahora } } }),
    prisma.appointment.findMany({ where: { scheduledAt: { gte: desde14 }, status: { not: "CANCELLED" } }, select: { scheduledAt: true } }),
    prisma.emergencyRequest.groupBy({ by: ["status"], where: { createdAt: { gte: desde30 } }, _count: { _all: true } }),
    prisma.emergencyRequest.findMany({
      where: { createdAt: { gte: desde30 }, acceptedAt: { not: null } },
      select: { createdAt: true, acceptedAt: true },
    }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.appointment.groupBy({
      by: ["vetProfileId"],
      where: { status: "COMPLETED", scheduledAt: { gte: desde30, lte: ahora } },
      _count: { _all: true },
      orderBy: { _count: { vetProfileId: "desc" } },
      take: 5,
    }),
  ]);

  // Citas por dia de los ultimos 14 dias (incluye los dias sin citas, en cero).
  const porDia = [];
  for (let i = 0; i < 14; i += 1) {
    porDia.push({ date: toDateString(addDays(desde14, i)), count: 0 });
  }
  for (const c of citas14) {
    const dia = porDia.find((d) => d.date === toDateString(c.scheduledAt));
    if (dia) dia.count += 1;
  }

  const minutos = aceptadas.map((u) => (u.acceptedAt!.getTime() - u.createdAt.getTime()) / 60000).filter((m) => m >= 0);
  const promedioAceptar = minutos.length ? Math.round((minutos.reduce((a, b) => a + b, 0) / minutos.length) * 10) / 10 : null;

  const perfiles = await prisma.vetProfile.findMany({
    where: { id: { in: completadasPorVet.map((g) => g.vetProfileId) } },
    select: { id: true, rating: true, user: { select: { name: true } } },
  });
  const topVeterinarios = completadasPorVet.map((g) => {
    const p = perfiles.find((x) => x.id === g.vetProfileId);
    return { name: p ? p.user.name : "—", completed: g._count._all, rating: p && p.rating !== null ? Number(p.rating) : null };
  });

  const deRol = (rol: any) => usuarios.filter((u) => u.role === rol && u.status !== "DELETED").reduce((n, u) => n + u._count._all, 0);
  const vetsEstado = (estado: any) => usuarios.filter((u) => u.role === "VETERINARIAN" && u.status === estado).reduce((n, u) => n + u._count._all, 0);

  return {
    generatedAt: ahora,
    users: {
      clients: deRol("CLIENT"),
      veterinarians: deRol("VETERINARIAN"),
      admins: deRol("ADMIN"),
      newLast30Days: nuevos30,
      veterinariansByStatus: {
        ACTIVE: vetsEstado("ACTIVE"),
        PENDING: vetsEstado("PENDING"),
        SUSPENDED: vetsEstado("SUSPENDED"),
        REJECTED: vetsEstado("REJECTED"),
      },
    },
    appointments: {
      last30Days: {
        total: citas30.reduce((n, g) => n + g._count._all, 0),
        completed: contar(citas30, { campo: "status", valor: "COMPLETED" }),
        cancelled: contar(citas30, { campo: "status", valor: "CANCELLED" }),
        pendingOrConfirmed: contar(citas30, { campo: "status", valor: "PENDING" }) + contar(citas30, { campo: "status", valor: "CONFIRMED" }),
      },
      upcoming: proximas,
      perDay: porDia,
    },
    emergencies: {
      last30Days: {
        total: urgencias30.reduce((n, g) => n + g._count._all, 0),
        completed: contar(urgencias30, { campo: "status", valor: "COMPLETED" }),
        expired: contar(urgencias30, { campo: "status", valor: "EXPIRED" }),
        cancelled: contar(urgencias30, { campo: "status", valor: "CANCELLED" }),
        open: contar(urgencias30, { campo: "status", valor: "OPEN" }) + contar(urgencias30, { campo: "status", valor: "ACCEPTED" }),
      },
      averageMinutesToAccept: promedioAceptar,
    },
    reviews: {
      count: resenas._count._all,
      average: resenas._avg.rating === null ? null : Math.round(resenas._avg.rating * 10) / 10,
    },
    topVeterinarians: topVeterinarios,
  };
}

export { getMetrics };
