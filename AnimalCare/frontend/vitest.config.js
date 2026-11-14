// Pruebas unitarias y de componentes del frontend (npm run test:unit).
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // JSX sin importar React en cada archivo (runtime automatico).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    // Las pruebas de extremo a extremo (Playwright) van aparte.
    exclude: ["e2e/**", "node_modules/**"],
    // npm run coverage: cuanto de src/ ejecutan las pruebas unitarias (reporte en coverage/).
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/**/*.test.{js,jsx}", "src/test/**", "src/main.jsx"],
      reporter: ["text-summary", "text", "lcov"],
    },
  },
});
