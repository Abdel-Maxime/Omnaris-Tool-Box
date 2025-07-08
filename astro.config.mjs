// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import path from "path";

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind(), // Pas besoin de configurer les plugins ici
    react()
  ],
  vite: {
    resolve: {
      alias: {
        "@": path.resolve("./src")
      }
    },
    server: {
      fs: {
        allow: ['.'],
        strict: true
      }
    },
    build: {
      minify: 'terser',
      sourcemap: false,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    }
  }
});