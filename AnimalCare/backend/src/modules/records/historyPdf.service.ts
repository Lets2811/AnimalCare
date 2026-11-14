// PDF de la historia clinica de una mascota (con su carnet de vacunas) y de la receta de una consulta.
// Solo texto en la fuente estandar (Helvetica): admite tildes y la ñ.
import PDFDocument from "pdfkit";

const VERDE = "#1c6742";
const GRIS = "#5b6472";

export interface VacunaPdf {
  name: string;
  appliedAt: string;
  nextDueAt: string | null;
  lot: string | null;
}

export interface RecetaPdf {
  medication: string;
  dose: string;
  frequency: string;
  duration: string | null;
  instructions: string | null;
}

export interface MascotaPdf {
  name: string;
  species: string;
  sex: string;
  birthDate: string;
  weight: number | null;
  breed?: string | null;
  color?: string | null;
  microchip?: string | null;
  sterilized?: boolean | null;
  allergies?: string | null;
}

interface DatosHistoria {
  pet: MascotaPdf;
  owner: string | null;
  records: {
    visitDate: string;
    reason: string;
    diagnosis: string;
    treatment: string | null;
    weight: number | null;
    temperature: number | null;
    vaccines: string | null;
    observations: string | null;
    followUpDate: string | null;
    vetName: string;
    vaccinations: VacunaPdf[];
    prescriptions: RecetaPdf[];
  }[];
  generadoEn?: Date;
}

function fila(doc: PDFKit.PDFDocument, etiqueta: string, valor: unknown) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(`${etiqueta}: `, { continued: true });
  doc.font("Helvetica").text(String(valor));
}

function documento(titulo: string): { doc: PDFKit.PDFDocument; terminar: () => Promise<Buffer> } {
  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: titulo, Author: "AnimalCare" } });
  const partes: Buffer[] = [];
  doc.on("data", (p: Buffer) => partes.push(p));
  const terminar = () =>
    new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(partes)));
      doc.on("error", reject);
      doc.end();
    });
  return { doc, terminar };
}

function cabecera(doc: PDFKit.PDFDocument, titulo: string, generadoEn: Date) {
  doc.font("Helvetica-Bold").fontSize(20).fillColor(VERDE).text("AnimalCare");
  doc.font("Helvetica").fontSize(14).fillColor("#000").text(titulo);
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor(GRIS).text(`Generada el ${generadoEn.toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}`);
  doc.moveDown();
}

function fichaMascota(doc: PDFKit.PDFDocument, pet: MascotaPdf, owner: string | null) {
  fila(doc, "Especie", pet.species);
  fila(doc, "Raza", pet.breed);
  fila(doc, "Color", pet.color);
  fila(doc, "Sexo", pet.sex);
  fila(doc, "Nacimiento", pet.birthDate);
  fila(doc, "Peso actual", pet.weight === null || pet.weight === undefined ? null : `${pet.weight} kg`);
  fila(doc, "Microchip", pet.microchip);
  fila(doc, "Esterilizado", pet.sterilized === null || pet.sterilized === undefined ? null : pet.sterilized ? "Sí" : "No");
  fila(doc, "Alergias", pet.allergies);
  fila(doc, "Dueño", owner);
}

function lineaVacuna(v: VacunaPdf) {
  return `${v.appliedAt}  ·  ${v.name}${v.lot ? ` (lote ${v.lot})` : ""}${v.nextDueAt ? `  ·  próxima dosis: ${v.nextDueAt}` : ""}`;
}

function lineaReceta(r: RecetaPdf) {
  return `${r.medication} — ${r.dose}, ${r.frequency}${r.duration ? `, durante ${r.duration}` : ""}`;
}

