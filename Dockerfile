FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN cd backend && npm ci
RUN cd frontend && npm ci

COPY backend ./backend
COPY frontend ./frontend

RUN cd backend && npm run prisma:generate && npm run build
RUN cd frontend && npm run build
RUN cd backend && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080
ENV FRONTEND_DIST_DIR=/app/frontend/dist

COPY --from=build /app/backend/package*.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/frontend/dist /app/frontend/dist

EXPOSE 8080

CMD ["node", "dist/server.js"]
