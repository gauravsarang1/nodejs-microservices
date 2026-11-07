
FROM node:22-bookworm-slim

WORKDIR /app

# Copy root dependency manifests
COPY package.json package-lock.json ./

# Copy workspace directories
# Required before npm ci because npm uses workspaces
COPY apps ./apps
COPY packages ./packages

# Copy migration and shared configuration
COPY scripts ./scripts
COPY sql ./sql
COPY tsconfig.base.json ./

# Install dependencies for all workspaces
RUN npm ci

# Copy remaining project files
COPY . .

ENV NODE_ENV=development

EXPOSE 3000 3001 3002 3003 3004

CMD ["npm", "run", "dev:gateway"]
