// Pruebas unitarias de la logica de los servicios que no necesita base de datos: formato publico de las citas
// y del pago, horarios libres, token y usuario publico, correos y PDF.
const { describe, test, before } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { toPublicAppointment } = require("../../src/modules/appointments/appointment.service");
const vetService = require("../../src/modules/vets/vet.service");
const authService = require("../../src/modules/auth/auth.service");
const { plantilla } = require("../../src/modules/notifications/mail.service");
const { buildHistoryPdf, buildPrescriptionPdf } = require("../../src/modules/records/historyPdf.service");
const { buildSlots, overlaps, parseTime, toTimeString, atMinutes, parseDate, startOfDay, addDays } = require("../../src/utils/schedule");

before(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
});

// 16 de noviembre de 2026 (lunes), 10:00 en Bogota = 15:00 UTC.
const LUNES_10AM = new Date("2026-11-16T15:00:00Z");

function cita(extra = {}) {
  return {
    id: 1,
    mode: "CLINIC",
    scheduledAt: LUNES_10AM,
    durationMinutes: 30,
    address: null,
    notes: null,
    status: "CONFIRMED",
    createdAt: LUNES_10AM,
    client: { id: 2, name: "Laura", email: "laura@test.com" },
    vetProfile: { id: 7, specialty: "General", address: "Calle 5", phone: "300", user: { id: 9, name: "Dra. Rojas", email: "v@test.com" } },
    pet: { id: 3, name: "Luna", species: "Perro" },
    review: null,
    medicalRecord: null,
    service: { id: 4, name: "Consulta", price: "60000.00", durationMinutes: 30 },
    paidAt: null,
    paidAmount: null,
    paymentRef: null,
    refundedAt: null,
    ...extra,
  };
}

describe("toPublicAppointment", () => {
  test("convierte el instante a la fecha y hora de la clinica, no a UTC", () => {
    const p = toPublicAppointment(cita());
    assert.equal(p.date, "2026-11-16");
    assert.equal(p.time, "10:00");
    assert.equal(p.vet.name, "Dra. Rojas");
    assert.equal(p.service.price, 60000, "el precio sale como numero");
    assert.equal(p.medicalRecordId, null);
  });

  test("una cita a las 23:30 de Bogota sigue siendo del mismo dia aunque en UTC ya sea el siguiente", () => {
    const p = toPublicAppointment(cita({ scheduledAt: new Date("2026-11-17T04:30:00Z") }));
    assert.deepEqual([p.date, p.time], ["2026-11-16", "23:30"]);
  });

  test("estado del pago: PENDING, PAID, REFUNDED y NONE", () => {
    assert.deepEqual(
      { status: toPublicAppointment(cita()).payment.status, amount: toPublicAppointment(cita()).payment.amount },
      { status: "PENDING", amount: 60000 }
    );
    const pagada = toPublicAppointment(cita({ paidAt: LUNES_10AM, paidAmount: "55000.00", paymentRef: "SIM-1-ABC" }));
    assert.deepEqual([pagada.payment.status, pagada.payment.amount, pagada.payment.reference], ["PAID", 55000, "SIM-1-ABC"]);
    assert.equal(toPublicAppointment(cita({ paidAt: LUNES_10AM, refundedAt: LUNES_10AM })).payment.status, "REFUNDED");
    assert.equal(toPublicAppointment(cita({ service: null })).payment.status, "NONE");
    assert.equal(toPublicAppointment(cita({ service: { id: 4, name: "Gratis", price: "0", durationMinutes: 30 } })).payment.status, "NONE");
  });

  test("incluye la resena y el id de la historia cuando existen", () => {
    const p = toPublicAppointment(cita({ review: { rating: 5, comment: "Excelente" }, medicalRecord: { id: 11 } }));
    assert.deepEqual(p.review, { rating: 5, comment: "Excelente" });
    assert.equal(p.medicalRecordId, 11);
  });
});

