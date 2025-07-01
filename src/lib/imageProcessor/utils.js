// Utilitaires et helpers pour l'ImageProcessor

/**
 * Fonction de debounce pour optimiser les performances
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Fonction de throttle pour limiter la fréquence d'exécution
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Formate une taille de fichier en unités lisibles
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formate un temps en millisecondes vers un format lisible
 */
export function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Parse un ratio d'aspect (ex: "16/9" -> 1.777...)
 */
export function parseAspectRatio(ratioStr) {
    if (ratioStr === 'free') return NaN;
    const [w, h] = ratioStr.split('/').map(Number);
    return h > 0 ? w / h : 1;
}

/**
 * Génère un nom de fichier intelligent basé sur les traitements
 */
export function generateFileName(originalName, settings, template = null) {
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    let extension = 'webp'; // par défaut
    let suffix = '';

    // Déterminer l'extension
    if (settings.convert?.enabled) {
        extension = settings.convert.format || 'webp';
        if (extension === 'jpeg') extension = 'jpg';
    } else {
        extension = originalName.split('.').pop().toLowerCase();
    }

    // Ajouter le suffix selon le template ou les actions
    if (template) {
        suffix = template.suffix || '';
    } else {
        // Générer un suffix basé sur les actions
        const actions = [];
        if (settings.resize?.enabled) actions.push(`${settings.resize.percent}pct`);
        if (settings.crop?.enabled) actions.push(settings.crop.aspectRatio.replace('/', 'x'));
        if (settings.convert?.enabled) actions.push(extension);
        
        suffix = actions.length > 0 ? `_${actions.join('_')}` : '_optimized';
    }

    // Ajouter les dimensions si disponibles
    let dimensions = '';
    if (settings.crop?.enabled) {
        const ratio = settings.crop.aspectRatio;
        const dimensionMap = {
            '1/1': '_1080x1080',
            '16/9': '_1920x1080',
            '9/16': '_1080x1920',
            '4/3': '_1200x900',
            '3/4': '_900x1200'
        };
        dimensions = dimensionMap[ratio] || '';
    }

    return `${baseName}${suffix}${dimensions}.${extension}`;
}

/**
 * Valide qu'un fichier est une image supportée
 */
export function isValidImageFile(file, supportedTypes) {
    return file && file.type && supportedTypes.includes(file.type);
}

/**
 * Calcule un hash simple d'un fichier pour le cache
 */
export function generateFileHash(file) {
    return `${file.name}-${file.size}-${file.lastModified || Date.now()}`;
}

/**
 * Crée une promise qui peut être annulée
 */
export function makeCancelable(promise) {
    let cancelled = false;

    const wrappedPromise = new Promise((resolve, reject) => {
        promise.then(
            value => cancelled ? reject(new Error('Cancelled')) : resolve(value),
            error => cancelled ? reject(new Error('Cancelled')) : reject(error)
        );
    });

    return {
        promise: wrappedPromise,
        cancel: () => {
            cancelled = true;
        }
    };
}

/**
 * Attend un délai spécifié (pour les tests ou animations)
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clamp une valeur entre min et max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Convertit des degrés en radians
 */
export function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Convertit des radians en degrés
 */
export function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Calcule les dimensions après redimensionnement en conservant le ratio
 */
export function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
        width: Math.round(srcWidth * ratio),
        height: Math.round(srcHeight * ratio),
        scale: ratio
    };
}

/**
 * Détecte si l'appareil est mobile
 */
export function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Détecte si le navigateur supporte WebP
 */
export function supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Détecte si le navigateur supporte AVIF
 */
export function supportsAVIF() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
}

/**
 * Crée un logger avec namespace pour debug
 */
export function createLogger(namespace) {
    return {
        debug: (msg, ...args) => console.debug(`[${namespace}] ${msg}`, ...args),
        info: (msg, ...args) => console.info(`[${namespace}] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[${namespace}] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[${namespace}] ${msg}`, ...args)
    };
}

/**
 * Récupère les informations sur les capacités du navigateur
 */
export function getBrowserCapabilities() {
    return {
        webp: supportsWebP(),
        avif: supportsAVIF(),
        webgl: !!window.WebGLRenderingContext,
        workers: typeof Worker !== 'undefined',
        offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
        imageCapture: 'ImageCapture' in window,
        mobile: isMobileDevice(),
        memory: navigator.deviceMemory || 'unknown',
        cores: navigator.hardwareConcurrency || 'unknown'
    };
}

/**
 * Nettoie une chaîne pour l'utiliser comme nom de fichier
 */
export function sanitizeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
}

/**
 * Convertit un DataURL en Blob
 */
export function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    
    return new Blob([array], { type: mime });
}

/**
 * Lit un fichier comme DataURL
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Lit un fichier comme ArrayBuffer
 */
