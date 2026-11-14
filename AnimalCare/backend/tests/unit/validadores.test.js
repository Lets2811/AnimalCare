// Pruebas unitarias de las reglas de validacion (sin base de datos ni servidor): cada una recibe datos
// y devuelve errores o valores normalizados. Son las reglas de negocio mas repetidas del sistema.
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const { validatePet } = require("../../src/modules/pets/pet.controller");
const { validateRecord, validarVacunas, validarRecetas } = require("../../src/modules/records/medicalRecord.controller");
const { validateRegisterData, validateServices, validateVetProfile } = require("../../src/modules/auth/auth.controller");
const { validateAvailabilities } = require("../../src/modules/vets/panel/vetPanel.controller");
const { validateServiceInput } = require("../../src/utils/serviceValidation");
const { telefonoValido } = require("../../src/utils/telefono");
const { addDays, startOfDay, toDateString } = require("../../src/utils/schedule");

const enDias = (n) => toDateString(addDays(startOfDay(), n));
const contiene = (errores, texto) => errores.some((e) => e.includes(texto));

describe("telefonoValido", () => {
  test("cuenta digitos (7 a 15) y admite +, espacios y guiones", () => {
    for (const bien of ["3001234567", "+57 300 123 4567", "300-123-4567", "1234567", "123456789012345"]) {
      assert.equal(telefonoValido(bien), true, bien);
    }
    for (const mal of ["", "123456", "abc1234567", "1234567890123456", "300#1234567", null, undefined, "1".repeat(26)]) {
      assert.equal(telefonoValido(mal), false, String(mal));
    }
  });
});

describe("validatePet (mascotas)", () => {
  const base = { name: "Luna", species: "Perro", sex: "Hembra", birthDate: "2022-04-10" };

  test("normaliza los datos validos", () => {
    const { errors, value } = validatePet({ ...base, weight: "12.5", breed: " Labrador ", microchip: "985 112 345 678 901", sterilized: true, allergies: "" });
    assert.deepEqual(errors, []);
    assert.equal(value.weight, 12.5);
    assert.equal(value.breed, "Labrador");
    assert.equal(value.microchip, "985112345678901");
    assert.equal(value.sterilized, true);
    assert.equal(value.allergies, null, "un texto vacio pasa a null");
  });

  test("la ficha solo viene en el resultado si se envia (para no borrarla al modificar)", () => {
    const { value } = validatePet(base);
    for (const campo of ["breed", "color", "microchip", "sterilized", "allergies"]) assert.equal(campo in value, false, campo);
  });

  test("rechaza especie, sexo, fecha, peso, microchip y esterilizado invalidos", () => {
    const casos = [
      [{ species: "Dragon" }, "especie"],
      [{ sex: "Otro" }, "sexo"],
      [{ birthDate: "2099-01-01" }, "futuro"],
      [{ birthDate: "1900-01-01" }, "más de"],
      [{ birthDate: "no-es-fecha" }, "no es válida"],
      [{ weight: "-3" }, "peso"],
      [{ weight: "500" }, "peso"],
      [{ microchip: "12ab" }, "microchip"],
      [{ sterilized: "talvez" }, "esterilizada"],
      [{ name: "" }, "nombre"],
      [{ name: "x".repeat(41) }, "nombre"],
    ];
    for (const [cambio, texto] of casos) {
      const { errors } = validatePet({ ...base, ...cambio });
      assert.ok(contiene(errors, texto), `${JSON.stringify(cambio)} -> ${errors.join(" | ")}`);
    }
  });
});

describe("validateRecord (historia clinica)", () => {
  const base = { reason: "Control", diagnosis: "Sano" };

  test("lo minimo es motivo y diagnostico", () => {
    assert.equal(validateRecord({}).errors.length, 2);
    const { errors, value } = validateRecord({ ...base, weight: "4.8", temperature: "38.6", observations: "  ok  " });
    assert.deepEqual(errors, []);
    assert.deepEqual([value.weight, value.temperature, value.observations], [4.8, 38.6, "ok"]);
  });

  test("peso y temperatura tienen rango; la fecha no puede ser futura", () => {
    assert.ok(contiene(validateRecord({ ...base, weight: "0" }).errors, "peso"));
    assert.ok(contiene(validateRecord({ ...base, weight: "201" }).errors, "peso"));
    assert.ok(contiene(validateRecord({ ...base, temperature: "29" }).errors, "temperatura"));
    assert.ok(contiene(validateRecord({ ...base, temperature: "46" }).errors, "temperatura"));
    assert.ok(contiene(validateRecord({ ...base, visitDate: "2099-01-01" }).errors, "futuro"));
  });

  test("el proximo control no puede ser pasado ni a mas de 2 años; null lo quita; ausente no cambia nada", () => {
    assert.equal(validateRecord({ ...base, followUpDate: enDias(10) }).errors.length, 0);
    assert.ok(contiene(validateRecord({ ...base, followUpDate: enDias(-1) }).errors, "pasada"));
    assert.ok(contiene(validateRecord({ ...base, followUpDate: "2099-01-01" }).errors, "2 años"));
    assert.equal(validateRecord({ ...base, followUpDate: null }).value.followUpDate, null);
    assert.equal(validateRecord(base).value.followUpDate, undefined);
  });

  test("los textos largos se rechazan", () => {
    assert.ok(contiene(validateRecord({ ...base, reason: "x".repeat(201) }).errors, "motivo"));
    assert.ok(contiene(validateRecord({ ...base, diagnosis: "x".repeat(2001) }).errors, "diagnóstico"));
  });
});

