# @feature [F00] Nền tảng - Image Docker dùng chung cho Client và Admin (rubric TC2.6).
# Build từ thư mục gốc của repo, chọn ứng dụng bằng APP:
#   docker build -f frontend.Dockerfile --build-arg APP=client -t techstore-client .
#   docker build -f frontend.Dockerfile --build-arg APP=admin  -t techstore-admin .
FROM node:22-bookworm-slim AS build
ARG APP=client
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY client/package.json client/
COPY admin/package.json admin/
RUN npm ci --ignore-scripts
COPY shared ./shared
COPY ${APP} ./${APP}
RUN npm run build -w ${APP}

# nginx phục vụ file tĩnh, trả index.html cho mọi đường dẫn của React Router, và chuyển /api, /uploads sang backend
# nên trình duyệt chỉ gặp một địa chỉ (không cần CORS). BACKEND_URL được thay vào mẫu cấu hình khi container khởi động.
FROM nginx:1.27-alpine AS runtime
ARG APP=client
ENV BACKEND_URL=http://backend:4000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/${APP}/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
