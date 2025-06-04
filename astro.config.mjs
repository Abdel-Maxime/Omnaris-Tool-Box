// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import path from "path";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), react()],
  vite: {
    resolve: {
      alias: {
        "@": path.resolve("./src")
      }
    },
    server: {
      fs: {
        // Restrict serving files outside of the project root
        allow: ['.'],
        strict: true
      }
    },
    build: {
      // Improve output minification
      minify: 'terser',
      // Prevent source map generation in production
      sourcemap: false,
      // Terser options for better security
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    }
  }
});
