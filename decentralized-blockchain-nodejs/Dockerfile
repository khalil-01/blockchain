# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production || npm install --production
COPY . .
EXPOSE 4001
CMD [ "node", "index.js" ]
