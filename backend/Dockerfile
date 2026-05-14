FROM node:18-slim

WORKDIR /app

# Install only backend dependencies by copying backend package files
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source into container root and run server from there
COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
