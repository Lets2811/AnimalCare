// Pruebas de seguridad de la API: sesion por cookie HttpOnly, revocacion de tokens, proteccion
// contra CSRF, cabeceras, politica de contrasenas y proteccion de todas las rutas privadas.
// Arrancan la app en proceso (puerto propio) y usan la base de datos de desarrollo.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas-con-mas-de-32-caracteres";
process.env.CORS_ORIGIN = "http://localhost:5173";

const prisma = require("../src/prisma").default;
const PUERTO = 4320;
const BASE = `http://127.0.0.1:${PUERTO}/api`;
const EMAIL = `qa.seg.${Date.now()}@test.com`;
const CLAVE = "Segura2026x";
let servidor;

async function http(metodo, ruta, { body, cookie, token, origen } = {}) {
  const cabeceras = { "Content-Type": "application/json" };
  if (cookie) cabeceras.Cookie = cookie;
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (origen) cabeceras.Origin = origen;
  const r = await fetch(`${BASE}${ruta}`, { method: metodo, headers: cabeceras, body: body ? JSON.stringify(body) : undefined });
  const texto = await r.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { /* sin cuerpo JSON */ }
  return { status: r.status, datos, cabeceras: r.headers, cookies: r.headers.getSetCookie?.() ?? [] };
}

const cookieDe = (r) => (r.cookies.find((c) => c.startsWith("ac_sesion=")) || "").split(";")[0];

before(async () => {
  servidor = await new Promise((ok) => {
    const s = require("../src/app").default.listen(PUERTO, () => ok(s));
  });
  const r = await http("POST", "/auth/register", { body: { name: "QA Seguridad", email: EMAIL, password: CLAVE, acceptPrivacy: true } });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
});

after(async () => {
  await new Promise((ok) => servidor.close(ok));
  const u = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (u) {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: u.id }, { ownerId: u.id }] } });
    await prisma.authToken.deleteMany({ where: { userId: u.id } });
    await prisma.notification.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
});

describe("sesion por cookie HttpOnly", () => {
  test("el login deja una cookie HttpOnly con SameSite y vencimiento", async () => {
    const r = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    assert.equal(r.status, 200);
    const c = r.cookies.find((x) => x.startsWith("ac_sesion="));
    assert.ok(c, "debe poner la cookie");
    assert.match(c, /HttpOnly/);
    assert.match(c, /SameSite=Lax/);
    assert.match(c, /Max-Age=\d+/);
    assert.ok(r.datos.expiresAt > Date.now());
  });

  test("la cookie autentica sin cabecera Authorization", async () => {
    const login = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    const r = await http("GET", "/auth/me", { cookie: cookieDe(login) });
    assert.equal(r.status, 200);
    assert.equal(r.datos.user.email, EMAIL);
    assert.equal(r.datos.user.tokenVersion, undefined, "no expone el contador interno");
  });

  test("sin cookie ni token responde 401", async () => {
    assert.equal((await http("GET", "/auth/me")).status, 401);
  });

  test("logout borra la cookie (Max-Age=0)", async () => {
    const r = await http("POST", "/auth/logout");
    assert.equal(r.status, 200);
    assert.match(r.cookies.find((c) => c.startsWith("ac_sesion=")), /Max-Age=0/);
  });
});

describe("proteccion CSRF para peticiones con cookie", () => {
  test("una peticion que cambia datos desde otro origen es rechazada; desde el origen autorizado pasa", async () => {
    const login = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    const cookie = cookieDe(login);
    const malo = await http("POST", "/auth/logout-all", { cookie, origen: "https://sitio-malicioso.example" });
    assert.equal(malo.status, 403);
    const sinCambio = await http("GET", "/auth/me", { cookie });
    assert.equal(sinCambio.status, 200, "el rechazo no debe haber invalidado la sesion");
    const bueno = await http("PUT", "/account", { cookie, origen: "http://localhost:5173", body: { name: "QA Seguridad", email: EMAIL } });
    assert.notEqual(bueno.status, 403);
  });

  test("con Bearer no aplica la comprobacion de origen (no es un ataque de cookie)", async () => {
    const login = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    const r = await http("PUT", "/account", { token: login.datos.token, origen: "https://otro.example", body: { name: "QA Seguridad", email: EMAIL } });
    assert.notEqual(r.status, 403);
  });
});

