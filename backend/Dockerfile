FROM node:20-alpine

# mariadb-client provides `mariadb-dump` used by /api/backup/run.
RUN apk add --no-cache mariadb-client

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /backups

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
