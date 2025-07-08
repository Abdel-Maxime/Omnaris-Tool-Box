// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    summary: z.string().optional(), // ← NOUVEAU : Résumé complet de l'article
    author: z.string().default('Maxime'),
    publishDate: z.date().optional(),
    updatedDate: z.date().optional(), // ← NOUVEAU : Date de mise à jour
    tags: z.array(z.string()).optional(),
    image: z.string().optional(),
    featured: z.boolean().default(false),
    readingTime: z.number().optional(), // ← Calculé automatiquement
    category: z.string().optional(), // ← NOUVEAU : Catégorie
    difficulty: z.enum(['débutant', 'intermédiaire', 'avancé']).default('intermédiaire'), // ← NOUVEAU
  }),
});

export const collections = {
  blog: blogCollection,
};