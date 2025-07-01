// Version corrigée du gestionnaire principal avec corrections pour le recadrage manuel
import { CONFIG, validateConfig } from './config.js';
import { DOMManager } from './dom.js';
import { ResourceManager } from './resourceManager.js';
import { FileHandler } from './fileHandler.js';
import { TemplateManager } from './templates.js';
import { UIManager } from './ui.js';
import { ImageProcessor } from './imageProcessor.js';
import { debounce } from './utils.js';

/**
 * Gestionnaire principal de l'application ImageProcessor
 * VERSION CORRIGÉE avec fixes pour le recadrage manuel
 */
export default class ImageProcessorManager {
    constructor() {
        // Validation de la configuration
        const configValidation = validateConfig();
        if (!configValidation.isValid) {
            throw new Error(`Configuration invalide: ${configValidation.errors.join(', ')}`);
        }

        // Initialisation des modules
        this.config = CONFIG;
        this.dom = new DOMManager();
        this.resources = new ResourceManager();
        this.fileHandler = new FileHandler(this.dom, this.resources);
        this.templateManager = new TemplateManager(this.dom);
        this.ui = new UIManager(this.dom);
        this.processor = new ImageProcessor(this.dom, this.resources);

        // État global de l'application
        this.state = {
            selectedFiles: [],
            selectedTemplate: null,
            cropperInstance: null,
            cropperReady: false, // NOUVEAU: Flag pour savoir si le cropper est prêt
            manualCropData: null,
            abortController: null,
            startTime: null,
            finalResults: null,
            realTimeSavingsTotal: 0,
            cropperLoadAttempts: 0 // NOUVEAU: Compteur pour les tentatives de chargement
        };

        // Fonctions debounced pour optimiser les performances
        this.debouncedUpdateEstimate = debounce(() => this.ui.updateSavingsEstimate(this.state.selectedFiles), CONFIG.UI.DEBOUNCE_DELAY);
        this.debouncedUpdateRecommendations = debounce(() => this.ui.updateRecommendations(this.state.selectedFiles), CONFIG.UI.DEBOUNCE_DELAY);

        console.log('🚀 ImageProcessorManager créé (Version corrigée)');
    }

    /**
     * Initialise l'application complète
     */
    async initialize() {
        try {
            // 1. Initialiser le DOM
            await this.dom.initialize();

            // 2. Configurer la gestion d'erreurs globales AVANT les event listeners
            this.setupGlobalErrorHandling();

            // 3. Configurer les event listeners
            this.setupEventListeners();

            // 4. Initialiser l'état de l'UI
            this.ui.updateActionStates();
            this.dom.setDisabled('processTemplateButton', true);

            // 5. Vérifier la disponibilité de CropperJS
            await this.checkCropperJSAvailability();

            // 6. Nettoyer les ressources au déchargement
            this.setupCleanup();

            console.log('✅ ImageProcessorManager initialisé avec succès (Version corrigée)');
            return true;

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            throw error;
        }
    }

    /**
     * NOUVEAU: Vérifie la disponibilité de CropperJS au démarrage
     */
    async checkCropperJSAvailability() {
        try {
            const CropperModule = await import('cropperjs');
            const Cropper = CropperModule.default || CropperModule;
            if (!Cropper) {
                console.warn('⚠️ CropperJS non disponible - recadrage manuel désactivé');
                this.disableManualCropping();
            } else {
                console.log('✅ CropperJS disponible');
            }
        } catch (error) {
            console.warn('⚠️ CropperJS non chargeable - recadrage manuel désactivé:', error);
            this.disableManualCropping();
        }
    }

    /**
     * NOUVEAU: Désactive le recadrage manuel si CropperJS n'est pas disponible
     */
    disableManualCropping() {
        const cropPositionSelect = this.dom.get('cropPosition');
        if (cropPositionSelect) {
            // Retirer l'option manuel
            const manualOption = cropPositionSelect.querySelector('option[value="manual"]');
            if (manualOption) {
                manualOption.remove();
            }
        }
    }

