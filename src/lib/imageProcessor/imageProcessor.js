// Processeur d'images principal
import { CONFIG } from './config.js';
import { createCanvas, optimizeCanvasContext, generateFileName } from './utils.js';

export class ImageProcessor {
    constructor(domManager, resourceManager) {
        this.dom = domManager;
        this.resources = resourceManager;
        this.processingQueue = [];
        this.isProcessing = false;
        
        console.log('🖼️ ImageProcessor initialisé');
    }

    /**
     * Traite un ensemble d'images
     */
    async processImages(files, state, progressCallback, savingsCallback) {
        if (files.length === 0) {
            throw new Error('Aucun fichier à traiter');
        }

        const processedBlobs = [];
        const errors = [];
        const total = files.length;
        let realTimeSavingsTotal = 0;

        try {
            // Import dynamique de JSZip
            const JSZip = (await import('jszip')).default;

            // Traiter les images par chunks pour éviter la surcharge mémoire
            for (let i = 0; i < files.length; i += CONFIG.CHUNK_SIZE) {
                // Vérifier l'annulation
                if (state.abortController?.signal.aborted) {
                    throw new Error('Traitement annulé');
                }
                
                const chunk = files.slice(i, i + CONFIG.CHUNK_SIZE);
                const chunkResults = await Promise.all(
                    chunk.map(async (file, index) => {
                        const globalIndex = i + index;
                        progressCallback(globalIndex, total, `Traitement de ${file.name}...`);
                        
                        try {
                            const result = await this.processImage(file, state);
                            
                            // Mettre à jour les économies en temps réel
                            const savings = file.size - result.blob.size;
                            realTimeSavingsTotal += savings;
                            state.realTimeSavingsTotal = realTimeSavingsTotal;
                            savingsCallback();
                            
                            return {
                                success: true,
                                blob: result.blob,
                                name: generateFileName(file.name, this.getCurrentSettings(), state.selectedTemplate),
                                originalSize: file.size,
                                newSize: result.blob.size
                            };
                        } catch (error) {
                            console.error(`Erreur lors du traitement de ${file.name}:`, error);
                            return {
                                success: false,
                                error: { file: file.name, message: error.message }
                            };
                        }
                    })
                );
                
                // Séparer les succès et les erreurs
                chunkResults.forEach(result => {
                    if (result.success) {
                        processedBlobs.push({ 
                            blob: result.blob, 
                            name: result.name,
                            originalSize: result.originalSize,
                            newSize: result.newSize
                        });
                    } else {
                        errors.push(result.error);
                    }
                });
            }
            
            progressCallback(total, total, 'Génération du téléchargement...');

            // Téléchargement
            if (processedBlobs.length === 1) {
                this.downloadBlob(processedBlobs[0].blob, processedBlobs[0].name);
            } else if (processedBlobs.length > 1) {
                await this.downloadZip(processedBlobs, JSZip);
            }

            // Préparer les résultats finaux
            const totalOriginalSize = processedBlobs.reduce((sum, item) => sum + item.originalSize, 0);
            const totalNewSize = processedBlobs.reduce((sum, item) => sum + item.newSize, 0);
            const finalSavings = totalOriginalSize - totalNewSize;
            const savingsPercent = ((finalSavings / totalOriginalSize) * 100).toFixed(1);
            
            return {
                processedCount: processedBlobs.length,
                originalSize: totalOriginalSize,
                newSize: totalNewSize,
                savings: finalSavings,
                savingsPercent: savingsPercent,
                carbonSaved: (finalSavings / (1024 * 1024)) * CONFIG.CO2_FACTOR_PER_MB,
                template: state.selectedTemplate,
                processingTime: Date.now() - state.startTime,
                errors: errors
            };

        } catch (error) {
            console.error('Erreur lors du traitement:', error);
            throw error;
        }
    }

    /**
     * Traite une image individuelle
     */
    async processImage(file, state) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = this.resources.createObjectURL(file);
            
            img.onload = async () => {
                try {
                    let canvas = await this.setupCanvas(img, file);
                    
                    // 1. Recadrage (avant redimensionnement pour éviter la perte de qualité)
                    if (this.dom.get('enableCrop')?.checked) {
                        canvas = await this.applyCrop(canvas, img, state);
                    }

                    // 2. Redimensionnement
                    if (this.dom.get('enableResize')?.checked) {
                        canvas = await this.applyResize(canvas);
                    }

                    // 3. Conversion avec compression optimisée
                    const blob = await this.applyConversion(canvas, file);
                    resolve({ blob });
                    
                } catch (error) {
                    reject(error);
                } finally {
                    this.resources.revokeObjectURL(objectUrl);
                }
            };
            
            img.onerror = () => {
                this.resources.revokeObjectURL(objectUrl);
                reject(new Error('Impossible de charger l\'image'));
            };
            
