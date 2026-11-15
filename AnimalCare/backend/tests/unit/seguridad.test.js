// Pruebas unitarias de la politica de contrasenas y de las utilidades de sesion (sin base de datos).
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas-con-mas-de-32-caracteres";

const { contrasenaValida } = require("../../src/utils/contrasena");
const { leerCookies, tokenDeLaPeticion, origenPermitido, ponerCookieDeSesion, borrarCookieDeSesion, COOKIE_SESION } = require("../../src/utils/sesion");
const { generateToken, SALT_ROUNDS } = require("../../src/modules/auth/auth.service");

function respuesta() {
  const r = { cabeceras: [] };
  r.append = (k, v) => r.cabeceras.push([k, v]);
  return r;
}

describe("contrasenaValida", () => {
  test("acepta 8 a 72 caracteres con letra y numero (tambien con acentos y simbolos)", () => {
    for (const ok of ["abcd1234", "Clave2026", "perrito2026ñ", "frase larga con espacios 42", "a1".repeat(36)]) {
      assert.equal(contrasenaValida(ok), true, ok);
    }
  });

  test("rechaza cortas, largas, sin numero, sin letra, comunes y valores raros", () => {
    for (const mal of ["abc123", "abcdefgh", "12345678", "Password123", "QWERTY123", "a1".repeat(37), "", null, undefined, 12345678]) {
      assert.equal(contrasenaValida(mal), false, String(mal));
    }
  });

  test("el limite de 72 se mide en bytes (bcrypt ignora lo que pase de ahi)", () => {
    assert.equal(contrasenaValida(`${"ñ".repeat(35)}1`), true); // 71 bytes
    assert.equal(contrasenaValida(`${"ñ".repeat(36)}1`), false); // 73 bytes aunque solo son 37 caracteres
  });
});

describe("cookies de sesion", () => {
  test("leerCookies separa pares, decodifica y tolera basura", () => {
    assert.deepEqual(leerCookies("a=1; b=hola%20mundo;  c=x=y"), { a: "1", b: "hola mundo", c: "x=y" });
    assert.deepEqual(leerCookies(undefined), {});
    assert.deepEqual(leerCookies("sinvalor; =x; mala=%E0%A4%A"), {});
  });

  test("tokenDeLaPeticion prefiere Bearer y distingue el origen del token", () => {
    assert.deepEqual(tokenDeLaPeticion({ headers: { authorization: "Bearer abc", cookie: `${COOKIE_SESION}=zzz` } }), { token: "abc", porCookie: false });
    assert.deepEqual(tokenDeLaPeticion({ headers: { cookie: `x=1; ${COOKIE_SESION}=zzz` } }), { token: "zzz", porCookie: true });
    assert.equal(tokenDeLaPeticion({ headers: {} }), null);
    assert.equal(tokenDeLaPeticion({ headers: { authorization: "Bearer " } }), null);
  });

  test("la cookie es HttpOnly, SameSite=Lax y solo es Secure con HTTPS", () => {
    const token = generateToken({ id: 1 });
    const http = respuesta();
    ponerCookieDeSesion({ headers: {} }, http, token);
    const [, valor] = http.cabeceras[0];
    assert.match(valor, /^ac_sesion=/);
    assert.match(valor, /HttpOnly/);
    assert.match(valor, /SameSite=Lax/);
    assert.doesNotMatch(valor, /Secure/);

    const https = respuesta();
    ponerCookieDeSesion({ headers: { "x-forwarded-proto": "https" } }, https, token);
    assert.match(https.cabeceras[0][1], /Secure/);

    const borrar = respuesta();
    borrarCookieDeSesion({ headers: {} }, borrar);
    assert.match(borrar.cabeceras[0][1], /Max-Age=0/);
  });
});

describe("origenPermitido (CSRF)", () => {
  const permitidos = ["http://localhost:5173"];
  test("sin Origin, origen autorizado o el propio sitio pasan; los demas no", () => {
    assert.equal(origenPermitido({ headers: {} }, permitidos), true);
    assert.equal(origenPermitido({ headers: { origin: "http://localhost:5173" } }, permitidos), true);
    assert.equal(origenPermitido({ headers: { origin: "https://clinica.co", host: "clinica.co" } }, permitidos), true);
    assert.equal(origenPermitido({ headers: { origin: "https://malo.example", host: "clinica.co" } }, permitidos), false);
    assert.equal(origenPermitido({ headers: { origin: "no-es-url", host: "clinica.co" } }, permitidos), false);
  });
});

describe("tokens y hash", () => {
  test("el token lleva algoritmo, emisor, audiencia y version", () => {
    const jwt = require("jsonwebtoken");
    const t = generateToken({ id: 7, tokenVersion: 3 });
    const { header, payload } = jwt.decode(t, { complete: true });
    assert.equal(header.alg, "HS256");
    assert.deepEqual([payload.userId, payload.tv, payload.iss, payload.aud], [7, 3, "animalcare", "animalcare-web"]);
    assert.ok(payload.exp > payload.iat);
  });

  test("bcrypt usa al menos 12 rondas", () => assert.ok(SALT_ROUNDS >= 12));
});
