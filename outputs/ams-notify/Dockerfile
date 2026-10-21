FROM node:24-alpine
ENV NODE_ENV=production TZ=Asia/Shanghai NODE_NO_WARNINGS=1
WORKDIR /app
COPY package.json ./
COPY src ./src
# Activation worker sources staged from outputs/ams-activation-tencent by work/deploy-ams-service.ps1
COPY activation ./activation
USER node
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/api/notify/health || exit 1
CMD ["node","src/main.mjs"]