# Etapa 1: compila TypeScript (necesita las dependencias de desarrollo)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

# Etapa 2: imagen final, solo con dependencias de produccion
FROM node:22-alpine
WORKDIR /app

# Dependencias de produccion (prisma CLI va en devDependencies: se instala aparte
# para poder aplicar las migraciones al arrancar).
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm install --no-save prisma@6 --no-audit --no-fund

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=build /app/dist ./dist
COPY openapi.json ./

# Fotos, tarjetas profesionales y adjuntos medicos: se montan como volumen en docker-compose.
RUN mkdir -p uploads/photos uploads/docs uploads/records

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Aplica las migraciones pendientes y arranca la API compilada.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
