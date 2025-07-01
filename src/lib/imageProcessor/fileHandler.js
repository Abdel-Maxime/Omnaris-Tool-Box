// Gestionnaire de fichiers et validation
import { CONFIG } from './config.js';
import { isValidImageFile, generateFileHash, readFileAsDataURL } from './utils.js';

export class FileHandler {
    constructor(domManager, resourceManager) {
        this.dom = domManager;
        this.resources = resourceManager;
        this.preloadedImages = new Map();
        this.validationCache = new Map();
        
        // Types MIME supportés
        this.supportedTypes = [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/tiff',
            'image/bmp',
            'image/svg+xml'
        ];
        
        console.log('📁 FileHandler initialisé');
    }

    /**
     * Valide un ensemble de fichiers
     */
    async validateFiles(files) {
        const validFiles = [];
        let totalSize = 0;
        const errors = [];

        for (const file of files) {
            try {
                // Vérification du type de fichier
                if (!this.isValidImageType(file)) {
                    errors.push({
                        file: file.name,
                        error: 'Type de fichier non supporté'
                    });
                    continue;
                }

                // Vérification de la taille individuelle
                if (file.size > CONFIG.MAX_FILE_SIZE) {
                    errors.push({
                        file: file.name,
                        error: 'Fichier trop volumineux (max 50MB)'
                    });
                    continue;
                }

                // Vérification de la taille totale
                if (totalSize + file.size > CONFIG.MAX_TOTAL_SIZE) {
                    errors.push({
                        file: file.name,
                        error: 'Taille totale dépassée (max 200MB)'
                    });
                    break;
                }

                // Validation avancée (corrompu, etc.)
                const isValid = await this.validateImageFile(file);
                if (!isValid) {
                    errors.push({
                        file: file.name,
                        error: 'Fichier image corrompu ou illisible'
                    });
                    continue;
                }

                validFiles.push(file);
                totalSize += file.size;

            } catch (error) {
                errors.push({
                    file: file.name,
                    error: error.message
                });
            }
        }

        // Afficher les erreurs si nécessaire
        if (errors.length > 0) {
            this.reportValidationErrors(errors);
        }

        console.log(`✅ ${validFiles.length}/${files.length} fichiers validés`);
        return validFiles;
    }

    /**
     * Vérifie si un fichier est un type d'image supporté
     */
    isValidImageType(file) {
        return this.supportedTypes.includes(file.type);
    }

    /**
     * Validation avancée d'un fichier image
     */
    async validateImageFile(file) {
        const fileHash = generateFileHash(file);
        
        // Vérifier le cache de validation
        if (this.validationCache.has(fileHash)) {
            return this.validationCache.get(fileHash);
        }

        try {
            // Essayer de charger l'image pour vérifier qu'elle n'est pas corrompue
            const isValid = await this.canLoadImage(file);
            this.validationCache.set(fileHash, isValid);
            return isValid;
        } catch (error) {
            console.warn(`⚠️ Erreur validation ${file.name}:`, error);
            this.validationCache.set(fileHash, false);
            return false;
        }
    }

    /**
     * Teste si une image peut être chargée
     */
    canLoadImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = this.resources.createObjectURL(file);
            
            const cleanup = () => {
                this.resources.revokeObjectURL(objectUrl);
            };

            img.onload = () => {
                cleanup();
                resolve(true);
            };

            img.onerror = () => {
                cleanup();
                resolve(false);
            };

            // Timeout de sécurité
            setTimeout(() => {
                cleanup();
                resolve(false);
            }, 5000);