    /**
     * NOUVEAU: Configure la gestion d'erreurs globales
     */
    setupGlobalErrorHandling() {
        // Gestion des promesses rejetées
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            if (error?.message?.toLowerCase().includes('cropper') || 
                error?.stack?.toLowerCase().includes('cropper')) {
                console.error('❌ Erreur Cropper non gérée:', error);
                this.ui.showMessage('Erreur lors du recadrage. Veuillez recharger la page.', 'error');
                this.resetCropperState();
                event.preventDefault();
            }
        });

        // Gestion des erreurs JavaScript
        window.addEventListener('error', (event) => {
            if (event.filename?.includes('cropper') || 
                event.message?.toLowerCase().includes('cropper')) {
                console.error('❌ Erreur JavaScript Cropper:', event.error);
                this.ui.showMessage('Erreur lors du recadrage manuel', 'error');
                this.resetCropperState();
            }
        });
    }

    /**
     * Configure tous les event listeners de l'application
     */
    setupEventListeners() {
        // === UPLOAD DE FICHIERS ===
        this.dom.addEventListener('dropzone', 'click', () => {
            const fileInput = this.dom.get('fileInput');
            if (fileInput) fileInput.click();
        });

        this.dom.addEventListener('dropzone', 'dragover', this.handleDragOver.bind(this));
        this.dom.addEventListener('dropzone', 'dragleave', this.handleDragLeave.bind(this));
        this.dom.addEventListener('dropzone', 'drop', this.handleDrop.bind(this));
        this.dom.addEventListener('fileInput', 'change', this.handleFileSelect.bind(this));

        // === NAVIGATION ENTRE PANNEAUX ===
        this.dom.addEventListener('manualConfigBtn', 'click', () => {
            this.dom.addClass('templatesPanel', 'hidden');
            this.dom.removeClass('configPanel', 'hidden');
            this.dom.scrollToElement('configPanel');
        });

        this.dom.addEventListener('backToTemplatesBtn', 'click', () => {
            this.dom.addClass('configPanel', 'hidden');
            this.dom.removeClass('templatesPanel', 'hidden');
            this.dom.scrollToElement('templatesPanel');
        });

        this.dom.addEventListener('newProcessingBtn', 'click', this.resetAll.bind(this));
        this.dom.addEventListener('downloadResultsBtn', 'click', this.downloadReport.bind(this));

        // === TEMPLATES ===
        this.dom.addEventListenerToAll('.template-card', 'click', this.handleTemplateSelection.bind(this));
        this.dom.addEventListener('processTemplateButton', 'click', this.processWithTemplate.bind(this));

        // === CONFIGURATION MANUELLE ===
        this.dom.addEventListenerToAll('.action-checkbox', 'change', () => {
            this.ui.updateActionStates();
            this.debouncedUpdateEstimate();
            this.debouncedUpdateRecommendations();
        });

        // Sliders avec mise à jour immédiate du texte
        this.dom.addEventListener('resizePercentSlider', 'input', () => {
            const value = this.dom.getValue('resizePercentSlider');
            this.dom.setText('resizePercentValue', value + '%');
            this.ui.updatePerformanceEstimate(this.state.selectedFiles);
            this.debouncedUpdateEstimate();
            this.debouncedUpdateRecommendations();
        });

        this.dom.addEventListener('qualitySlider', 'input', () => {
            const value = this.dom.getValue('qualitySlider');
            this.dom.setText('qualityValue', value + '%');
            this.debouncedUpdateEstimate();
            this.debouncedUpdateRecommendations();
        });

        // Selects avec mise à jour
        this.dom.addEventListener('outputFormat', 'change', () => {
            this.debouncedUpdateEstimate();
            this.debouncedUpdateRecommendations();
        });

        this.dom.addEventListener('aspectRatio', 'change', () => {
            this.debouncedUpdateEstimate();
            this.debouncedUpdateRecommendations();
            if (this.dom.get('enableCrop')?.checked && 
                this.dom.getValue('cropPosition') === 'manual' && 
                this.state.cropperInstance && 
                this.state.cropperReady) {
                this.updateCropperAspectRatio();
            }
        });

        this.dom.addEventListener('cropPosition', 'change', () => {
            if (this.dom.get('enableCrop')?.checked && this.dom.getValue('cropPosition') === 'manual') {
                this.showCropPreview();
            } else {
                this.hideCropPreview();
            }
            this.debouncedUpdateEstimate();
        });

        // === BOUTONS D'ACTION ===
        this.dom.addEventListener('processButton', 'click', this.processImages.bind(this));
        this.dom.addEventListener('resetButton', 'click', this.resetAll.bind(this));
        this.dom.addEventListener('cancelButton', 'click', this.cancelProcessing.bind(this));
    }

    /**
     * Configure le nettoyage automatique des ressources
     */
    setupCleanup() {
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    // === GESTIONNAIRES D'ÉVÉNEMENTS (inchangés) ===
    handleDragOver(e) {
        e.preventDefault();
        this.dom.addClass('dropzone', 'border-blue-500');
        this.dom.addClass('dropzone', 'bg-blue-50');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dom.removeClass('dropzone', 'border-blue-500');
        this.dom.removeClass('dropzone', 'bg-blue-50');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dom.removeClass('dropzone', 'border-blue-500');
        this.dom.removeClass('dropzone', 'bg-blue-50');
        
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        this.handleFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.handleFiles(files);
        this.dom.setValue('fileInput', ''); // Reset pour permettre la re-sélection
    }

    async handleFiles(files) {
        try {
            const validatedFiles = await this.fileHandler.validateFiles(files);
            
            if (validatedFiles.length === 0) {
                return;
            }

            this.state.selectedFiles = validatedFiles;
            this.updateUI();
            this.debouncedUpdateEstimate();
            this.debouncedUpdateRecommendations();

            this.ui.showMessage(`${validatedFiles.length} image(s) sélectionnée(s)`, 'info');

            // Scroll automatique vers les templates
            setTimeout(() => {
                this.dom.scrollToElement('templatesPanel');
            }, 500);

        } catch (error) {
            console.error('Erreur lors de la gestion des fichiers:', error);
            this.ui.showMessage('Erreur lors du traitement des fichiers', 'error');
        }
    }

    handleTemplateSelection(e) {
        const card = e.currentTarget;
        const templateName = card.dataset.template;

        // Retirer la sélection précédente
        this.dom.safeQuerySelectorAll('.template-card').forEach(c => 
            c.classList.remove('selected')
        );

        // Ajouter la nouvelle sélection
        card.classList.add('selected');
        this.state.selectedTemplate = templateName;
        this.dom.setDisabled('processTemplateButton', false);

        // Appliquer le template
        this.templateManager.applyTemplate(templateName);
        this.debouncedUpdateEstimate();
        this.debouncedUpdateRecommendations();
    }

    async processWithTemplate() {
        if (this.state.selectedTemplate) {
            this.templateManager.applyTemplate(this.state.selectedTemplate);
            await this.processImages();
        }
    }

    // === GESTION DU CROP PREVIEW (VERSION CORRIGÉE) ===

    /**
     * CORRIGÉ: Affiche l'aperçu de recadrage avec gestion d'erreurs robuste
     */
    async showCropPreview() {
        if (this.state.selectedFiles.length === 0) {
            console.warn('⚠️ Aucun fichier sélectionné pour l\'aperçu');
            return;
        }

        try {
            this.dom.removeClass('cropPreview', 'hidden');
            
            // Essayer d'utiliser l'image préchargée
            let imageSource = null;
            try {
                const preloadedImage = await this.fileHandler.preloadFirstImage(this.state.selectedFiles[0]);
                imageSource = preloadedImage.dataUrl;
                console.log('✅ Image préchargée utilisée pour l\'aperçu');
            } catch (preloadError) {
                console.warn('⚠️ Échec du préchargement, lecture directe du fichier:', preloadError);
                // Fallback : lire directement le fichier
                imageSource = await this.readFileDirectly(this.state.selectedFiles[0]);
                console.log('✅ Lecture directe du fichier réussie');
            }
            
            const previewImage = this.dom.get('previewImage');
            if (!previewImage) {
                throw new Error('Élément previewImage non trouvé dans le DOM');
            }
            
            // Attendre que l'image soit chargée avant d'initialiser le cropper
            await this.loadImageSafely(previewImage, imageSource);
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'affichage de l\'aperçu:', error);
            this.ui.showMessage('Impossible d\'afficher l\'aperçu de recadrage', 'error');
            this.hideCropPreview();
        }
    }

    /**
     * NOUVEAU: Lit un fichier directement si le préchargement échoue
     */
    async readFileDirectly(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`Impossible de lire le fichier: ${file.name}`));
            reader.readAsDataURL(file);
        });
    }

    /**
     * NOUVEAU: Charge une image de manière sécurisée avec timeout
     */
    async loadImageSafely(imgElement, src) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout lors du chargement de l\'image (10s)'));
            }, 10000);
            
            imgElement.onload = () => {
                clearTimeout(timeout);
                // Vérifier que l'image a des dimensions valides
                if (imgElement.naturalWidth <= 0 || imgElement.naturalHeight <= 0) {
                    reject(new Error('Image avec dimensions invalides'));
                    return;
                }
                // Attendre un frame pour s'assurer que l'image est rendue
                requestAnimationFrame(() => {
                    this.initializeCropper();
                    resolve();
                });
            };
            
            imgElement.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Erreur lors du chargement de l\'image'));
            };
            
            imgElement.src = src;
        });
    }

    /**
     * CORRIGÉ: Initialise le cropper avec gestion d'erreurs robuste
     */
    async initializeCropper() {
        // Nettoyer l'instance précédente de manière sûre
        this.resetCropperState();

        const previewImage = this.dom.get('previewImage');
        if (!previewImage) {
            throw new Error('Élément previewImage non trouvé');
        }

        if (!previewImage.complete || previewImage.naturalWidth === 0) {
            throw new Error('Image de prévisualisation non prête');
        }

        try {
            // Incrémenter le compteur de tentatives
            this.state.cropperLoadAttempts++;
            
            if (this.state.cropperLoadAttempts > 3) {
                throw new Error('Trop de tentatives de chargement du cropper');
            }

            // Import dynamique sécurisé de CropperJS
            console.log('📦 Chargement de CropperJS...');
            const CropperModule = await import('cropperjs');
            const Cropper = CropperModule.default || CropperModule;
            
            if (!Cropper) {
                throw new Error('CropperJS non disponible après import');
            }

            const aspectRatioValue = this.dom.getValue('aspectRatio') || '1/1';
            const ratio = this.parseAspectRatio(aspectRatioValue);

            console.log('🎨 Initialisation du Cropper avec ratio:', ratio);

            this.state.cropperInstance = new Cropper(previewImage, {
                aspectRatio: ratio,
                viewMode: 1,
                autoCropArea: 0.8,
                guides: true,
                highlight: true,
                movable: true,
                zoomable: true,
                rotatable: false,
                scalable: false,
                responsive: true,
                checkOrientation: false,
                ready: () => {
                    try {
                        console.log('✅ Cropper prêt');
                        this.state.cropperReady = true;
                        
                        // Limiter la taille initiale du crop box
                        const containerData = this.state.cropperInstance.getContainerData();
                        if (containerData && containerData.width > 0 && containerData.height > 0) {
                            this.state.cropperInstance.setCropBoxData({
                                width: Math.min(containerData.width * 0.8, 800),
                                height: Math.min(containerData.height * 0.8, 600)
                            });
                        }
                    } catch (readyError) {
                        console.error('❌ Erreur dans ready callback:', readyError);
                    }
                },
                crop: (event) => {
                    try {
                        const { x, y, width, height } = event.detail;
                        const { naturalWidth, naturalHeight } = previewImage;

                        // Validation rigoureuse des dimensions
                        if (!naturalWidth || !naturalHeight || naturalWidth <= 0 || naturalHeight <= 0) {
                            console.warn('⚠️ Dimensions d\'image invalides dans crop event');
                            return;
                        }

                        // Validation des données de crop
                        if (x < 0 || y < 0 || width <= 0 || height <= 0) {
                            console.warn('⚠️ Données de crop invalides:', { x, y, width, height });
                            return;
                        }

                        // Normalisation sécurisée
                        const normalizedData = {
                            x: Math.max(0, Math.min(x / naturalWidth, 1)),
                            y: Math.max(0, Math.min(y / naturalHeight, 1)),
                            width: Math.max(0, Math.min(width / naturalWidth, 1)),
                            height: Math.max(0, Math.min(height / naturalHeight, 1)),
                            aspectRatio: width / height,
                            timestamp: Date.now() // Pour debug
                        };

                        // Validation finale
                        if (normalizedData.width <= 0 || normalizedData.height <= 0) {
                            console.warn('⚠️ Données normalisées invalides');
                            return;
                        }

                        this.state.manualCropData = normalizedData;
                        
                        // Debug en mode développement
                        if (import.meta.env?.DEV) {
                            this.debugCropperState();
                        }
                        
                        this.debouncedUpdateEstimate();
                    } catch (cropError) {
                        console.error('❌ Erreur dans crop event:', cropError);
                    }
                }
            });

            // Reset du compteur en cas de succès
            this.state.cropperLoadAttempts = 0;
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du cropper:', error);
            this.ui.showMessage('Impossible d\'initialiser l\'outil de recadrage', 'error');
            this.resetCropperState();
            
            // Fallback : désactiver le mode manuel
            const cropPositionSelect = this.dom.get('cropPosition');
            if (cropPositionSelect && cropPositionSelect.value === 'manual') {
                cropPositionSelect.value = 'center';
                this.hideCropPreview();
            }
        }
    }

    /**
     * CORRIGÉ: Met à jour le ratio d'aspect du cropper de manière sécurisée
     */
    updateCropperAspectRatio() {
        if (!this.state.cropperInstance || !this.state.cropperReady) {
            console.warn('⚠️ Cropper non prêt pour la mise à jour du ratio');
            return;
        }

        try {
            const aspectRatioValue = this.dom.getValue('aspectRatio');
            const ratio = this.parseAspectRatio(aspectRatioValue);
            
            console.log('🔄 Mise à jour du ratio d\'aspect:', aspectRatioValue, '→', ratio);
            
            // Vérifier que le ratio est valide
            if (isNaN(ratio)) {
                this.state.cropperInstance.setAspectRatio(NaN); // Ratio libre
            } else if (ratio > 0) {
                this.state.cropperInstance.setAspectRatio(ratio);
            } else {
                console.warn('⚠️ Ratio d\'aspect invalide:', ratio);
                return;
            }
            
            // Réinitialiser les données de crop manuel car le ratio a changé
            this.state.manualCropData = null;
            
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour du ratio:', error);
            this.ui.showMessage('Erreur lors de la mise à jour du format', 'error');
        }
    }

    /**
     * NOUVEAU: Remet à zéro l'état du cropper
     */
    resetCropperState() {
        this.state.cropperReady = false;
        
        if (this.state.cropperInstance) {
            try {
                this.state.cropperInstance.destroy();
                console.log('🧹 Cropper détruit');
            } catch (error) {
                console.warn('⚠️ Erreur lors de la destruction du cropper:', error);
            }
            this.state.cropperInstance = null;
        }
        
        this.state.manualCropData = null;
    }

    /**
     * CORRIGÉ: Masque l'aperçu de recadrage de manière sécurisée
     */
    hideCropPreview() {
        this.dom.addClass('cropPreview', 'hidden');
        this.resetCropperState();
        console.log('👁️ Aperçu de recadrage masqué');
    }

    /**
     * Parse un ratio d'aspect (inchangé)
     */
    parseAspectRatio(ratioStr) {
        if (ratioStr === 'free') return NaN;
        const [w, h] = ratioStr.split('/').map(Number);
        return h > 0 ? w / h : 1;
    }

    /**
     * NOUVEAU: Debug de l'état du cropper
     */
    debugCropperState() {
        console.group('🔍 État du Cropper');
        console.log('Instance existe:', !!this.state.cropperInstance);
        console.log('Cropper prêt:', this.state.cropperReady);
        console.log('Tentatives de chargement:', this.state.cropperLoadAttempts);
        console.log('Données de crop manuel:', this.state.manualCropData);
        console.log('Fichiers sélectionnés:', this.state.selectedFiles.length);
        
        const previewImg = this.dom.get('previewImage');
        if (previewImg) {
            console.log('Image preview:', {
                src: previewImg.src?.substring(0, 50) + '...',
                complete: previewImg.complete,
                naturalWidth: previewImg.naturalWidth,
                naturalHeight: previewImg.naturalHeight
            });
        }
        console.groupEnd();
    }

    // === TRAITEMENT DES IMAGES (inchangé mais avec validation améliorée) ===

    async processImages() {
        if (this.state.selectedFiles.length === 0) return;

        // Validation supplémentaire pour le crop manuel
        if (this.dom.get('enableCrop')?.checked && 
            this.dom.getValue('cropPosition') === 'manual' && 
            !this.validateManualCropData(this.state.manualCropData)) {
            
            this.ui.showMessage('Données de recadrage manuel invalides. Recadrage automatique utilisé.', 'warning');
            this.state.manualCropData = null;
        }

        try {
            this.state.startTime = Date.now();
            this.state.realTimeSavingsTotal = 0;
            this.state.abortController = new AbortController();

            // Masquer les panneaux et afficher la progression
            this.dom.addClass('templatesPanel', 'hidden');
            this.dom.addClass('configPanel', 'hidden');
            this.dom.removeClass('progressPanel', 'hidden');
            this.dom.scrollToElement('progressPanel');

            // Réinitialiser les erreurs
            this.dom.addClass('errorsList', 'hidden');
            this.dom.setHTML('errorsContent', '');

            // Lancer le traitement
            const result = await this.processor.processImages(
                this.state.selectedFiles,
                this.state,
                this.updateProgress.bind(this),
                this.updateRealTimeSavings.bind(this)
            );

            this.state.finalResults = result;
            this.showResults();

        } catch (error) {
            if (error.message === 'Traitement annulé') {
                this.ui.showMessage('Traitement annulé par l\'utilisateur', 'warning');
            } else {
                this.ui.showMessage(`Erreur: ${error.message}`, 'error');
            }
            this.resetAll();
        }
    }

    /**
     * NOUVEAU: Valide les données de recadrage manuel
     */
    validateManualCropData(cropData) {
        if (!cropData) return false;
        
        const requiredFields = ['x', 'y', 'width', 'height'];
        for (const field of requiredFields) {
            if (typeof cropData[field] !== 'number' || 
                isNaN(cropData[field]) || 
                cropData[field] < 0) {
                console.warn(`⚠️ Champ invalide dans manualCropData: ${field} = ${cropData[field]}`);
                return false;
            }
        }
        
        if (cropData.width <= 0 || cropData.height <= 0) {
            console.warn('⚠️ Dimensions de recadrage invalides');
            return false;
        }
        
        if (cropData.x + cropData.width > 1 || cropData.y + cropData.height > 1) {
            console.warn('⚠️ Zone de recadrage dépasse les limites de l\'image');
            return false;
        }
        
        return true;
    }

    // === MÉTHODES UTILITAIRES (inchangées) ===
    
    updateProgress(current, total, text) {
        const percent = Math.round((current / total) * 100);
        
        this.dom.setAttribute('progressBar', 'style', `width: ${percent}%`);
        this.dom.setAttribute('progressBar', 'aria-valuenow', percent);
        this.dom.setText('progressText', text);
        this.dom.setText('progressPercent', percent + '%');

        // Calculer le temps restant
        if (this.state.startTime && current > 0) {
            const elapsed = Date.now() - this.state.startTime;
            const timePerItem = elapsed / current;
            const remaining = timePerItem * (total - current);
            this.dom.setText('timeRemaining', `Temps restant: ${this.formatTime(remaining)}`);
        }
    }

    updateRealTimeSavings() {
        const formatted = this.formatFileSize(this.state.realTimeSavingsTotal);
        this.dom.setText('currentSavings', `${formatted} économisés`);
    }

    cancelProcessing() {
        if (this.state.abortController) {
            this.state.abortController.abort();
        }
    }

    // === GESTION DES RÉSULTATS (inchangées) ===
    
    showResults() {
        if (!this.state.finalResults) return;

        this.dom.addClass('progressPanel', 'hidden');
        this.dom.removeClass('resultsPanel', 'hidden');
        this.dom.scrollToElement('resultsPanel');

        // Remplir les statistiques
        this.dom.setText('finalImagesProcessed', this.state.finalResults.processedCount);
        this.dom.setText('finalSavingsAmount', this.formatFileSize(this.state.finalResults.savings));
        this.dom.setText('finalSavingsPercent', this.state.finalResults.savingsPercent + '%');
        this.dom.setText('finalCarbonSaved', this.state.finalResults.carbonSaved.toFixed(1) + 'g');

        // Détails du traitement
        this.generateProcessingDetails();
        
        // Impact environnemental
        this.generateEnvironmentalDetails();
    }

    generateProcessingDetails() {
        let details = '';
        
        if (this.state.selectedTemplate) {
            details += `<div>• Template utilisé: ${CONFIG.TEMPLATES[this.state.selectedTemplate].name}</div>`;
        }
        
        if (this.dom.get('enableResize')?.checked) {
            details += `<div>• Redimensionnement: ${this.dom.getValue('resizePercentSlider') || 80}%</div>`;
        }
        
        if (this.dom.get('enableCrop')?.checked) {
            const position = this.dom.getValue('cropPosition') || 'center';
            const positionText = position === 'manual' ? 'manuel' : position;
            details += `<div>• Recadrage: ${this.dom.getValue('aspectRatio') || '1/1'} (${positionText})</div>`;
        }
        
        if (this.dom.get('enableConvert')?.checked) {
            details += `<div>• Conversion: ${(this.dom.getValue('outputFormat') || 'webp').toUpperCase()} (${this.dom.getValue('qualitySlider') || 90}%)</div>`;
        }
        
        details += `<div>• Temps de traitement: ${this.formatTime(this.state.finalResults.processingTime)}</div>`;
        
        if (this.state.finalResults.errors.length > 0) {
            details += `<div class="text-red-600">• ${this.state.finalResults.errors.length} erreur(s) rencontrée(s)</div>`;
        }

        this.dom.setHTML('processingDetails', details);
    }

    generateEnvironmentalDetails() {
        const mbSaved = this.state.finalResults.savings / (1024 * 1024);
        const minutesStreaming = (mbSaved * 0.1).toFixed(1);
        const kmCar = (mbSaved * 0.0001).toFixed(2);
        
        const details = `
            <div>Cette optimisation économise ${this.state.finalResults.carbonSaved.toFixed(1)}g de CO₂ en transferts réseau.</div>
            <div class="mt-2 text-sm">Équivalences:</div>
            <div class="text-sm">• ${minutesStreaming} minutes de streaming vidéo évitées</div>
            <div class="text-sm">• ${kmCar} km en voiture économisés</div>
        `;

        this.dom.setHTML('environmentalDetails', details);
    }

    downloadReport() {
        try {
            const report = this.generateTextReport();
            const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
            this.downloadBlob(blob, `rapport_optimisation_${Date.now()}.txt`);
        } catch (error) {
            console.error('Erreur lors du téléchargement du rapport:', error);
            this.ui.showMessage('Erreur lors du téléchargement du rapport', 'error');
        }
    }

    generateTextReport() {
        if (!this.state.finalResults) return 'Aucun résultat disponible';
        
        const date = new Date().toLocaleString();
        let report = `RAPPORT D'OPTIMISATION D'IMAGES\n`;
        report += `Généré le: ${date}\n\n`;
        
        report += `STATISTIQUES GLOBALES\n`;
        report += `=====================\n`;
        report += `Images traitées: ${this.state.finalResults.processedCount}\n`;
        report += `Taille originale: ${this.formatFileSize(this.state.finalResults.originalSize)}\n`;
        report += `Taille finale: ${this.formatFileSize(this.state.finalResults.newSize)}\n`;
        report += `Économies: ${this.formatFileSize(this.state.finalResults.savings)} (${this.state.finalResults.savingsPercent}%)\n`;
        report += `CO₂ économisé: ${this.state.finalResults.carbonSaved.toFixed(1)}g\n`;
        report += `Temps de traitement: ${this.formatTime(this.state.finalResults.processingTime)}\n\n`;
        
        // Configuration utilisée
        report += `CONFIGURATION UTILISÉE\n`;
        report += `======================\n`;
        if (this.state.selectedTemplate) {
            report += `Template: ${CONFIG.TEMPLATES[this.state.selectedTemplate].name}\n`;
        }
        
        return report;
    }

    // === MISE À JOUR DE L'UI (inchangées) ===

    updateUI() {
        if (this.state.selectedFiles.length > 0) {
            this.dom.addClass('dropzone', 'hidden');
            this.dom.removeClass('templatesPanel', 'hidden');
            this.dom.setText('imageCount', this.state.selectedFiles.length);
            
            const totalBytes = this.state.selectedFiles.reduce((sum, file) => sum + file.size, 0);
            this.dom.setText('totalSize', `(${this.formatFileSize(totalBytes)} total)`);
            
            this.ui.updatePerformanceEstimate(this.state.selectedFiles);
            this.updateProcessButton();
            this.dom.setDisabled('processTemplateButton', !this.state.selectedTemplate);
        } else {
            this.dom.removeClass('dropzone', 'hidden');
            this.dom.addClass('templatesPanel', 'hidden');
            this.dom.addClass('configPanel', 'hidden');
            this.dom.addClass('resultsPanel', 'hidden');
            this.hideCropPreview();
        }
    }

    updateProcessButton() {
        const hasActions = this.dom.get('enableResize')?.checked || 
                          this.dom.get('enableCrop')?.checked || 
                          this.dom.get('enableConvert')?.checked;
        
        this.dom.setDisabled('processButton', !hasActions || this.state.selectedFiles.length === 0);
    }

    // === RÉINITIALISATION (améliorée) ===

    resetAll() {
        // Nettoyer le cropper en premier
        this.resetCropperState();
        
        // Réinitialiser l'état
        this.state.selectedFiles = [];
        this.state.selectedTemplate = null;
        this.state.finalResults = null;
        this.state.realTimeSavingsTotal = 0;
        this.state.cropperLoadAttempts = 0;
        
        // Nettoyer les ressources
        this.resources.cleanup();
        
        // Réinitialiser les templates
        this.dom.safeQuerySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        this.dom.setDisabled('processTemplateButton', true);
        
        // Réinitialiser les contrôles
        this.resetControls();
        
        // Réinitialiser l'UI
        this.resetPanels();
        
        // Annuler tout traitement en cours
        if (this.state.abortController) {
            this.state.abortController.abort();
            this.state.abortController = null;
        }
        
        this.ui.updateActionStates();
        console.log('🔄 Application réinitialisée (avec cropper nettoyé)');
    }

    resetControls() {
        // Checkboxes
        this.dom.safeQuerySelectorAll('.action-checkbox').forEach(cb => cb.checked = false);
        
        // Sliders
        this.dom.setValue('resizePercentSlider', '80');
        this.dom.setText('resizePercentValue', '80%');
        this.dom.setValue('qualitySlider', '90');
        this.dom.setText('qualityValue', '90%');
        
        // Selects
        this.dom.setValue('cropPosition', 'center');
        this.dom.setValue('aspectRatio', '1/1');
        this.dom.setValue('outputFormat', 'webp');
    }

    resetPanels() {
        this.dom.addClass('templatesPanel', 'hidden');
        this.dom.addClass('configPanel', 'hidden');
        this.dom.addClass('progressPanel', 'hidden');
        this.dom.addClass('resultsPanel', 'hidden');
        this.dom.removeClass('dropzone', 'hidden');
        
        // Reset progress
        this.dom.setAttribute('progressBar', 'style', 'width: 0%');
        this.dom.setAttribute('progressBar', 'aria-valuenow', '0');
        this.dom.setText('progressText', 'Initialisation...');
        this.dom.setText('progressPercent', '0%');
        this.dom.setText('timeRemaining', '');
        
        // Nettoyer les économies et erreurs
        this.dom.setText('currentSavings', '0 MB économisés');
        this.dom.addClass('errorsList', 'hidden');
        this.dom.setHTML('errorsContent', '');
        
        // Réinitialiser les recommandations
        this.dom.setHTML('recommendationsList', '<p class="text-gray-600">Sélectionnez des images pour voir les recommandations...</p>');
        
        // Scroll vers le haut
        this.dom.scrollToElement('dropzone');
    }

    // === UTILITAIRES (inchangés) ===

    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        const url = this.resources.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    // === NETTOYAGE (amélioré) ===

    cleanup() {
        // Nettoyer le cropper d'abord
        this.resetCropperState();
        
        // Nettoyer les autres ressources
        this.resources.cleanup();
        this.dom.cleanup();
        
        if (this.state.abortController) {
            this.state.abortController.abort();
        }
        
        console.log('🧹 ImageProcessorManager nettoyé (Version corrigée)');
    }
}