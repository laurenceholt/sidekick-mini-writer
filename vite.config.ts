import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __GIT_SHA__: JSON.stringify(process.env.COMMIT_REF ?? process.env.GIT_COMMIT_REF ?? "local"),
    __GIT_BRANCH__: JSON.stringify(process.env.BRANCH ?? "local"),
    __NETLIFY_DEPLOY_ID__: JSON.stringify(process.env.DEPLOY_ID ?? "local"),
  },
});
