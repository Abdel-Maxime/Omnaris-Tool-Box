// Point d'entrée principal de l'ImageProcessor
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
 * Orchestre tous les modules et coordonne les interactions
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
            manualCropData: null,
            abortController: null,
            startTime: null,
            finalResults: null,
            realTimeSavingsTotal: 0
        };

        // Fonctions debounced pour optimiser les performances
        this.debouncedUpdateEstimate = debounce(() => this.ui.updateSavingsEstimate(this.state.selectedFiles), CONFIG.UI.DEBOUNCE_DELAY);
        this.debouncedUpdateRecommendations = debounce(() => this.ui.updateRecommendations(this.state.selectedFiles), CONFIG.UI.DEBOUNCE_DELAY);

        console.log('🚀 ImageProcessorManager créé');
    }

    /**
     * Initialise l'application complète
     */
    async initialize() {
        try {
            // 1. Initialiser le DOM
            await this.dom.initialize();

            // 2. Configurer les event listeners
            this.setupEventListeners();

            // 3. Initialiser l'état de l'UI
            this.ui.updateActionStates();
            this.dom.setDisabled('processTemplateButton', true);

            // 4. Nettoyer les ressources au déchargement
            this.setupCleanup();

            console.log('✅ ImageProcessorManager initialisé avec succès');
            return true;

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            throw error;
        }
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
            if (this.dom.get('enableCrop')?.checked && this.dom.getValue('cropPosition') === 'manual' && this.state.cropperInstance) {
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

    // === GESTIONNAIRES D'ÉVÉNEMENTS ===

    /**
     * Gère le drag over sur la dropzone
     */
    handleDragOver(e) {
        e.preventDefault();
        this.dom.addClass('dropzone', 'border-blue-500');
        this.dom.addClass('dropzone', 'bg-blue-50');
    }

    /**
     * Gère le drag leave sur la dropzone
     */
    handleDragLeave(e) {
        e.preventDefault();
        this.dom.removeClass('dropzone', 'border-blue-500');
        this.dom.removeClass('dropzone', 'bg-blue-50');
    }

    /**
     * Gère le drop de fichiers
     */
    handleDrop(e) {
        e.preventDefault();
        this.dom.removeClass('dropzone', 'border-blue-500');
        this.dom.removeClass('dropzone', 'bg-blue-50');
        
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        this.handleFiles(files);
    }

    /**
     * Gère la sélection de fichiers via l'input
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.handleFiles(files);
        this.dom.setValue('fileInput', ''); // Reset pour permettre la re-sélection
    }

    /**
     * Traite les fichiers sélectionnés
     */
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

            // Précharger la première image si nécessaire pour le crop manuel
            if (validatedFiles.length > 0 && 
                this.dom.get('enableCrop')?.checked && 
                this.dom.getValue('cropPosition') === 'manual') {
                await this.fileHandler.preloadFirstImage(validatedFiles[0]);
            }

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

    /**
     * Gère la sélection d'un template
     */
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

    /**
     * Lance le traitement avec le template sélectionné
     */
    async processWithTemplate() {
        if (this.state.selectedTemplate) {
            this.templateManager.applyTemplate(this.state.selectedTemplate);
            await this.processImages();
        }
    }

    // === GESTION DU CROP PREVIEW ===

    /**
     * Affiche l'aperçu de recadrage
     */
    async showCropPreview() {
        if (this.state.selectedFiles.length === 0) return;

        try {
            this.dom.removeClass('cropPreview', 'hidden');
            
            const preloadedImage = await this.fileHandler.preloadFirstImage(this.state.selectedFiles[0]);
            const previewImage = this.dom.get('previewImage');
            
            if (previewImage && preloadedImage) {
                previewImage.src = preloadedImage.dataUrl;
                previewImage.onload = () => this.initializeCropper();
            }
        } catch (error) {
            console.error('Erreur lors de l\'affichage de l\'aperçu:', error);
        }
    }

    /**
     * Initialise le cropper
     */
    async initializeCropper() {
        try {
            // Import dynamique de Cropper.js
            const Cropper = (await import('cropperjs')).default;
            
            if (this.state.cropperInstance) {
                this.state.cropperInstance.destroy();
                this.state.cropperInstance = null;
            }

            const aspectRatioValue = this.dom.getValue('aspectRatio') || '1/1';
            const ratio = this.parseAspectRatio(aspectRatioValue);
            const previewImage = this.dom.get('previewImage');

            if (!previewImage) return;

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
                    const containerData = this.state.cropperInstance.getContainerData();
                    this.state.cropperInstance.setCropBoxData({
                        width: Math.min(containerData.width * 0.8, 800),
                        height: Math.min(containerData.height * 0.8, 600)
                    });
                },
                crop: (event) => {
                    const { x, y, width, height } = event.detail;
                    const { naturalWidth, naturalHeight } = previewImage;

                    this.state.manualCropData = {
                        x: x / naturalWidth,
                        y: y / naturalHeight,
                        width: width / naturalWidth,
                        height: height / naturalHeight,
                        aspectRatio: width / height
                    };

                    this.debouncedUpdateEstimate();
                }
            });
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du cropper:', error);
        }
    }

    /**
     * Met à jour le ratio d'aspect du cropper
     */
    updateCropperAspectRatio() {
        if (this.state.cropperInstance) {
            const aspectRatioValue = this.dom.getValue('aspectRatio');
            const ratio = this.parseAspectRatio(aspectRatioValue);
            this.state.cropperInstance.setAspectRatio(ratio);
        }
    }

    /**
     * Masque l'aperçu de recadrage
     */
    hideCropPreview() {
        this.dom.addClass('cropPreview', 'hidden');
        if (this.state.cropperInstance) {
            this.state.cropperInstance.destroy();
            this.state.cropperInstance = null;
        }
        this.state.manualCropData = null;
    }

    /**
     * Parse un ratio d'aspect
     */
    parseAspectRatio(ratioStr) {
        if (ratioStr === 'free') return NaN;
        const [w, h] = ratioStr.split('/').map(Number);
        return h > 0 ? w / h : 1;
    }

    // === TRAITEMENT DES IMAGES ===

    /**
     * Lance le traitement des images
     */
    async processImages() {
        if (this.state.selectedFiles.length === 0) return;

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
     * Met à jour la barre de progression
     */
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

    /**
     * Met à jour les économies en temps réel
     */
    updateRealTimeSavings() {
        const formatted = this.formatFileSize(this.state.realTimeSavingsTotal);
        this.dom.setText('currentSavings', `${formatted} économisés`);
    }

    /**
     * Annule le traitement en cours
     */
    cancelProcessing() {
        if (this.state.abortController) {
            this.state.abortController.abort();
        }
    }

    // === GESTION DES RÉSULTATS ===

    /**
     * Affiche l'écran de résultats
     */
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

    /**
     * Génère les détails du traitement
     */
    generateProcessingDetails() {
        let details = '';
        
        if (this.state.selectedTemplate) {
            details += `<div>• Template utilisé: ${CONFIG.TEMPLATES[this.state.selectedTemplate].name}</div>`;
        }
        
        if (this.dom.get('enableResize')?.checked) {
            details += `<div>• Redimensionnement: ${this.dom.getValue('resizePercentSlider') || 80}%</div>`;
        }
        
        if (this.dom.get('enableCrop')?.checked) {
            details += `<div>• Recadrage: ${this.dom.getValue('aspectRatio') || '1/1'} (${this.dom.getValue('cropPosition') || 'center'})</div>`;
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

    /**
     * Génère les détails environnementaux
     */
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

    /**
     * Télécharge le rapport de traitement
     */
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

    /**
     * Génère le rapport texte
     */
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
        // ... autres détails de configuration
        
        return report;
    }

    // === MISE À JOUR DE L'UI ===

    /**
     * Met à jour l'interface utilisateur principale
     */
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

    /**
     * Met à jour l'état du bouton de traitement
     */
    updateProcessButton() {
        const hasActions = this.dom.get('enableResize')?.checked || 
                          this.dom.get('enableCrop')?.checked || 
                          this.dom.get('enableConvert')?.checked;
        
        this.dom.setDisabled('processButton', !hasActions || this.state.selectedFiles.length === 0);
    }

    // === RÉINITIALISATION ===

    /**
     * Remet l'application à zéro
     */
    resetAll() {
        // Réinitialiser l'état
        this.state.selectedFiles = [];
        this.state.selectedTemplate = null;
        this.state.manualCropData = null;
        this.state.finalResults = null;
        this.state.realTimeSavingsTotal = 0;
        
        // Nettoyer le cropper
        this.hideCropPreview();
        
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
        console.log('🔄 Application réinitialisée');
    }

    /**
     * Remet les contrôles à leurs valeurs par défaut
     */
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

    /**
     * Remet les panneaux à leur état initial
     */
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

    // === UTILITAIRES ===

    /**
     * Télécharge un blob
     */
    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        const url = this.resources.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Formate une taille de fichier
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Formate un temps en millisecondes
     */
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    // === NETTOYAGE ===

    /**
     * Nettoie toutes les ressources
     */
    cleanup() {
        this.resources.cleanup();
        this.dom.cleanup();
        
        if (this.state.cropperInstance) {
            this.state.cropperInstance.destroy();
            this.state.cropperInstance = null;
        }
        
        if (this.state.abortController) {
            this.state.abortController.abort();
        }
        
        console.log('🧹 ImageProcessorManager nettoyé');
    }
}