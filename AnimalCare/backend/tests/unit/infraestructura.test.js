// Pruebas unitarias de utilidades y middleware: parametros, errores, estados de cuenta, archivos subidos,
// limite de intentos, cabeceras de seguridad y permisos por rol. No usan base de datos ni servidor.
const { describe, test, mock, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parseId } = require("../../src/utils/params");
const { esErrorPrisma, datosDeError, mensajeDe } = require("../../src/utils/errores");
const { PRIVACY_VERSION } = require("../../src/utils/privacidad");
const { RAIZ_BACKEND } = require("../../src/utils/raiz");
const { isBlocked, blockedResponse } = require("../../src/utils/accountStatus");
const { parseDataUrl, cleanFileName } = require("../../src/utils/uploads");
const { createRateLimit, securityHeaders } = require("../../src/middleware/security.middleware");
const { requireRole } = require("../../src/middleware/role.middleware");

// Respuesta falsa de Express que recuerda lo que se le pidio.
function respuestaFalsa() {
  const res = { cabeceras: {}, estado: 200, cuerpo: undefined };
  res.setHeader = (k, v) => {
    res.cabeceras[k.toLowerCase()] = v;
    return res;
  };
  res.status = (codigo) => {
    res.estado = codigo;
    return res;
  };
  res.json = (cuerpo) => {
    res.cuerpo = cuerpo;
    return res;
  };
  return res;
}

describe("parseId", () => {
  test("solo enteros positivos; todo lo demas es null", () => {
    assert.equal(parseId("12"), 12);
    assert.equal(parseId("007"), 7);
    for (const mal of ["0", "-1", "1.5", "abc", "", "12abc", undefined, null, " "]) assert.equal(parseId(mal), null, String(mal));
  });
});

describe("errores", () => {
  test("esErrorPrisma reconoce un error con codigo", () => {
    assert.equal(esErrorPrisma({ code: "P2002", meta: {} }), true);
    for (const no of [null, undefined, "x", 3, {}, { code: 5 }, new Error("x")]) assert.equal(esErrorPrisma(no), false);
  });

  test("datosDeError y mensajeDe toleran cualquier valor", () => {
    assert.deepEqual(datosDeError({ type: "entity.too.large", status: 413 }), { type: "entity.too.large", status: 413 });
    assert.deepEqual(datosDeError(null), {});
    assert.deepEqual(datosDeError("texto"), {});
    assert.equal(mensajeDe(new Error("falló")), "falló");
    assert.equal(mensajeDe("a"), "a");
    assert.equal(mensajeDe(undefined), "undefined");
  });
});

