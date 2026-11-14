import type { Prisma } from "@prisma/client";
// Avisos dentro de la plataforma (AN-35, AN-37, AN-31; base de AN-22 y AN-23).
import prisma from "../prisma";

const MAX_LISTED = 50;

// db permite usarlo dentro de una transaccion (prisma.$transaction(async (tx) => ...)).
async function notify(userId: number, message: string, db: Prisma.TransactionClient = prisma) {
  return db.notification.create({ data: { userId, message } });
}

// Mismo aviso para varios usuarios (por ejemplo, a los veterinarios de turno).
async function notifyMany(userIds: number[], message: string, db: Prisma.TransactionClient = prisma) {
  if (userIds.length === 0) {
    return { count: 0 };
  }
  return db.notification.createMany({
    data: userIds.map((userId: number) => ({ userId, message })),
  });
}

async function findByUser(userId: number) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_LISTED,
  });
}

// Devuelve cuantas se marcaron: 0 si la notificacion no es de ese usuario.
async function markAsRead(id: number, userId: number) {
  const resultado = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return resultado.count;
}

async function markAllAsRead(userId: number) {
  const resultado = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return resultado.count;
}

async function countUnread(userId: number) {
  return prisma.notification.count({ where: { userId, read: false } });
}

function toPublicNotification(notification: any) {
  return {
    id: notification.id,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

export { notify, notifyMany, findByUser, markAsRead, markAllAsRead, countUnread, toPublicNotification };