            img.src = objectUrl;
        });
    }

    /**
     * Configure le canvas initial
     */
    async setupCanvas(img, file) {
        // Vérifier et ajuster la taille si nécessaire
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        if (width > CONFIG.MAX_DIMENSION || height > CONFIG.MAX_DIMENSION) {
            const scale = Math.min(CONFIG.MAX_DIMENSION / width, CONFIG.MAX_DIMENSION / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            console.warn(`⚠️ ${file.name} redimensionnée pour optimiser les performances`);
        }
        
        // Créer le canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        optimizeCanvasContext(ctx);

        // Dessiner l'image
        ctx.drawImage(img, 0, 0, width, height);
        
        return canvas;
    }

    /**
     * Applique le redimensionnement
     */
    async applyResize(canvas) {
        const percent = parseFloat(this.dom.getValue('resizePercentSlider')) / 100;
        const newWidth = Math.round(canvas.width * percent);
        const newHeight = Math.round(canvas.height * percent);

        const tempCanvas = createCanvas(newWidth, newHeight);
        const tempCtx = tempCanvas.getContext('2d');
        optimizeCanvasContext(tempCtx);
        
        tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
        return tempCanvas;
    }

    /**
     * Applique le recadrage
     */
    async applyCrop(canvas, originalImg, state) {
        const position = this.dom.getValue('cropPosition');
        const aspectRatioStr = this.dom.getValue('aspectRatio');

        let cropData;

        if (position === 'manual' && state.manualCropData) {
            // Utiliser les proportions normalisées du crop manuel
            cropData = {
                x: state.manualCropData.x * canvas.width,
                y: state.manualCropData.y * canvas.height,
                width: state.manualCropData.width * canvas.width,
                height: state.manualCropData.height * canvas.height
            };
        } else {
            // Recadrage automatique
            const targetRatio = this.parseAspectRatio(aspectRatioStr);

            if (isNaN(targetRatio)) {
                return canvas; // Pas de recadrage pour le format libre automatique
            }

            cropData = this.calculateAutoCrop(canvas, targetRatio, position);
        }

        return this.performCrop(canvas, cropData);
    }

    /**
     * Calcule les coordonnées de recadrage automatique
     */
    calculateAutoCrop(canvas, targetRatio, position) {
        const currentRatio = canvas.width / canvas.height;
        let cropWidth, cropHeight, cropX, cropY;

        if (currentRatio > targetRatio) {
            // Image trop large
            cropHeight = canvas.height;
            cropWidth = cropHeight * targetRatio;
            cropY = 0;

            switch (position) {
                case 'left': cropX = 0; break;
                case 'right': cropX = canvas.width - cropWidth; break;
                default: cropX = (canvas.width - cropWidth) / 2; break;
            }
        } else {
            // Image trop haute
            cropWidth = canvas.width;
            cropHeight = cropWidth / targetRatio;
            cropX = 0;

            switch (position) {
                case 'top': cropY = 0; break;
                case 'bottom': cropY = canvas.height - cropHeight; break;
                default: cropY = (canvas.height - cropHeight) / 2; break;
            }
        }

        return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
    }

    /**
     * Effectue le recadrage sur le canvas
     */
    performCrop(canvas, cropData) {
        // S'assurer que les dimensions de crop sont valides
        cropData.x = Math.max(0, Math.min(cropData.x, canvas.width - 1));
        cropData.y = Math.max(0, Math.min(cropData.y, canvas.height - 1));
        cropData.width = Math.min(cropData.width, canvas.width - cropData.x);
        cropData.height = Math.min(cropData.height, canvas.height - cropData.y);

        // Vérifier que les dimensions sont positives
        if (cropData.width <= 0 || cropData.height <= 0) {
            console.warn('⚠️ Dimensions de recadrage invalides, retour à l\'image originale');
            return canvas;
        }

        const newCanvas = createCanvas(Math.round(cropData.width), Math.round(cropData.height));
        const ctx = newCanvas.getContext('2d');
        optimizeCanvasContext(ctx);

        ctx.drawImage(
            canvas,
            Math.round(cropData.x), Math.round(cropData.y),
            Math.round(cropData.width), Math.round(cropData.height),
            0, 0,
            Math.round(cropData.width), Math.round(cropData.height)
        );

        return newCanvas;
    }

    /**
     * Applique la conversion de format
     */
    async applyConversion(canvas, originalFile) {
        if (this.dom.get('enableConvert')?.checked) {
            const format = this.dom.getValue('outputFormat');
            const quality = parseFloat(this.dom.getValue('qualitySlider')) / 100;
            return await this.convertWithOptimizedQuality(canvas, format, quality);
        } else {
            // Garder le format original avec une qualité optimisée
            const quality = originalFile.type === 'image/png' ? 1 : 0.95;
            return await this.canvasToBlob(canvas, originalFile.type, quality);
        }
    }

    /**
     * Convertit avec une qualité optimisée selon le format
     */
    async convertWithOptimizedQuality(canvas, format, quality) {
        const mimeType = format === 'png' ? 'image/png' : `image/${format}`;

        // Optimisations spécifiques par format
        if (format === 'webp') {
            const optimizedQuality = Math.max(0.8, quality);
            return await this.canvasToBlob(canvas, mimeType, optimizedQuality);
        } else if (format === 'jpeg') {
            // JPEG : appliquer un léger filtre de netteté si la taille le permet
            if (canvas.width * canvas.height < 4000000) { // < 4 megapixels
                this.applySharpenFilter(canvas);
            }
            const optimizedQuality = Math.max(0.85, quality);
            return await this.canvasToBlob(canvas, mimeType, optimizedQuality);
        } else {
            // PNG : pas de compression destructive
            return await this.canvasToBlob(canvas, mimeType, 1);
        }
    }

    /**
     * Applique un filtre de netteté léger
     */
    applySharpenFilter(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const newData = new Uint8ClampedArray(data);

        // Filtre de netteté léger
        const kernel = [
            0, -0.25, 0,
            -0.25, 2, -0.25,
            0, -0.25, 0
        ];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) { // RGB seulement
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                        }
                    }
                    const idx = (y * width + x) * 4 + c;
                    newData[idx] = Math.max(0, Math.min(255, sum));
                }
            }
        }

        // Appliquer le filtre avec une intensité réduite
        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                data[i + c] = Math.round(data[i + c] * 0.8 + newData[i + c] * 0.2);
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Convertit un canvas en blob avec promesse
     */
    canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, mimeType, quality);
        });
    }

    /**
     * Parse un ratio d'aspect
     */
    parseAspectRatio(ratioStr) {
        if (ratioStr === 'free') return NaN;
        const [w, h] = ratioStr.split('/').map(Number);
        return h > 0 ? w / h : 1;
    }

    /**
     * Télécharge un blob
     */
    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        const url = this.resources.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        link.click();
        
        // Libérer la mémoire après un court délai
        setTimeout(() => this.resources.revokeObjectURL(url), 100);
    }

    /**
     * Télécharge un ZIP contenant plusieurs images
     */
    async downloadZip(processedBlobs, JSZip) {
        const zip = new JSZip();
        
        // Ajouter les fichiers au zip
        for (const { blob, name } of processedBlobs) {
            zip.file(name, blob);
        }
        
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        this.downloadBlob(zipBlob, 'images_optimized.zip');
    }

    /**
     * Récupère la configuration actuelle
     */
    getCurrentSettings() {
        return {
            resize: {
                enabled: this.dom.get('enableResize')?.checked || false,
                percent: parseInt(this.dom.getValue('resizePercentSlider')) || 80
            },
            crop: {
                enabled: this.dom.get('enableCrop')?.checked || false,
                aspectRatio: this.dom.getValue('aspectRatio') || '1/1',
                position: this.dom.getValue('cropPosition') || 'center'
            },
            convert: {
                enabled: this.dom.get('enableConvert')?.checked || false,
                format: this.dom.getValue('outputFormat') || 'webp',
                quality: parseInt(this.dom.getValue('qualitySlider')) || 90
            }
        };
    }

    /**
     * Estime le temps de traitement pour un ensemble de fichiers
     */
    estimateProcessingTime(files, settings = null) {
        if (!settings) {
            settings = this.getCurrentSettings();
        }

        let timePerImage = 0.5; // Base en secondes

        if (settings.resize?.enabled) {
            const scale = settings.resize.percent / 100;
            timePerImage += 0.2 * (1 / scale); // Plus lent pour agrandir
        }

        if (settings.crop?.enabled) {
            timePerImage += 0.3;
        }

        if (settings.convert?.enabled) {
            if (settings.convert.format === 'webp') {
                timePerImage += 0.3;
            } else if (settings.convert.format === 'png') {
                timePerImage += 0.5;
            } else {
                timePerImage += 0.4;
            }
        }

        return timePerImage * files.length;
    }

    /**
     * Vérifie si le processeur peut traiter un type de fichier
     */
    canProcessFileType(mimeType) {
        const supportedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/bmp',
            'image/tiff'
        ];
        
        return supportedTypes.includes(mimeType);
    }

    /**
     * Récupère des statistiques sur le processeur
     */
    getStats() {
        return {
            isProcessing: this.isProcessing,
            queueLength: this.processingQueue.length,
            currentSettings: this.getCurrentSettings(),
            maxDimension: CONFIG.MAX_DIMENSION,
            chunkSize: CONFIG.CHUNK_SIZE
        };
    }

    /**
     * Nettoie les ressources du processeur
     */
    cleanup() {
        this.processingQueue = [];
        this.isProcessing = false;
        console.log('🧹 ImageProcessor nettoyé');
    }
}