describe("validarVacunas y validarRecetas", () => {
  test("vacunas: ausente = undefined, vacia = [], con datos se normalizan", () => {
    const errores = [];
    assert.equal(validarVacunas(undefined, errores), undefined);
    assert.deepEqual(validarVacunas([], errores), []);
    const lista = validarVacunas([{ name: " Rabia ", nextDueAt: enDias(30), lot: "" }, { name: "Triple" }], errores);
    assert.deepEqual(errores, []);
    assert.equal(lista[0].name, "Rabia");
    assert.equal(lista[0].lot, null);
    assert.equal(lista[1].nextDueAt, null);
  });

  test("vacunas: nombre, fecha pasada, formato, cantidad y tipo", () => {
    const probar = (entrada) => {
      const errores = [];
      validarVacunas(entrada, errores);
      return errores;
    };
    assert.ok(contiene(probar([{ name: "" }]), "obligatorio"));
    assert.ok(contiene(probar([{ name: "R", nextDueAt: enDias(-1) }]), "pasada"));
    assert.ok(contiene(probar([{ name: "R", nextDueAt: "no" }]), "no es válida"));
    assert.ok(contiene(probar([{ name: "x".repeat(81) }]), "80"));
    assert.ok(contiene(probar(Array.from({ length: 11 }, (_, i) => ({ name: `V${i}` }))), "más de 10"));
    assert.ok(contiene(probar("texto"), "lista"));
  });

  test("recetas: medicamento, dosis y frecuencia son obligatorios", () => {
    const probar = (entrada) => {
      const errores = [];
      const lista = validarRecetas(entrada, errores);
      return { errores, lista };
    };
    const ok = probar([{ medication: "Amoxicilina", dose: "250 mg", frequency: "c/12 h", duration: "7 días", instructions: "Con comida" }]);
    assert.deepEqual(ok.errores, []);
    assert.equal(ok.lista[0].duration, "7 días");
    assert.ok(contiene(probar([{ medication: "", dose: "1", frequency: "2" }]).errores, "medicamento 1"));
    assert.ok(contiene(probar([{ medication: "A", dose: "", frequency: "2" }]).errores, "dosis"));
    assert.ok(contiene(probar([{ medication: "A", dose: "1", frequency: "" }]).errores, "frecuencia"));
    assert.ok(contiene(probar(Array.from({ length: 16 }, () => ({ medication: "A", dose: "1", frequency: "2" }))).errores, "más de 15"));
    assert.equal(probar(undefined).lista, undefined);
  });
});

describe("validateRegisterData y validateServices (registro)", () => {
  test("nombre, correo y contraseña", () => {
    assert.deepEqual(validateRegisterData({ name: "Ana", email: "ana@test.com", password: "clave123" }), []);
    const todo = validateRegisterData({ name: "", email: "", password: "" });
    assert.equal(todo.length, 3);
    assert.ok(contiene(validateRegisterData({ name: "Ana", email: "ana@@x", password: "clave123" }), "formato"));
    assert.ok(contiene(validateRegisterData({ name: "Ana", email: "ana@test.com", password: "corta" }), "contrase"));
    assert.ok(contiene(validateRegisterData({ name: "Ana", email: "ana@test.com", password: "sinnumero" }), "contrase"));
    assert.ok(contiene(validateRegisterData({ name: "x".repeat(101), email: "ana@test.com", password: "clave123" }), "nombre"));
  });

  test("servicios: lista opcional, con maximo y cada uno validado", () => {
    assert.deepEqual(validateServices(undefined), { errors: [], values: [] });
    assert.ok(contiene(validateServices("no").errors, "lista"));
    const ok = validateServices([{ name: "Consulta", price: "60000", durationMinutes: "30" }]);
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.values[0].price, 60000);
    assert.ok(validateServices([{ name: "", price: "1", durationMinutes: "30" }]).errors.length > 0);
    assert.ok(validateServices([{ name: "A", price: "0", durationMinutes: "30" }]).errors.length > 0);
    assert.ok(validateServices([{ name: "A", price: "10", durationMinutes: "20" }]).errors.length > 0, "la duracion es multiplo de 30");
  });
});

