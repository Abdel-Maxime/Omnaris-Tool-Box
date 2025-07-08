// scripts/create-i18n-pages.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pages à dupliquer
const pagesToDuplicate = [
  'blog/index.astro',
  'mentions-legales.astro',
  'conditions-utilisation.astro',
  'services.astro'
];

// Créer le dossier en/ s'il n'existe pas
const enDir = path.join(__dirname, '../src/pages/en');
if (!fs.existsSync(enDir)) {
  fs.mkdirSync(enDir, { recursive: true });
}

// Créer le dossier en/blog/ s'il n'existe pas
const enBlogDir = path.join(__dirname, '../src/pages/en/blog');
if (!fs.existsSync(enBlogDir)) {
  fs.mkdirSync(enBlogDir, { recursive: true });
}

// Fonction pour adapter le contenu pour l'anglais
function adaptContentForEnglish(content, filename) {
  // Adapter les imports pour les chemins relatifs
  content = content.replace(/from ['"]\.\.\/(.+)['"]/g, 'from "../../$1"');
  content = content.replace(/from ['"]@\/(.+)['"]/g, 'from "@/$1"');
  
  // Ajouter les imports i18n
  if (!content.includes('useTranslations')) {
    const importStatement = `import { useTranslations } from '${filename.includes('blog') ? '../../../' : '../../'}i18n/utils';\n\nconst lang = 'en';\nconst t = useTranslations(lang);`;
    
    // Insérer après le premier ---
    content = content.replace(/---\n/, `---\n${importStatement}\n`);
  }
  
  // Adapter les liens
  content = content.replace(/href="\//g, 'href="/en/');
  content = content.replace(/href="\/en\/en\//g, 'href="/en/'); // Éviter les doubles en/
  
  return content;
}

// Dupliquer chaque page
pagesToDuplicate.forEach(page => {
  const sourcePath = path.join(__dirname, '../src/pages', page);
  const destPath = path.join(__dirname, '../src/pages/en', page);
  
  if (fs.existsSync(sourcePath)) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    const adaptedContent = adaptContentForEnglish(content, page);
    
    // Créer le dossier parent si nécessaire
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.writeFileSync(destPath, adaptedContent);
    console.log(`✅ Created: ${destPath}`);
  } else {
    console.log(`⚠️  Source not found: ${sourcePath}`);
  }
});

console.log('\n🎉 English pages created successfully!');