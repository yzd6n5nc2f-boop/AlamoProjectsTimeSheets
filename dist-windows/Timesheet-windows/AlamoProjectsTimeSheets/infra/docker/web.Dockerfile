FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

RUN npm install

COPY apps ./apps
COPY packages ./packages

RUN npm run build --workspace @timesheet/shared \
  && npm run build --workspace @timesheet/web

EXPOSE 3000

CMD ["npm", "run", "preview", "--workspace", "@timesheet/web", "--", "--host", "0.0.0.0", "--port", "3000"]
