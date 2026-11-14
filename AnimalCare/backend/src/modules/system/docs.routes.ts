import { RAIZ_BACKEND } from "../../utils/raiz";
import type { Request, Response } from "express";
// Documentacion de la API (Swagger UI) en /api/docs. Los archivos de la interfaz vienen del paquete
// swagger-ui-dist, asi que funciona sin conexion a internet.
import express from "express";
import path from "node:path";

const router = express.Router();

router.get("/openapi.json", (req: Request, res: Response) => res.sendFile(path.join(RAIZ_BACKEND, "openapi.json")));
router.use("/assets", express.static(require("swagger-ui-dist").getAbsoluteFSPath(), { index: false }));

router.get("/", (req: Request, res: Response) => {
  res.type("html").send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>AnimalCare API</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: "/api/docs/openapi.json", dom_id: "#swagger", persistAuthorization: true });
    </script>
  </body>
</html>`);
});

export default router;
