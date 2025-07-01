// Gestionnaire de ressources et mémoire
export class ResourceManager {
    constructor() {
        this.objectURLs = new Set();
        this.imageCache = new Map();
        this.memoryWatcher = null;
        this.maxCacheSize = 50; // Nombre max d'images en cache
        this.initialized = false;
    }

    /**
     * Initialise le gestionnaire de ressources
     */
    initialize() {
        this.setupMemoryWatcher();
        this.initialized = true;
        console.log('✅ Resource Manager initialisé');
    }

    /**
     * Crée une URL d'objet et la track pour nettoyage automatique
     */
    createObjectURL(blob) {
        const url = URL.createObjectURL(blob);
        this.objectURLs.add(url);
        return url;
    }

    /**
     * Révoque une URL d'objet spécifique
     */
    revokeObjectURL(url) {
        if (this.objectURLs.has(url)) {
            URL.revokeObjectURL(url);
            this.objectURLs.delete(url);
        }
    }

    /**
     * Ajoute une image au cache avec gestion de la taille
     */
    cacheImage(key, data) {
        // Nettoyer le cache si trop plein
        if (this.imageCache.size >= this.maxCacheSize) {
            this.cleanOldestCacheEntries(10);
        }

        this.imageCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Récupère une image du cache
     */
    getCachedImage(key) {
        const cached = this.imageCache.get(key);
        if (cached) {
            // Mettre à jour le timestamp pour LRU
            cached.timestamp = Date.now();
            return cached.data;
        }
        return null;
    }

    /**
     * Nettoie les entrées les plus anciennes du cache
     */
    cleanOldestCacheEntries(count = 5) {
        const entries = Array.from(this.imageCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        for (let i = 0; i < Math.min(count, entries.length); i++) {
            this.imageCache.delete(entries[i][0]);
        }
    }

    /**
     * Configure la surveillance de la mémoire
     */
    setupMemoryWatcher() {
        if ('memory' in performance) {
            this.memoryWatcher = setInterval(() => {
                const memory = performance.memory;
                const usedMB = memory.usedJSHeapSize / 1024 / 1024;
                const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
                
                // Si on utilise plus de 80% de la mémoire, nettoyer le cache
                if (usedMB / limitMB > 0.8) {
                    console.warn('⚠️ Mémoire élevée détectée, nettoyage du cache');
                    this.cleanOldestCacheEntries(Math.floor(this.imageCache.size / 2));
                }
            }, 10000); // Vérifier toutes les 10 secondes
        }
    }

    /**
     * Estime l'utilisation mémoire actuelle
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            const memory = performance.memory;
            return {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    /**
     * Optimise l'utilisation mémoire
     */
    optimizeMemory() {
        // Nettoyer le cache
        this.imageCache.clear();
        
        // Forcer le garbage collection si disponible
        if (window.gc) {
            window.gc();
        }
        
        console.log('🧹 Optimisation mémoire effectuée');
    }

    /**
     * Nettoie toutes les ressources
     */
    cleanup() {
        // Révoquer toutes les URLs d'objets
        for (const url of this.objectURLs) {
            URL.revokeObjectURL(url);
        }
        this.objectURLs.clear();

        // Nettoyer le cache
        this.imageCache.clear();

        // Arrêter la surveillance mémoire
        if (this.memoryWatcher) {
            clearInterval(this.memoryWatcher);
            this.memoryWatcher = null;
        }

        this.initialized = false;
        console.log('🧹 Resource Manager nettoyé');
    }

    /**
     * Récupère des statistiques sur les ressources
     */
    getStats() {
        return {
            objectURLs: this.objectURLs.size,
            cachedImages: this.imageCache.size,
            memoryUsage: this.getMemoryUsage(),
            isOptimized: this.imageCache.size < this.maxCacheSize / 2
        };
    }
}