export function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Crée un canvas de la taille spécifiée
 */
export function createCanvas(width, height, options = {}) {
    let canvas;
    
    if (typeof OffscreenCanvas !== 'undefined' && options.offscreen) {
        canvas = new OffscreenCanvas(width, height);
    } else {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
    }
    
    return canvas;
}

/**
 * Optimise la qualité d'un contexte canvas
 */
export function optimizeCanvasContext(ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return ctx;
}

/**
 * Calcule le score de performance d'une configuration
 */
export function calculatePerformanceScore(settings) {
    let score = 0;
    
    // Points pour la conversion
    if (settings.convert?.enabled) {
        const format = settings.convert.format;
        if (format === 'webp') score += 30;
        else if (format === 'jpeg') score += 20;
        else score += 10;
        
        // Bonus pour la qualité optimisée
        const quality = settings.convert.quality;
        if (quality >= 80 && quality <= 90) score += 15;
        else if (quality >= 70 && quality < 80) score += 10;
    }

    // Points pour le redimensionnement
    if (settings.resize?.enabled) {
        const percent = settings.resize.percent;
        if (percent >= 70 && percent <= 90) score += 25;
        else if (percent >= 50 && percent < 70) score += 20;
        else score += 10;
    }

    // Points pour le recadrage (uniformité)
    if (settings.crop?.enabled) {
        score += 15;
    }

    // Bonus pour combinaison d'optimisations
    const activeOptimizations = [
        settings.resize?.enabled, 
        settings.crop?.enabled, 
        settings.convert?.enabled
    ].filter(Boolean).length;
    
    if (activeOptimizations >= 2) score += 15;

    return Math.min(score, 100);
}

/**
 * Estime les économies potentielles d'un fichier
 */
export function estimateFileSavings(file, settings, compressionFactors) {
    let estimatedSize = file.size;
    const breakdown = { resize: 0, crop: 0, compression: 0 };
    
    try {
        // 1. Estimation redimensionnement
        if (settings.resize?.enabled) {
            const scale = settings.resize.percent / 100;
            const resizeFactor = Math.pow(scale, 2); // Surface = scale²
            const newSizeAfterResize = estimatedSize * resizeFactor;
            breakdown.resize = estimatedSize - newSizeAfterResize;
            estimatedSize = newSizeAfterResize;
        }
        
        // 2. Estimation recadrage
        if (settings.crop?.enabled) {
            const cropFactor = estimateCropFactor(settings.crop.aspectRatio);
            const newSizeAfterCrop = estimatedSize * cropFactor;
            breakdown.crop = estimatedSize - newSizeAfterCrop;
            estimatedSize = newSizeAfterCrop;
        }
        
        // 3. Estimation compression/conversion
        if (settings.convert?.enabled) {
            const compressionFactor = estimateCompressionFactor(file, settings.convert, compressionFactors);
            const newSizeAfterCompression = estimatedSize * compressionFactor;
            breakdown.compression = estimatedSize - newSizeAfterCompression;
            estimatedSize = newSizeAfterCompression;
        }
        
        return {
            estimatedSize: Math.max(estimatedSize, file.size * 0.1), // Minimum 10%
            breakdown
        };
    } catch (error) {
        console.error('Erreur lors de l\'estimation:', error);
        return {
            estimatedSize: file.size,
            breakdown: { resize: 0, crop: 0, compression: 0 }
        };
    }
}

/**
 * Estime le facteur de recadrage
 */
function estimateCropFactor(aspectRatio) {
    if (aspectRatio === 'free') return 0.85;
    
    const cropFactors = {
        '1/1': 0.7,    // Carré depuis rectangle
        '16/9': 0.8,   // Paysage
        '4/3': 0.85,   // Standard
        '3/4': 0.8,    // Portrait
        '9/16': 0.7    // Portrait mobile
    };
    
    return cropFactors[aspectRatio] || 0.8;
}

/**
 * Estime le facteur de compression
 */
function estimateCompressionFactor(file, convertSettings, compressionFactors) {
    const outputFormat = convertSettings.format;
    const quality = convertSettings.quality / 100;
    
    const factors = compressionFactors[outputFormat];
    if (!factors) return 0.9;
    
    // Facteur basé sur le format original
    let baseFactor = factors.base;
    
    // Ajustement selon le format source
    const sourceFormat = file.type.split('/')[1];
    if (sourceFormat === 'png' && outputFormat !== 'png') {
        baseFactor *= 0.6; // PNG vers format compressé = grosse économie
    } else if (sourceFormat === 'jpeg' && outputFormat === 'webp') {
        baseFactor *= 0.8; // JPEG vers WebP = économie modérée
    }
    
    // Ajustement selon la qualité
    const qualityFactor = factors.base + (factors.quality * quality);
    
    return Math.min(baseFactor * qualityFactor, 0.95);
}