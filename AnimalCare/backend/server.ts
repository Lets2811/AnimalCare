import dotenv from "dotenv";
dotenv.config();

import app from "./src/app";
import { startReminderJob } from "./src/modules/appointments/reminder.service";

// Sin la clave secreta no es posible firmar ni verificar tokens.
// Es preferible fallar al arrancar que devolver errores confusos despues.
if (!process.env.JWT_SECRET) {
  console.error("Falta la variable JWT_SECRET en el archivo .env");
  process.exit(1);
}

// Una clave corta o de ejemplo se adivina o filtra con facilidad: no se acepta.
const secreto = process.env.JWT_SECRET;
if (secreto.length < 32) {
  console.error("JWT_SECRET debe tener al menos 32 caracteres (por ejemplo, 48 bytes aleatorios en base64).");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && /cambia_esta_clave|changeme/i.test(secreto)) {
  console.error("JWT_SECRET sigue siendo la clave de ejemplo. Cambiala antes de publicar.");
  process.exit(1);
}

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`AnimalCare API escuchando en http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);

  // Recordatorios de citas de las proximas 24 horas (cada 10 minutos).
  startReminderJob();
});
