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
COPY db ./db

RUN npm run build --workspace @timesheet/shared \
  && npm run build --workspace @timesheet/api

EXPOSE 8080

CMD ["npm", "run", "start", "--workspace", "@timesheet/api"]