            img.src = objectUrl;
        });
    }

    /**
     * Précharge la première image pour l'aperçu crop
     */
    async preloadFirstImage(file) {
        const fileHash = generateFileHash(file);
        
        // Vérifier si déjà préchargée
        if (this.preloadedImages.has(fileHash)) {
            return this.preloadedImages.get(fileHash);
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            const preloadedData = {
                file: file,
                dataUrl: dataUrl,
                hash: fileHash,
                timestamp: Date.now()
            };

            this.preloadedImages.set(fileHash, preloadedData);
            
            // Nettoyer les anciennes précharges (garder max 3)
            this.cleanupPreloadedImages();
            
            console.log(`📷 Image préchargée: ${file.name}`);
            return preloadedData;

        } catch (error) {
            console.error(`❌ Erreur préchargement ${file.name}:`, error);
            throw new Error(`Impossible de précharger l'image: ${file.name}`);
        }
    }

    /**
     * Nettoie les images préchargées anciennes
     */
    cleanupPreloadedImages() {
        const entries = Array.from(this.preloadedImages.entries());
        if (entries.length <= 3) return;

        // Trier par timestamp et garder seulement les 3 plus récentes
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        // Supprimer les plus anciennes
        for (let i = 3; i < entries.length; i++) {
            this.preloadedImages.delete(entries[i][0]);
        }
    }

    /**
     * Récupère les informations détaillées sur les fichiers
     */
    analyzeFiles(files) {
        const analysis = {
            totalSize: 0,
            averageSize: 0,
            fileTypes: {},
            largestFile: null,
            smallestFile: null,
            potentialIssues: []
        };

        if (files.length === 0) return analysis;

        files.forEach(file => {
            analysis.totalSize += file.size;
            
            // Compter les types
            const type = file.type.split('/')[1] || 'unknown';
            analysis.fileTypes[type] = (analysis.fileTypes[type] || 0) + 1;
            
            // Plus grand/petit fichier
            if (!analysis.largestFile || file.size > analysis.largestFile.size) {
                analysis.largestFile = file;
            }
            if (!analysis.smallestFile || file.size < analysis.smallestFile.size) {
                analysis.smallestFile = file;
            }
            
            // Détection d'issues potentielles
            if (file.size > 10 * 1024 * 1024) { // > 10MB
                analysis.potentialIssues.push({
                    type: 'large_file',
                    file: file.name,
                    message: 'Fichier volumineux qui peut ralentir le traitement'
                });
            }
            
            if (file.type === 'image/gif') {
                analysis.potentialIssues.push({
                    type: 'animated_gif',
                    file: file.name,
                    message: 'GIF animé - seule la première frame sera traitée'
                });
            }
        });

        analysis.averageSize = analysis.totalSize / files.length;
        
        return analysis;
    }

    /**
     * Génère des recommandations basées sur l'analyse des fichiers
     */
    generateFileRecommendations(files) {
        const analysis = this.analyzeFiles(files);
        const recommendations = [];

        // Recommandations basées sur les types de fichiers
        if (analysis.fileTypes.png > 0) {
            recommendations.push({
                priority: 'high',
                type: 'format_optimization',
                message: `${analysis.fileTypes.png} fichier(s) PNG détecté(s). Conversion en WebP recommandée pour réduire la taille.`
            });
        }

        if (analysis.fileTypes.bmp > 0) {
            recommendations.push({
                priority: 'high',
                type: 'format_optimization',
                message: `${analysis.fileTypes.bmp} fichier(s) BMP détecté(s). Format très volumineux, conversion recommandée.`
            });
        }

        // Recommandations basées sur la taille
        if (analysis.averageSize > 5 * 1024 * 1024) { // > 5MB en moyenne
            recommendations.push({
                priority: 'medium',
                type: 'size_optimization',
                message: 'Fichiers volumineux détectés. Redimensionnement recommandé pour optimiser les performances.'
            });
        }

        // Recommandations de performance
        if (files.length > 20) {
            recommendations.push({
                priority: 'medium',
                type: 'performance',
                message: `${files.length} fichiers sélectionnés. Le traitement peut prendre plusieurs minutes.`
            });
        }

        return recommendations;
    }

    /**
     * Signale les erreurs de validation
     */
    reportValidationErrors(errors) {
        console.group('⚠️ Erreurs de validation des fichiers');
        errors.forEach(error => {
            console.warn(`${error.file}: ${error.error}`);
        });
        console.groupEnd();

        // Afficher un message utilisateur si possible
        if (this.dom.get('messageContainer')) {
            const errorCount = errors.length;
            const message = errorCount === 1 
                ? '1 fichier rejeté lors de la validation'
                : `${errorCount} fichiers rejetés lors de la validation`;
            
            // Ici on pourrait appeler une méthode UI pour afficher le message
            // this.ui.showMessage(message, 'warning');
        }
    }

    /**
     * Nettoie les ressources du gestionnaire
     */
    cleanup() {
        this.preloadedImages.clear();
        this.validationCache.clear();
        console.log('🧹 FileHandler nettoyé');
    }

    /**
     * Récupère des statistiques sur le gestionnaire de fichiers
     */
    getStats() {
        return {
            preloadedImages: this.preloadedImages.size,
            validationCache: this.validationCache.size,
            supportedTypes: this.supportedTypes.length
        };
    }
}