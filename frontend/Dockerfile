# ---------------------------------------------------------
# Standalone frontend-only Dockerfile (nginx static serving)
#
# NOTE: The production deployment uses the ROOT Dockerfile
# (multi-stage: frontend build + Python runtime + nginx +
# supervisord) which has access to nginx.conf at the repo
# root. This file is provided for standalone frontend
# testing where only the React app is needed.
#
#   docker build -t novex-frontend ./frontend
#   docker run -p 5378:5378 novex-frontend
#
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

# Remove default nginx static assets and config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy build output from stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Inline nginx config — serves the SPA with fallback routing.
# Unlike the root nginx.conf, this does NOT proxy /api or /docs
# (there is no backend in a frontend-only container). Point the
# frontend at an external API via VITE_API_BASE_URL instead.
RUN printf 'server {\n\
    listen 5378;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Must match the "listen" port inside the config (5378)
EXPOSE 5378

CMD ["nginx", "-g", "daemon off;"]