describe("constantes del proyecto", () => {
  test("la version de la politica es una fecha y la raiz del backend tiene package.json", () => {
    assert.match(PRIVACY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(fs.existsSync(path.join(RAIZ_BACKEND, "package.json")));
  });
});

describe("estado de la cuenta", () => {
  test("suspendida, rechazada y eliminada estan bloqueadas; activa y pendiente no", () => {
    for (const s of ["SUSPENDED", "REJECTED", "DELETED"]) assert.equal(isBlocked(s), true, s);
    for (const s of ["ACTIVE", "PENDING"]) assert.equal(isBlocked(s), false, s);
  });

  test("la respuesta de bloqueo es 403 con el codigo que usa el frontend para cerrar la sesion", () => {
    const res = respuestaFalsa();
    blockedResponse(res, "SUSPENDED");
    assert.equal(res.estado, 403);
    assert.equal(res.cuerpo.code, "ACCOUNT_BLOCKED");
    assert.equal(res.cuerpo.status, "SUSPENDED");
    assert.match(res.cuerpo.message, /suspendida/);
  });
});

describe("parseDataUrl y cleanFileName (archivos subidos)", () => {
  const dataUrl = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
  const PDF = Buffer.from("%PDF-1.4 contenido");
  const opciones = { tipos: ["image/png", "application/pdf"], maxBytes: 1024 };

  test("acepta un archivo cuyo contenido coincide con su tipo", () => {
    const png = parseDataUrl(dataUrl("image/png", PNG), opciones);
    assert.equal(png.error, undefined);
    assert.deepEqual([png.mime, png.extension], ["image/png", "png"]);
    const pdf = parseDataUrl(dataUrl("application/pdf", PDF), opciones);
    assert.equal(pdf.mime, "application/pdf");
    assert.ok(Buffer.isBuffer(pdf.buffer));
  });

  test("rechaza formato invalido, tipo no permitido, vacio, demasiado grande y contenido falso", () => {
    assert.match(parseDataUrl("no es un data url", opciones).error, /no es válido/);
    assert.match(parseDataUrl(null, opciones).error, /no es válido/);
    assert.match(parseDataUrl(dataUrl("image/gif", [1, 2, 3]), opciones).error, /Formato no permitido/);
    assert.match(parseDataUrl("data:image/png;base64,AAAA", { ...opciones, maxBytes: 1 }).error, /pesar más de/);
    // Dice ser PNG pero es un PDF: no se acepta (evita subir un archivo disfrazado).
    assert.match(parseDataUrl(dataUrl("image/png", PDF), opciones).error, /no coincide/);
  });

  test("cleanFileName quita rutas y caracteres peligrosos, y pone un nombre por defecto", () => {
    assert.equal(cleanFileName("C:\\Users\\x\\examen.pdf", "pdf"), "examen.pdf");
    assert.equal(cleanFileName("../../etc/passwd", "pdf"), "passwd");
    assert.equal(cleanFileName('a<b>"c|d?.png', "png"), "abcd.png");
    assert.equal(cleanFileName("", "jpg"), "adjunto.jpg");
    assert.equal(cleanFileName("..", "pdf"), "adjunto.pdf");
    assert.equal(cleanFileName(undefined, "png"), "adjunto.png");
    const largo = cleanFileName(`${"x".repeat(200)}.pdf`, "pdf");
    assert.equal(largo.length, 100);
    assert.ok(largo.endsWith(".pdf"), "conserva la extension al recortar");
  });
});

describe("createRateLimit (limite de intentos)", () => {
  afterEach(() => mock.timers.reset());

  function limite(max = 3, windowMs = 60_000) {
    return createRateLimit({ max, windowMs, keyFrom: (req) => req.clave });
  }
  // Ejecuta el middleware y devuelve { siguio, res, req }.
  function pasar(mw, clave) {
    const req = { clave };
    const res = respuestaFalsa();
    let siguio = false;
    mw(req, res, () => {
      siguio = true;
    });
    return { siguio, res, req };
  }

  test("deja pasar hasta el maximo de fallos y despues responde 429 con Retry-After", () => {
    const mw = limite(3);
    for (let i = 0; i < 3; i += 1) {
      const { siguio, req } = pasar(mw, "a");
      assert.equal(siguio, true);
      req.rateLimit.fail();
    }
    const bloqueado = pasar(mw, "a");
    assert.equal(bloqueado.siguio, false);
    assert.equal(bloqueado.res.estado, 429);
    assert.match(bloqueado.res.cuerpo.message, /Demasiados intentos/);
    assert.ok(Number(bloqueado.res.cabeceras["retry-after"]) > 0);
  });

  test("reset borra los fallos (un inicio de sesion correcto) y las claves son independientes", () => {
    const mw = limite(2);
    for (let i = 0; i < 2; i += 1) pasar(mw, "a").req.rateLimit.fail();
    assert.equal(pasar(mw, "a").siguio, false);
    assert.equal(pasar(mw, "b").siguio, true, "otra clave no esta bloqueada");

    mw.clear();
    assert.equal(pasar(mw, "a").siguio, true);
    pasar(mw, "c").req.rateLimit.fail();
    const { req } = pasar(mw, "c");
    req.rateLimit.reset();
    pasar(mw, "c").req.rateLimit.fail();
    assert.equal(pasar(mw, "c").siguio, true, "tras reset solo cuenta el fallo nuevo");
  });

  test("el bloqueo termina cuando pasa la ventana de tiempo", () => {
    mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    const mw = limite(2, 60_000);
    for (let i = 0; i < 2; i += 1) pasar(mw, "a").req.rateLimit.fail();
    assert.equal(pasar(mw, "a").siguio, false);
    mock.timers.tick(59_000);
    assert.equal(pasar(mw, "a").siguio, false, "todavia bloqueado");
    mock.timers.tick(2_000);
    assert.equal(pasar(mw, "a").siguio, true, "ya paso la ventana");
  });
});

describe("securityHeaders y requireRole", () => {
  test("agrega las cabeceras de seguridad y sigue", () => {
    const res = respuestaFalsa();
    let siguio = false;
    securityHeaders({ headers: {} }, res, () => {
      siguio = true;
    });
    assert.equal(siguio, true);
    assert.equal(res.cabeceras["x-content-type-options"], "nosniff");
    assert.equal(res.cabeceras["x-frame-options"], "DENY");
    assert.equal(res.cabeceras["strict-transport-security"], undefined, "sin HTTPS no se fuerza HSTS");
  });

  test("detras de un proxy HTTPS agrega HSTS", () => {
    const res = respuestaFalsa();
    securityHeaders({ headers: { "x-forwarded-proto": "https" } }, res, () => {});
    assert.match(res.cabeceras["strict-transport-security"], /max-age=\d+/);
  });

  test("requireRole deja pasar a los roles indicados y responde 403 a los demas", () => {
    const mw = requireRole("VETERINARIAN", "ADMIN");
    for (const [rol, pasa] of [["VETERINARIAN", true], ["ADMIN", true], ["CLIENT", false]]) {
      const res = respuestaFalsa();
      let siguio = false;
      mw({ user: { role: rol } }, res, () => {
        siguio = true;
      });
      assert.equal(siguio, pasa, rol);
      if (!pasa) assert.equal(res.estado, 403);
    }
  });
});
