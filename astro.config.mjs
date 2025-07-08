// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import sitemap from '@astrojs/sitemap';
import path from "path";

// https://astro.build/config
export default defineConfig({
  site: 'https://toolbox.omnaris.fr',
  integrations: [
    tailwind(),
    react(),
    sitemap({
      i18n: {
        defaultLocale: 'fr',
        locales: {
          fr: 'fr-FR',
          en: 'en-US',
        },
      },
      // Fonction pour filtrer et personnaliser les URLs
      filter: (page) => {
        // Exclure certaines pages si nécessaire
        return !page.includes('admin');
      },
      customPages: [
        'https://toolbox.omnaris.fr/',
        'https://toolbox.omnaris.fr/en/',
        'https://toolbox.omnaris.fr/blog/',
        'https://toolbox.omnaris.fr/en/blog/',
      ],
    }),
  ],
  i18n: {
    defaultLocale: "fr",
    locales: ["fr", "en"],
    routing: {
      prefixDefaultLocale: false
    }
  },
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