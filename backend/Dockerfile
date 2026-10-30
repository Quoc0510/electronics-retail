# @feature [F00] Nền tảng - Image Docker của backend (rubric TC2.6: đóng gói và triển khai).
# Build từ THƯ MỤC GỐC của repo vì dự án dùng npm workspaces (một package-lock.json chung):
#   docker build -f backend/Dockerfile -t techstore-backend .
FROM node:22-bookworm-slim AS base
WORKDIR /app
# Prisma cần OpenSSL để nói chuyện với PostgreSQL
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Chặng 1: chỉ cài thư viện của backend (copy riêng các package.json để lớp này được cache khi code đổi)
FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY client/package.json client/
COPY admin/package.json admin/
RUN npm ci -w backend --ignore-scripts

# Chặng 2: image chạy thật
FROM base AS runtime
ENV NODE_ENV=production \
  PORT=4000 \
  UPLOAD_DIR=/data/uploads
COPY --from=deps /app/node_modules ./node_modules
COPY backend ./backend
RUN npx prisma generate --schema backend/prisma/schema.prisma \
  && mkdir -p /data/uploads \
  && chown -R node:node /data /app
USER node
EXPOSE 4000
# Dùng /api/health (server sống). /api/health/ready kiểm tra thêm kết nối database
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Áp migration trước khi nhận request; migration lỗi thì container dừng ngay thay vì chạy với CSDL sai
CMD ["sh", "-c", "npx prisma migrate deploy --schema backend/prisma/schema.prisma && node backend/src/server.js"]
