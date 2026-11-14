// Instancia unica de Prisma Client compartida por toda la aplicacion.
// Crear un PrismaClient por peticion abriria demasiadas conexiones a MySQL.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