describe("validateVetProfile (registro de veterinario)", () => {
  const base = { license: "mv-1234", specialty: "Medicina general", clinicService: true, address: "Calle 5 # 10-20", phone: "+57 300 123 4567" };

  test("normaliza la matricula a mayusculas y acepta un telefono con prefijo", () => {
    const { errors, values } = validateVetProfile(base);
    assert.deepEqual(errors, []);
    assert.equal(values.license, "MV-1234");
    assert.equal(values.phone, "+57 300 123 4567");
  });

  test("reglas de matricula, especialidad, modalidades y direccion", () => {
    assert.ok(contiene(validateVetProfile({ ...base, license: "" }).errors, "matrícula es obligatorio"));
    assert.ok(contiene(validateVetProfile({ ...base, license: "AB" }).errors, "entre"));
    assert.ok(contiene(validateVetProfile({ ...base, license: "AB 12$" }).errors, "letras, números y guiones"));
    assert.ok(contiene(validateVetProfile({ ...base, specialty: "" }).errors, "especialidad"));
    assert.ok(contiene(validateVetProfile({ ...base, clinicService: false, homeService: false }).errors, "al menos una modalidad"));
    assert.ok(contiene(validateVetProfile({ ...base, address: "" }).errors, "direccion del consultorio"));
    assert.equal(validateVetProfile({ ...base, clinicService: false, homeService: true, address: "" }).errors.length, 0, "a domicilio no exige consultorio");
    assert.ok(contiene(validateVetProfile({ ...base, phone: "abc" }).errors, "telefono"));
    assert.ok(contiene(validateVetProfile({ ...base, photoUrl: "ftp://x" }).errors, "foto"));
  });
});

describe("validateServiceInput (servicios del veterinario)", () => {
  test("precio y duracion", () => {
    const ok = validateServiceInput({ name: "Vacunación", price: "45000", durationMinutes: "60", description: "Esquema" });
    assert.deepEqual(ok.errors, []);
    assert.deepEqual([ok.value.price, ok.value.durationMinutes], [45000, 60]);
    assert.ok(validateServiceInput({}).errors.length > 0);
    assert.ok(validateServiceInput({ name: "A", price: "abc", durationMinutes: "30" }).errors.length > 0);
    assert.ok(validateServiceInput({ name: "A", price: "1000000", durationMinutes: "30" }).errors.length > 0);
  });
});

describe("validateAvailabilities (Mi horario)", () => {
  test("franjas validas se normalizan", () => {
    const { errors, values } = validateAvailabilities([{ weekday: 1, startTime: "08:00", endTime: "12:00" }, { weekday: 1, startTime: "14:00", endTime: "18:00" }]);
    assert.deepEqual(errors, []);
    assert.equal(values.length, 2);
  });

  test("rechaza vacio, dia invalido, formato, fin antes del inicio y franjas que se cruzan", () => {
    assert.ok(contiene(validateAvailabilities([]).errors, "al menos una franja"));
    assert.ok(contiene(validateAvailabilities([{ weekday: 9, startTime: "08:00", endTime: "12:00" }]).errors, "día de la semana"));
    assert.ok(contiene(validateAvailabilities([{ weekday: 1, startTime: "8am", endTime: "12:00" }]).errors, "HH:MM"));
    assert.ok(contiene(validateAvailabilities([{ weekday: 1, startTime: "12:00", endTime: "08:00" }]).errors, "posterior"));
    assert.ok(
      contiene(validateAvailabilities([{ weekday: 1, startTime: "08:00", endTime: "12:00" }, { weekday: 1, startTime: "11:00", endTime: "14:00" }]).errors, "se cruzan")
    );
    // El mismo horario en dias distintos no se cruza.
    assert.deepEqual(validateAvailabilities([{ weekday: 1, startTime: "08:00", endTime: "12:00" }, { weekday: 2, startTime: "08:00", endTime: "12:00" }]).errors, []);
    assert.ok(contiene(validateAvailabilities(Array.from({ length: 22 }, () => ({ weekday: 1, startTime: "08:00", endTime: "09:00" }))).errors, "más de 21"));
  });
});
