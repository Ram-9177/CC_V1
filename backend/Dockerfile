FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install build tools for native modules like bcrypt
RUN apk add --no-cache python3 make g++
RUN npm ci --production=false --legacy-peer-deps
COPY . .
# Rebuild bcrypt against musl (alpine)
RUN npm rebuild bcrypt --build-from-source
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