describe("horarios libres (vet.service)", () => {
  const veterinario = { availabilities: [{ weekday: 1, startTime: "08:00", endTime: "10:00" }] };
  // Lunes 16, 07:00 en Bogota = 12:00 UTC: todavia no empieza la jornada.
  const ahora = new Date("2026-11-16T12:00:00Z");

  test("slotsByDay devuelve los bloques de 30 minutos de los dias que atiende", () => {
    const dias = vetService.slotsByDay(veterinario, [], { dias: 3, now: ahora });
    assert.deepEqual(dias.map((d) => d.date), ["2026-11-16", "2026-11-17", "2026-11-18"]);
    assert.deepEqual(dias[0].slots, ["08:00", "08:30", "09:00", "09:30"]);
    assert.deepEqual(dias[1].slots, [], "el martes no atiende");
  });

  test("las citas ocupadas se descuentan y firstFreeSlot encuentra el primer hueco", () => {
    const ocupado = [{ start: new Date("2026-11-16T13:00:00Z"), end: new Date("2026-11-16T14:00:00Z") }]; // 08:00 a 09:00
    assert.deepEqual(vetService.slotsByDay(veterinario, ocupado, { dias: 1, now: ahora })[0].slots, ["09:00", "09:30"]);
    assert.deepEqual(vetService.firstFreeSlot(veterinario, ocupado, { dias: 7, now: ahora }), { date: "2026-11-16", time: "09:00" });
    // Si no hay nada libre en el rango, no hay primer turno.
    assert.equal(vetService.firstFreeSlot({ availabilities: [] }, [], { dias: 7, now: ahora }), null);
  });

  test("una servicio de 60 minutos solo cabe donde hay una hora seguida", () => {
    const ocupado = [{ start: new Date("2026-11-16T13:30:00Z"), end: new Date("2026-11-16T14:00:00Z") }]; // 08:30 a 09:00
    const slots = vetService.slotsByDay(veterinario, ocupado, { dias: 1, durationMinutes: 60, now: ahora })[0].slots;
    assert.deepEqual(slots, ["09:00"], "08:00 y 08:30 chocan con la cita; 09:00 cabe hasta las 10:00");
  });

  test("buildScheduleSlots ignora la hora actual (solo importa el horario de atencion)", () => {
    assert.deepEqual(vetService.buildScheduleSlots(veterinario, parseDate("2026-11-16")), ["08:00", "08:30", "09:00", "09:30"]);
  });

  test("validateMode avisa cuando el veterinario no ofrece la modalidad", () => {
    assert.match(vetService.validateMode({ homeService: false, clinicService: true }, "HOME"), /domicilio/);
    assert.match(vetService.validateMode({ homeService: true, clinicService: false }, "CLINIC"), /veterinaria/);
    assert.equal(vetService.validateMode({ homeService: true, clinicService: true }, "HOME"), null);
  });

  test("toPublicService expone el precio como numero", () => {
    assert.deepEqual(vetService.toPublicService({ id: 1, name: "Baño", description: null, price: "80000.00", durationMinutes: 60, active: true, secreto: "x" }), {
      id: 1,
      name: "Baño",
      description: null,
      price: 80000,
      durationMinutes: 60,
    });
  });
});

describe("calendario (schedule)", () => {
  test("overlaps: tocar el borde no es cruzarse", () => {
    const d = (h) => new Date(`2026-11-16T${String(h).padStart(2, "0")}:00:00Z`);
    assert.equal(overlaps(d(8), d(9), d(9), d(10)), false);
    assert.equal(overlaps(d(8), d(10), d(9), d(11)), true);
    assert.equal(overlaps(d(8), d(12), d(9), d(10)), true, "uno dentro del otro");
  });

  test("parseTime, toTimeString y atMinutes", () => {
    assert.equal(parseTime("08:30"), 510);
    assert.equal(parseTime("24:00"), null);
    assert.equal(parseTime("8:30"), null);
    assert.equal(toTimeString(510), "08:30");
    assert.equal(atMinutes(parseDate("2026-11-16"), 510).toISOString(), "2026-11-16T13:30:00.000Z");
  });

  test("buildSlots descarta lo que ya paso y lo que no cabe", () => {
    const franja = [{ weekday: 1, startTime: "08:00", endTime: "09:00" }];
    const dia = parseDate("2026-11-16");
    // A las 8:20 ya no se ofrece el bloque de las 8:00.
    assert.deepEqual(buildSlots({ availabilities: franja, date: dia, durationMinutes: 30, now: new Date("2026-11-16T13:20:00Z") }), ["08:30"]);
    // Un servicio de 90 minutos no cabe en una franja de 60.
    assert.deepEqual(buildSlots({ availabilities: franja, date: dia, durationMinutes: 90, now: new Date(0) }), []);
  });

  test("startOfDay y addDays no se corren por la zona horaria", () => {
    const inicio = startOfDay(new Date("2026-11-17T03:00:00Z")); // en Bogota aun es 16 por la noche
    assert.equal(inicio.toISOString(), "2026-11-16T05:00:00.000Z");
    assert.equal(addDays(inicio, 1).toISOString(), "2026-11-17T05:00:00.000Z");
  });
});

