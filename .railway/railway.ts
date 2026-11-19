import { defineRailway, github, preserve, project, service } from "railway/iac";

export const partial = "glyphfern";

const REPOSITORY = "nhhoang4075/glyphfern";
const REGION = "asia-southeast1-eqsg3a";
const WEB_DOMAIN = "glyphfern.nguyenhuyhoang.work";
const API_PORT = 8080;
const TTS_PORT = 8788;
const WEB_PORT = 8080;
const SHARED_WATCH = [
  "package.json",
  "bun.lock",
  "tsconfig.base.json",
  ".dockerignore",
  ".railway/**",
];

export default defineRailway(() => {
  const tts = service("tts", {
    source: github(REPOSITORY, { branch: "main", checkSuites: false, rootDirectory: "apps/tts" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["apps/tts/**", ".railway/**"],
    },
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 120,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    variables: { TTS_PORT: String(TTS_PORT) },
    replicas: { [REGION]: 1 },
  });

  const api = service("api", {
    source: github(REPOSITORY, { branch: "main", checkSuites: false }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/api/Dockerfile",
      watchPatterns: ["apps/api/**", ...SHARED_WATCH],
    },
    deploy: {
      preDeployCommand: ["bun", "src/migrate.ts"],
      healthcheckPath: "/health",
      healthcheckTimeout: 60,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    variables: {
      PORT: String(API_PORT),
      DATABASE_URL: "${{Postgres.DATABASE_URL}}",
      ALLOWED_ORIGIN: `https://${WEB_DOMAIN}`,
      TRUST_PROXY: "1",
      TTS_URL: `http://\${{tts.RAILWAY_PRIVATE_DOMAIN}}:${TTS_PORT}`,
      CLOUDFLARE_ACCOUNT_ID: preserve(),
      CLOUDFLARE_API_TOKEN: preserve(),
    },
    replicas: { [REGION]: 1 },
  });

  const web = service("web", {
    source: github(REPOSITORY, { branch: "main", checkSuites: false }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/web/Dockerfile",
      watchPatterns: ["apps/web/**", "packages/**", ...SHARED_WATCH],
    },
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 60,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    variables: {
      PORT: String(WEB_PORT),
      API_ORIGIN: `http://\${{api.RAILWAY_PRIVATE_DOMAIN}}:${API_PORT}`,
      VITE_API_URL: "/api",
    },
    replicas: { [REGION]: 1 },
  });

  return project("glyphfern", {
    resources: [tts, api, web],
  });
});
