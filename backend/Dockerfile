FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Persist this as a volume in production — it's the entire datastore
# (published/pending updates, dedup index, device tokens). Losing it means
# losing the review queue and re-notifying every device on the next scrape.
VOLUME ["/app/data"]
ENV DATA_DIR=/app/data
ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/index.js"]
