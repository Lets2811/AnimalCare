// PDF de la historia clinica de una mascota (con su carnet de vacunas).
// Solo texto en la fuente estandar (Helvetica): admite tildes y la ñ.
const PDFDocument = require("pdfkit");

const VERDE = "#1c6742";
const GRIS = "#5b6472";

function fila(doc, etiqueta, valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(`${etiqueta}: `, { continued: true });
  doc.font("Helvetica").text(String(valor));
}

// pet: { name, species, sex, birthDate(AAAA-MM-DD), weight }, owner: nombre o null,
// records: [{ visitDate, reason, diagnosis, treatment, weight, temperature, vaccines, observations, vetName }]
function buildHistoryPdf({ pet, owner, records, generadoEn = new Date() }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Historia clínica de ${pet.name}`, Author: "AnimalCare" } });
    const partes = [];
    doc.on("data", (p) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(20).fillColor(VERDE).text("AnimalCare");
    doc.font("Helvetica").fontSize(14).fillColor("#000").text(`Historia clínica de ${pet.name}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(GRIS).text(`Generada el ${generadoEn.toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}`);
    doc.moveDown();

    fila(doc, "Especie", pet.species);
    fila(doc, "Sexo", pet.sex);
    fila(doc, "Nacimiento", pet.birthDate);
    fila(doc, "Peso actual", pet.weight === null || pet.weight === undefined ? null : `${pet.weight} kg`);
    fila(doc, "Dueño", owner);

    // Carnet de vacunas: las vacunas anotadas en cada consulta, de la mas antigua a la mas reciente.
    doc.moveDown();
    doc.font("Helvetica-Bold").fontSize(13).fillColor(VERDE).text("Carnet de vacunas");
    doc.moveDown(0.3);
    const vacunas = records.filter((r) => r.vaccines);
    if (vacunas.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(GRIS).text("Sin vacunas registradas.");
    } else {
      for (const r of vacunas) {
        doc.font("Helvetica").fontSize(10).fillColor("#000").text(`${r.visitDate}  ·  ${r.vaccines}  ·  ${r.vetName}`);
      }
    }

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
      fila(doc, "Vacunas", r.vaccines);
      fila(doc, "Observaciones", r.observations);
      fila(doc, "Atendió", r.vetName);
    }

    doc.end();
  });
}

module.exports = { buildHistoryPdf };
