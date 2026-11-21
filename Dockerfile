FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY tsconfig.json ./
COPY src ./src

RUN pnpm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --prod

COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 4000

CMD ["node", "dist/server.js"]
