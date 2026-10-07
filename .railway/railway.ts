import { defineRailway, github, postgres, preserve, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const EasyPDV = github("Chanciier/EasyPDV", { checkSuites: false });

  const Postgres = postgres("Postgres", { region: "us-east4-eqdc4a" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const Redis = redis("Redis", { region: "us-east4-eqdc4a" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  Redis.networking = { privateNetworkEndpoint: "redis" };
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 5000 });
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 5000 });
  const _easypdvintermediador = service("@easypdv/intermediador", {
    source: EasyPDV,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "docker/Dockerfile.intermediador", watchPatterns: ["/apps/intermediador/**", "/packages/**"] },
    start: "node dist/main.js",
    replicas: { "us-east4-eqdc4a": 1 },
    networking: { privateNetworkEndpoint: "easypdvintermediador" },
    env: { ADMIN_PANEL_ALLOWED_EMAILS: preserve(), ADMIN_PANEL_ORIGINS: preserve(), BLING_CLIENT_ID: preserve(), BLING_CLIENT_SECRET: preserve(), BLING_DEFAULT_PAYMENT_METHOD_ID: preserve(), BLING_NFCE_AUTO_EMIT: preserve(), BLING_REDIRECT_URI: preserve(), DATABASE_URL: preserve(), ECOMMERCE_API_KEY: preserve(), ECOMMERCE_ORGANIZATION_ID: preserve(), JWT_SECRET: preserve(), PORT: preserve(), REDIS_URL: preserve() },
  });
  const easypdvAdminPanel = service("easypdv-admin-panel", {
    source: EasyPDV,
    build: { buildCommand: "BUILD_TARGET=admin-web pnpm exec turbo run build --filter=@easypdv/pdv-frontend --force", buildEnvironment: "V3", builder: "RAILPACK", watchPatterns: ["/apps/pdv-frontend/**", "/packages/**", "/turbo.json"] },
    start: "pnpm --filter @easypdv/pdv-frontend start",
    replicas: { "us-east4-eqdc4a": 1 },
    env: { NEXT_PUBLIC_BUILD_TARGET: preserve(), NEXT_PUBLIC_INTERMEDIADOR_URL: preserve() },
  });

  return project("celebrated-acceptance", {
    resources: [_easypdvintermediador, easypdvAdminPanel, Postgres, Redis, redisVolume, postgresVolume],
  });
});
