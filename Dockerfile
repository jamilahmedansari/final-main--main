FROM node:20-slim

WORKDIR /app

# Install pnpm via corepack
RUN corepack enable

COPY pnpm-lock.yaml package.json ./
RUN pnpm i --frozen-lockfile

COPY . .

EXPOSE 3000
CMD ["pnpm","dev","--","--hostname","0.0.0.0","--port","3000"]