describe("tokens", () => {
  test("rechaza un token firmado con otra clave, sin emisor o con otro algoritmo", async () => {
    const login = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    const { userId } = jwt.decode(login.datos.token);
    const ajeno = jwt.sign({ userId, tv: 0 }, "otra-clave-distinta", { issuer: "animalcare", audience: "animalcare-web" });
    const sinEmisor = jwt.sign({ userId, tv: 0 }, process.env.JWT_SECRET);
    const hs512 = jwt.sign({ userId, tv: 0 }, process.env.JWT_SECRET, { algorithm: "HS512", issuer: "animalcare", audience: "animalcare-web" });
    for (const t of [ajeno, sinEmisor, hs512]) assert.equal((await http("GET", "/auth/me", { token: t })).status, 401);
    assert.equal((await http("GET", "/auth/me", { token: login.datos.token })).status, 200);
  });

  test("rechaza un token con algoritmo none", async () => {
    const base64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const t = `${base64({ alg: "none", typ: "JWT" })}.${base64({ userId: 1, tv: 0, iss: "animalcare", aud: "animalcare-web" })}.`;
    assert.equal((await http("GET", "/auth/me", { token: t })).status, 401);
  });

  test("logout-all invalida todas las sesiones anteriores", async () => {
    const a = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    const b = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    assert.equal((await http("POST", "/auth/logout-all", { token: a.datos.token })).status, 200);
    assert.equal((await http("GET", "/auth/me", { token: a.datos.token })).status, 401);
    assert.equal((await http("GET", "/auth/me", { token: b.datos.token })).status, 401, "la otra sesion tambien");
    const nueva = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    assert.equal((await http("GET", "/auth/me", { token: nueva.datos.token })).status, 200);
  });

  test("cambiar la contrasena cierra las demas sesiones pero conserva la actual", async () => {
    const vieja = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    const actual = await http("POST", "/auth/login", { body: { email: EMAIL, password: CLAVE } });
    const r = await http("PUT", "/account/password", { token: actual.datos.token, body: { currentPassword: CLAVE, newPassword: "NuevaSegura2026" } });
    assert.equal(r.status, 200, JSON.stringify(r.datos));
    assert.equal((await http("GET", "/auth/me", { token: vieja.datos.token })).status, 401);
    assert.ok(cookieDe(r), "entrega una cookie nueva para la sesion actual");
    assert.equal((await http("GET", "/auth/me", { cookie: cookieDe(r) })).status, 200);
    // Se deja la clave original para el resto de las pruebas.
    const volver = await http("PUT", "/account/password", { cookie: cookieDe(r), body: { currentPassword: "NuevaSegura2026", newPassword: CLAVE } });
    assert.equal(volver.status, 200);
  });
});

describe("contrasenas", () => {
  const registro = (password, n) => http("POST", "/auth/register", { body: { name: "Clave Debil", email: `qa.pw.${Date.now()}.${n}@test.com`, password, acceptPrivacy: true } });

  test("rechaza cortas, sin numero, sin letra, comunes y de mas de 72 bytes", async () => {
    const malas = ["Ab1", "sinnumeros", "12345678", "password123", "a1".repeat(40)];
    for (const [i, clave] of malas.entries()) assert.equal((await registro(clave, i)).status, 400, clave);
  });
});

describe("cabeceras y sondeo", () => {
  test("la API responde sin cache, con CSP restrictiva y sin X-Powered-By", async () => {
    const r = await http("GET", "/health");
    assert.equal(r.cabeceras.get("cache-control"), "no-store");
    assert.match(r.cabeceras.get("content-security-policy"), /default-src 'none'/);
    assert.equal(r.cabeceras.get("x-powered-by"), null);
    assert.equal(r.cabeceras.get("x-content-type-options"), "nosniff");
  });

  test("CORS permite credenciales solo al origen autorizado", async () => {
    const bueno = await fetch(`${BASE}/health`, { headers: { Origin: "http://localhost:5173" } });
    assert.equal(bueno.headers.get("access-control-allow-credentials"), "true");
    const malo = await fetch(`${BASE}/health`, { headers: { Origin: "https://otro.example" } });
    assert.equal(malo.headers.get("access-control-allow-origin"), null);
  });

  test("el login no revela si el correo existe (mismo mensaje y codigo)", async () => {
    const noExiste = await http("POST", "/auth/login", { body: { email: "no.existe.qa@test.com", password: "Cualquiera123" } });
    const claveMala = await http("POST", "/auth/login", { body: { email: EMAIL, password: "Cualquiera123" } });
    assert.equal(noExiste.status, 401);
    assert.deepEqual([claveMala.status, claveMala.datos.message], [401, noExiste.datos.message]);
  });
});

describe("todas las rutas privadas exigen sesion", () => {
  test("cada ruta registrada, salvo las publicas conocidas, responde 401 sin sesion", async () => {
    const raiz = path.join(__dirname, "..", "src");
    const app = fs.readFileSync(path.join(raiz, "app.ts"), "utf8");
    const archivo = Object.fromEntries([...app.matchAll(/import (\w+) from "\.\/(modules\/[\w./]+\.routes)";/g)].map((m) => [m[1], m[2]]));
    const prefijos = {};
    for (const m of app.matchAll(/app\.use\("(\/api[^"]*)", (\w+)\);/g)) if (archivo[m[2]]) prefijos[archivo[m[2]]] = m[1];
    prefijos["modules/vets/panel/vetPanel.routes"] = "/api/vets/me";

    const PUBLICAS = new Set([
      "GET /health", "POST /auth/register", "POST /auth/login", "POST /auth/logout",
      "POST /auth/forgot-password", "POST /auth/reset-password", "POST /auth/verify-email",
    ]);
    let comprobadas = 0;
    for (const [rutaArchivo, prefijo] of Object.entries(prefijos)) {
      if (rutaArchivo === "modules/system/docs.routes") continue;
      const texto = fs.readFileSync(path.join(raiz, `${rutaArchivo}.ts`), "utf8");
      for (const m of texto.matchAll(/router\.(get|post|put|patch|delete)\("([^"]*)"/g)) {
        const ruta = `${prefijo}${m[2] === "/" ? "" : m[2]}`.replace(/^\/api/, "").replace(/:\w+/g, "1");
        if (PUBLICAS.has(`${m[1].toUpperCase()} ${ruta}`)) continue;
        const r = await http(m[1].toUpperCase(), ruta, { body: m[1] === "get" || m[1] === "delete" ? undefined : {} });
        assert.equal(r.status, 401, `${m[1].toUpperCase()} ${ruta} debe pedir sesion`);
        comprobadas += 1;
      }
    }
    assert.ok(comprobadas > 50, `solo se comprobaron ${comprobadas} rutas`);
  });
});
