FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix ./server

COPY server ./server
COPY client ./client

EXPOSE 3000

CMD ["npm", "--prefix", "server", "start"]
