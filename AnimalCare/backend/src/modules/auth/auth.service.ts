import { PRIVACY_VERSION } from "../../utils/privacidad";
// Logica de autenticacion: hash de contrasenas, verificacion y generacion de JWT.
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import prisma from "../../prisma";

// Numero de rondas de bcrypt. A mayor numero, mas lento y mas seguro.
// 12 es el valor recomendado hoy; las claves guardadas con menos rondas se actualizan
// solas al iniciar sesion (ver rehashSiHaceFalta).
export const SALT_ROUNDS = 12;

// Datos fijos del JWT: se verifican al leerlo, asi un token de otro sistema no sirve.
export const JWT_ALGORITMO = "HS256";
export const JWT_EMISOR = "animalcare";
export const JWT_AUDIENCIA = "animalcare-web";

// Horario que se carga automaticamente al registrar un veterinario:
// de lunes a viernes, manana y tarde. Asi el profesional queda disponible
// desde el primer momento y el cliente puede agendar (AN-13).
const DEFAULT_AVAILABILITY = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, startTime: "09:00", endTime: "13:00" },
  { weekday, startTime: "14:00", endTime: "18:00" },
]);

// Busca un usuario por su correo. Devuelve null si no existe.
// Incluye el perfil profesional cuando la cuenta es de un veterinario.
async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { vetProfile: true },
  });
}

// Comprueba si una matricula profesional ya esta registrada.
async function findVetProfileByLicense(license: any) {
  return prisma.vetProfile.findUnique({ where: { license } });
}

// Crea un usuario guardando SIEMPRE la contrasena hasheada, nunca en texto plano.
//
// Si el rol es VETERINARIAN se crea ademas su perfil profesional, sus servicios
// y su horario por defecto. Todo ocurre dentro de una transaccion: o se guarda
// el conjunto completo, o no se guarda nada. Nunca queda un veterinario a medias.
export interface PerfilNuevoVeterinario {
  license: string;
  specialty: string;
  bio: string | null;
  photoUrl: string | null;
  phone: string | null;
  address: string | null;
  homeService: boolean;
  clinicService: boolean;
  services: { name: string; description: string | null; price: number; durationMinutes: number }[];
}

interface NuevoUsuario {
  name: string;
  email: string;
  password: string;
  role?: string;
  profile?: PerfilNuevoVeterinario | null;
}

async function createUser({ name, email, password, role = "CLIENT", profile = null }: NuevoUsuario) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  if (role !== "VETERINARIAN") {
    return prisma.user.create({
      data: { name, email, password: hashedPassword, role: "CLIENT", privacyAcceptedAt: new Date(), privacyVersion: PRIVACY_VERSION },
    });
  }

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "VETERINARIAN",
      privacyAcceptedAt: new Date(),
      privacyVersion: PRIVACY_VERSION,
      // El veterinario no queda visible ni puede atender hasta que el
      // administrador valide su matricula (AN-7 escenario 8, AN-35).
      status: "PENDING",
      vetProfile: {
        create: {
          license: profile!.license,
          specialty: profile!.specialty,
          bio: profile!.bio,
          photoUrl: profile!.photoUrl,
          phone: profile!.phone,
          address: profile!.address,
          homeService: profile!.homeService,
          clinicService: profile!.clinicService,
          services: {
            create: profile!.services,
          },
          availabilities: {
            create: DEFAULT_AVAILABILITY,
          },
        },
      },
    },
    include: { vetProfile: true },
  });
}

// Compara la contrasena escrita por el usuario contra el hash almacenado.
// bcrypt no "desencripta": vuelve a hashear y compara.
async function verifyPassword(plainPassword: any, hashedPassword: any) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// Genera el JWT. El payload solo lleva el id del usuario:
// es el dato que el backend usara para saber de quien son las mascotas y las citas.
// tv (tokenVersion) permite invalidar todas las sesiones de una persona de una vez.
function generateToken(user: any) {
  return jwt.sign(
    { userId: user.id, tv: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET as string,
    {
      algorithm: JWT_ALGORITMO,
      issuer: JWT_EMISOR,
      audience: JWT_AUDIENCIA,
      expiresIn: (process.env.JWT_EXPIRES_IN || "2h") as jwt.SignOptions["expiresIn"],
    }
  );
}

// Compara contra un hash falso cuando el correo no existe, para que responder
// "no existe" tarde lo mismo que responder "clave incorrecta" (evita enumerar correos).
let hashFalso: string | null = null;
async function gastarTiempoDeHash(clave: string) {
  hashFalso ??= await bcrypt.hash("clave-falsa-para-igualar-tiempos", SALT_ROUNDS);
  await bcrypt.compare(clave, hashFalso);
}

// Si la clave se guardo con menos rondas que las actuales, se vuelve a guardar mejor.
async function rehashSiHaceFalta(userId: number, clave: string, hashActual: string) {
  if (bcrypt.getRounds(hashActual) >= SALT_ROUNDS) return;
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(clave, SALT_ROUNDS) } });
}

// Devuelve los datos del usuario que SI pueden enviarse al frontend.
// La contrasena (hash incluido) nunca sale de la API.
function toPublicUser(user: any) {
  const publicUser: Record<string, unknown> = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
    privacyAcceptedAt: user.privacyAcceptedAt ?? null,
    privacyVersion: user.privacyVersion ?? null,
  };

  // El frontend usa estos datos para decidir que panel mostrar.
  if (user.vetProfile) {
    publicUser.vetProfile = {
      id: user.vetProfile.id,
      license: user.vetProfile.license,
      specialty: user.vetProfile.specialty,
      photoUrl: user.vetProfile.photoUrl,
      homeService: user.vetProfile.homeService,
      clinicService: user.vetProfile.clinicService,
    };
  }

  return publicUser;
}

export { findUserByEmail, findVetProfileByLicense, createUser, verifyPassword, generateToken, gastarTiempoDeHash, rehashSiHaceFalta, toPublicUser, DEFAULT_AVAILABILITY };
