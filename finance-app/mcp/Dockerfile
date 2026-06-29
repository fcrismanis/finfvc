FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
EXPOSE 3010
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3010
CMD ["node", "dist/index.js"]
