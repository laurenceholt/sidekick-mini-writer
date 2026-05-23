import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

function gitValue(command: string, fallback: string) {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}

const gitSha = process.env.COMMIT_REF ?? process.env.GIT_COMMIT_REF ?? gitValue("git rev-parse HEAD", "local");
const gitBranch = process.env.BRANCH ?? gitValue("git branch --show-current", "local");
const netlifyId =
  process.env.DEPLOY_ID ??
  process.env.SITE_NAME ??
  (process.env.NETLIFY ? "sidekick-mini-writer" : "local");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __GIT_SHA__: JSON.stringify(gitSha),
    __GIT_BRANCH__: JSON.stringify(gitBranch),
    __NETLIFY_DEPLOY_ID__: JSON.stringify(netlifyId),
  },
});
