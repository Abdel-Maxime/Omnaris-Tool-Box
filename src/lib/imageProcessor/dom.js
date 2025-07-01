// Gestionnaire DOM sécurisé
export class DOMManager {
    constructor() {
        this.elements = {};
        this.initialized = false;
    }

    /**
     * Récupère un élément de manière sécurisée
     */
    safeGetElement(id) {
        if (this.elements[id]) {
            return this.elements[id];
        }

        const element = document.getElementById(id);
        if (!element) {
            console.warn(`⚠️ Element ${id} not found`);
            return null;
        }
        
        this.elements[id] = element;
        return element;
    }

    /**
     * Récupère un élément par sélecteur
     */
    safeQuerySelector(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`⚠️ Element with selector ${selector} not found`);
            return null;
        }
        return element;
    }

    /**
     * Récupère tous les éléments par sélecteur
     */
    safeQuerySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * Initialise tous les éléments nécessaires
     */
    async initialize() {
        const elementIds = [
            // Zone principale
            'dropzone', 'fileInput', 'messageContainer',
            
            // Panneaux
            'templatesPanel', 'configPanel', 'progressPanel', 'resultsPanel',
            
            // Navigation
            'manualConfigBtn', 'backToTemplatesBtn', 'processTemplateButton',
            'newProcessingBtn', 'downloadResultsBtn',
            
            // Configuration
            'enableResize', 'enableCrop', 'enableConvert',
            'resizeOptions', 'cropOptions', 'convertOptions',
            'resizePercentSlider', 'resizePercentValue',
            'qualitySlider', 'qualityValue',
            'cropPosition', 'aspectRatio', 'outputFormat',
            
            // Aperçu crop
            'cropPreview', 'previewImage',
            
            // Économies
            'currentSize', 'estimatedSize', 'savings', 'savingsPercent',
            'resizeSavingsBar', 'resizeSavingsText',
            'cropSavingsBar', 'cropSavingsText', 
            'compressionSavingsBar', 'compressionSavingsText',
            'carbonSaved',
            
            // Informations
            'imageCount', 'totalSize', 'performanceEstimate',
            'recommendationsList',
            
            // Progression
            'progressBar', 'progressText', 'progressPercent', 
            'timeRemaining', 'cancelButton', 'currentSavings',
            'errorsList', 'errorsContent',
            
            // Résultats
            'finalImagesProcessed', 'finalSavingsAmount', 
            'finalSavingsPercent', 'finalCarbonSaved',
            'processingDetails', 'environmentalDetails',
            
            // Boutons
            'processButton', 'resetButton'
        ];

        // Charger tous les éléments
        elementIds.forEach(id => {
            this.safeGetElement(id);
        });

        // Vérifier les éléments critiques
        const criticalElements = ['dropzone', 'fileInput', 'templatesPanel'];
        const missingCritical = criticalElements.filter(id => !this.elements[id]);

        if (missingCritical.length > 0) {
            throw new Error(`Éléments critiques manquants: ${missingCritical.join(', ')}`);
        }

        this.initialized = true;
        console.log('✅ DOM Manager initialisé avec succès');
        return true;
    }

    /**
     * Récupère un élément initialisé
     */
    get(id) {
        if (!this.initialized) {
            console.warn('⚠️ DOM Manager non initialisé');
            return this.safeGetElement(id);
        }
        return this.elements[id] || null;
    }

    /**
     * Ajoute une classe avec vérification
     */
    addClass(elementId, className) {
        const element = this.get(elementId);
        if (element) {
            element.classList.add(className);
            return true;
        }
        return false;
    }

    /**
     * Retire une classe avec vérification
     */
    removeClass(elementId, className) {
        const element = this.get(elementId);
        if (element) {
            element.classList.remove(className);
            return true;
        }
        return false;
    }

    /**
     * Toggle une classe avec vérification
     */
    toggleClass(elementId, className) {
        const element = this.get(elementId);
        if (element) {
            element.classList.toggle(className);
            return true;
        }
        return false;
    }

    /**
     * Définit le contenu texte de manière sécurisée
     */
    setText(elementId, text) {
        const element = this.get(elementId);
        if (element) {
            element.textContent = text;
            return true;
        }
        return false;
    }

    /**
     * Définit le HTML de manière sécurisée
     */
    setHTML(elementId, html) {
        const element = this.get(elementId);
        if (element) {
            element.innerHTML = html;
            return true;
        }
        return false;
    }

    /**
     * Récupère la valeur d'un input de manière sécurisée
     */
    getValue(elementId) {
        const element = this.get(elementId);
        return element ? element.value : null;
    }

    /**
     * Définit la valeur d'un input de manière sécurisée
     */
    setValue(elementId, value) {
        const element = this.get(elementId);
        if (element) {
            element.value = value;
            return true;
        }
        return false;
    }

    /**
     * Définit un attribut de manière sécurisée
     */
    setAttribute(elementId, attribute, value) {
        const element = this.get(elementId);
        if (element) {
            element.setAttribute(attribute, value);
            return true;
        }
        return false;
    }

    /**
     * Active/désactive un élément
     */
    setDisabled(elementId, disabled) {
        const element = this.get(elementId);
        if (element) {
            element.disabled = disabled;
            return true;
        }
        return false;
    }

    /**
     * Fait défiler vers un élément avec offset
     */
    scrollToElement(elementId, behavior = 'smooth') {
        const element = this.get(elementId);
        if (element) {
            // Ajouter la classe scroll-offset si elle n'existe pas
            element.classList.add('scroll-offset');
            element.scrollIntoView({ 
                behavior, 
                block: 'start' 
            });
            return true;
        }
        return false;
    }

    /**
     * Ajoute un event listener de manière sécurisée
     */
    addEventListener(elementId, event, handler, options = {}) {
        const element = this.get(elementId);
        if (element) {
            element.addEventListener(event, handler, options);
            return true;
        }
        return false;
    }

    /**
     * Ajoute un event listener à tous les éléments correspondant au sélecteur
     */
    addEventListenerToAll(selector, event, handler, options = {}) {
        const elements = this.safeQuerySelectorAll(selector);
        elements.forEach(element => {
            element.addEventListener(event, handler, options);
        });
        return elements.length;
    }

    /**
     * Nettoie les références DOM
     */
    cleanup() {
        this.elements = {};
        this.initialized = false;
        console.log('🧹 DOM Manager nettoyé');
    }
}