FROM node:20-alpine

WORKDIR /app/server

COPY server/package*.json ./
RUN npm install

COPY server ./
COPY client ../client

EXPOSE 3000

CMD ["npm", "start"]