// pet, owner, records (de la mas antigua a la mas reciente)
function buildHistoryPdf({ pet, owner, records, generadoEn = new Date() }: DatosHistoria): Promise<Buffer> {
  const { doc, terminar } = documento(`Historia clínica de ${pet.name}`);
  cabecera(doc, `Historia clínica de ${pet.name}`, generadoEn);
  fichaMascota(doc, pet, owner);

  // Carnet de vacunas: las vacunas estructuradas y las anotadas como texto, de la mas antigua a la mas reciente.
  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(13).fillColor(VERDE).text("Carnet de vacunas");
  doc.moveDown(0.3);
  let hayVacunas = false;
  for (const r of records) {
    for (const v of r.vaccinations) {
      hayVacunas = true;
      doc.font("Helvetica").fontSize(10).fillColor("#000").text(`${lineaVacuna(v)}  ·  ${r.vetName}`);
    }
    if (r.vaccinations.length === 0 && r.vaccines) {
      hayVacunas = true;
      doc.font("Helvetica").fontSize(10).fillColor("#000").text(`${r.visitDate}  ·  ${r.vaccines}  ·  ${r.vetName}`);
    }
  }
  if (!hayVacunas) doc.font("Helvetica").fontSize(10).fillColor(GRIS).text("Sin vacunas registradas.");

  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(13).fillColor(VERDE).text("Consultas");
  if (records.length === 0) {
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor(GRIS).text("Todavía no hay consultas registradas.");
  }
  for (const r of [...records].reverse()) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text(`${r.visitDate} — ${r.reason}`);
    doc.fontSize(10);
    fila(doc, "Diagnóstico", r.diagnosis);
    fila(doc, "Tratamiento", r.treatment);
    fila(doc, "Peso", r.weight === null ? null : `${r.weight} kg`);
    fila(doc, "Temperatura", r.temperature === null ? null : `${r.temperature} °C`);
    if (r.vaccinations.length > 0) fila(doc, "Vacunas", r.vaccinations.map((v) => v.name + (v.nextDueAt ? ` (próxima: ${v.nextDueAt})` : "")).join("; "));
    else fila(doc, "Vacunas", r.vaccines);
    if (r.prescriptions.length > 0) fila(doc, "Receta", r.prescriptions.map(lineaReceta).join("; "));
    fila(doc, "Observaciones", r.observations);
    fila(doc, "Próximo control", r.followUpDate);
    fila(doc, "Atendió", r.vetName);
  }

  return terminar();
}

interface DatosReceta {
  pet: MascotaPdf;
  owner: string;
  vet: { name: string; specialty: string; license: string };
  visitDate: string;
  prescriptions: RecetaPdf[];
  generadoEn?: Date;
}

// Receta de una consulta: medicamentos, dosis y recomendaciones, con los datos del profesional.
function buildPrescriptionPdf({ pet, owner, vet, visitDate, prescriptions, generadoEn = new Date() }: DatosReceta): Promise<Buffer> {
  const { doc, terminar } = documento(`Receta de ${pet.name}`);
  cabecera(doc, `Receta veterinaria — ${pet.name}`, generadoEn);
  fila(doc, "Paciente", `${pet.name} (${pet.species}${pet.breed ? `, ${pet.breed}` : ""})`);
  fila(doc, "Dueño", owner);
  fila(doc, "Fecha de la consulta", visitDate);
  fila(doc, "Alergias", pet.allergies);

  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(13).fillColor(VERDE).text("Medicamentos");
  prescriptions.forEach((r, i) => {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text(`${i + 1}. ${r.medication}`);
    doc.fontSize(10);
    fila(doc, "Dosis", r.dose);
    fila(doc, "Frecuencia", r.frequency);
    fila(doc, "Duración", r.duration);
    fila(doc, "Indicaciones", r.instructions);
  });

  doc.moveDown(2);
  doc.font("Helvetica").fontSize(10).fillColor("#000").text("______________________________");
  doc.font("Helvetica-Bold").text(vet.name);
  doc.font("Helvetica").fillColor(GRIS).text(`${vet.specialty} · Matrícula ${vet.license}`);
  doc.moveDown();
  doc.fontSize(8).text("Este documento se generó en AnimalCare. Seguir las indicaciones del veterinario tratante; no automedicar.");

  return terminar();
}

export { buildHistoryPdf, buildPrescriptionPdf };
