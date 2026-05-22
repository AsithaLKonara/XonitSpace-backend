FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

# Copy node_modules and build from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Expose API port
EXPOSE 3001

CMD ["npm", "run", "start:prod"]
