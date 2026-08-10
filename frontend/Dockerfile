# ---------------------------------------------------------
# Stage 1: Build the React (Vite) app
# ---------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build
COPY . .
RUN npm run build

# ---------------------------------------------------------
# Stage 2: Serve the built app with nginx
# ---------------------------------------------------------
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build output from stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Use your repo's own nginx.conf (already present in your project)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Must match the "listen" port inside nginx.conf (5378)
EXPOSE 5378

CMD ["nginx", "-g", "daemon off;"]
