// Configuration centrale de l'ImageProcessor
export const CONFIG = {
    // Limites de fichiers
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB par fichier
    MAX_TOTAL_SIZE: 200 * 1024 * 1024, // 200MB total
    MAX_DIMENSION: 4096, // Dimension max pour éviter les problèmes de mémoire
    CHUNK_SIZE: 5, // Nombre d'images à traiter en parallèle
    
    // Facteurs de compression pour les estimations
    COMPRESSION_FACTORS: {
        webp: { base: 0.7, quality: 0.3 },
        jpeg: { base: 0.8, quality: 0.4 },
        png: { base: 0.9, quality: 0.1 }
    },
    
    // Facteur CO2 : 1MB = ~0.5g CO2 pour le transfert réseau
    CO2_FACTOR_PER_MB: 0.5,

    // Templates prédéfinis (corrigé)
    TEMPLATES: {
        ecommerce: {
            name: 'E-commerce',
            resize: { enabled: true, percent: 80 },
            crop: { enabled: true, aspectRatio: '1/1', position: 'center' },
            convert: { enabled: true, format: 'webp', quality: 85 },
            suffix: '_ecommerce'
        },
        instagram: {
            name: 'Instagram',
            resize: { enabled: false },
            crop: { enabled: true, aspectRatio: '1/1', position: 'center' },
            convert: { enabled: true, format: 'webp', quality: 90 },
            suffix: '_instagram',
            multiFormat: [
                { aspectRatio: '1/1', suffix: '_post' },
                { aspectRatio: '9/16', suffix: '_story' }
            ]
        },
        linkedin: {
            name: 'LinkedIn',
            resize: { enabled: true, percent: 90 },
            crop: { enabled: true, aspectRatio: '16/9', position: 'center' },
            convert: { enabled: true, format: 'webp', quality: 90 },
            suffix: '_linkedin'
        },
        web: {
            name: 'Web',
            resize: { enabled: false }, // Pas de redimensionnement
            crop: { enabled: false },   // Pas de recadrage  
            convert: { enabled: true, format: 'webp', quality: 80 }, // Seule la conversion
            suffix: '_web'
        }
    },

    // Validation des types de fichiers
    SUPPORTED_MIME_TYPES: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
        'image/tiff',
        'image/bmp',
        'image/svg+xml'
    ],

    // Messages d'erreur
    ERROR_MESSAGES: {
        FILE_TOO_LARGE: 'Le fichier dépasse la taille maximale autorisée',
        INVALID_FILE_TYPE: 'Format de fichier non supporté',
        TOTAL_SIZE_EXCEEDED: 'La taille totale des fichiers dépasse la limite',
        PROCESSING_ERROR: 'Erreur lors du traitement de l\'image',
        CANVAS_ERROR: 'Impossible de créer le contexte canvas',
        CROPPER_ERROR: 'Erreur lors de l\'initialisation du recadrage'
    },

    // Paramètres UI
    UI: {
        DEBOUNCE_DELAY: 300, // ms pour debouncer les événements
        MESSAGE_DISPLAY_TIME: 3000, // ms d'affichage des messages
        SCROLL_OFFSET: 100, // px pour compenser la navbar
        ANIMATION_DURATION: 300 // ms pour les animations
    }
};

// Validation de la configuration
export function validateConfig() {
    const errors = [];
    
    if (CONFIG.MAX_FILE_SIZE <= 0) {
        errors.push('MAX_FILE_SIZE doit être positif');
    }
    
    if (CONFIG.CHUNK_SIZE <= 0) {
        errors.push('CHUNK_SIZE doit être positif');
    }
    
    if (!CONFIG.TEMPLATES || Object.keys(CONFIG.TEMPLATES).length === 0) {
        errors.push('Au moins un template doit être défini');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}