describe("auth.service (token y usuario publico)", () => {
  test("generateToken firma el id del usuario y vence", () => {
    const token = authService.generateToken({ id: 5 });
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(datos.userId, 5);
    assert.ok(datos.exp > datos.iat);
    assert.throws(() => jwt.verify(token, "otra-clave"));
  });

  test("verifyPassword compara con el hash de bcrypt", async () => {
    const hash = await bcrypt.hash("clave123", 4);
    assert.equal(await authService.verifyPassword("clave123", hash), true);
    assert.equal(await authService.verifyPassword("otra", hash), false);
  });

  test("toPublicUser nunca incluye la contraseña y agrega el perfil solo si es veterinario", () => {
    const cliente = authService.toPublicUser({ id: 1, name: "Ana", email: "a@test.com", password: "HASH", role: "CLIENT", status: "ACTIVE", emailVerifiedAt: null, createdAt: LUNES_10AM });
    assert.equal("password" in cliente, false);
    assert.equal(cliente.emailVerified, false);
    assert.equal("vetProfile" in cliente, false);

    const vet = authService.toPublicUser({
      id: 2, name: "Vet", email: "v@test.com", password: "HASH", role: "VETERINARIAN", status: "PENDING", emailVerifiedAt: LUNES_10AM, createdAt: LUNES_10AM,
      vetProfile: { id: 9, license: "MV-1", specialty: "General", photoUrl: null, homeService: true, clinicService: false, secreto: "x" },
    });
    assert.equal(vet.emailVerified, true);
    assert.deepEqual(vet.vetProfile, { id: 9, license: "MV-1", specialty: "General", photoUrl: null, homeService: true, clinicService: false });
  });

  test("el horario por defecto cubre lunes a viernes", () => {
    const dias = new Set(authService.DEFAULT_AVAILABILITY.map((f) => f.weekday));
    assert.deepEqual([...dias].sort(), [1, 2, 3, 4, 5]);
  });
});

describe("correos", () => {
  test("plantilla incluye el titulo, el enlace y una version de texto plano", () => {
    const { text, html } = plantilla({ titulo: "Restablece tu contraseña", cuerpo: "El enlace vence en 60 minutos.", enlace: "http://localhost/restablecer?token=abc", textoBoton: "Cambiar contraseña" });
    assert.match(text, /Restablece tu contraseña/);
    assert.match(text, /http:\/\/localhost\/restablecer\?token=abc/);
    assert.match(html, /Cambiar contraseña/);
    assert.match(html, /href="http:\/\/localhost\/restablecer\?token=abc"/);
  });
});

describe("PDF (historia y receta)", () => {
  const mascota = { name: "Luna", species: "Perro", sex: "Hembra", birthDate: "2022-04-10", weight: 12.5, breed: "Labrador", color: "Dorado", microchip: "985112345678901", sterilized: true, allergies: "Penicilina" };
  const entrada = {
    visitDate: "2026-06-01", reason: "Control", diagnosis: "Sano", treatment: null, weight: 12.5, temperature: 38.5, vaccines: null, observations: null, followUpDate: "2026-12-01", vetName: "Dra. Rojas",
    vaccinations: [{ name: "Rabia", appliedAt: "2026-06-01", nextDueAt: "2027-06-01", lot: "L1" }],
    prescriptions: [{ medication: "Omeprazol", dose: "10 mg", frequency: "cada 24 h", duration: "5 días", instructions: "En ayunas" }],
  };

  test("buildHistoryPdf genera un PDF valido, con y sin consultas", async () => {
    const conDatos = await buildHistoryPdf({ pet: mascota, owner: "Laura", records: [entrada] });
    assert.equal(conDatos.subarray(0, 5).toString(), "%PDF-");
    assert.ok(conDatos.length > 1000);
    const vacio = await buildHistoryPdf({ pet: { ...mascota, breed: null, allergies: null, sterilized: null }, owner: null, records: [] });
    assert.equal(vacio.subarray(0, 5).toString(), "%PDF-");
  });

  test("buildPrescriptionPdf genera la receta con los datos del profesional", async () => {
    const pdf = await buildPrescriptionPdf({
      pet: mascota, owner: "Laura", vet: { name: "Dra. Rojas", specialty: "General", license: "MV-1" }, visitDate: "2026-06-01", prescriptions: entrada.prescriptions,
    });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  });
});
