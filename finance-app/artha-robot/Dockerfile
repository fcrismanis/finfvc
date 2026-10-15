FROM mcr.microsoft.com/playwright:v1.49.1-jammy
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY artha-export.mjs ./
ENV OUT_DIR=/data
CMD ["node", "artha-export.mjs"]
