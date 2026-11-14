// Campos que el middleware agrega a la peticion de Express.
import type { Role, AccountStatus } from "@prisma/client";

export interface UsuarioAutenticado {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  emailVerified: boolean;
  privacyAcceptedAt: Date | null;
  privacyVersion: string | null;
  createdAt: Date;
  vetProfile: {
    id: number;
    license: string;
    specialty: string;
    homeService: boolean;
    clinicService: boolean;
  } | null;
}

declare global {
  namespace Express {
    interface Request {
      // Lo agrega authenticate (middleware/auth.middleware). Las rutas privadas siempre lo tienen.
      user: UsuarioAutenticado;
      // Lo agrega createRateLimit (middleware/security.middleware).
      rateLimit?: { fail(): void; reset(): void };
    }
  }
}
