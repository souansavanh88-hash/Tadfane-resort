FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build web assets
COPY . .
RUN npm run build

# Create directory for persistent data & backups
RUN mkdir -p /app/server/data/backups

# Volume for persistent storage
VOLUME ["/app/server/data"]

EXPOSE 8080

CMD ["node", "server/index.js"]
