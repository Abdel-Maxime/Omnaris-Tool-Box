// Gestionnaire de templates prédéfinis
import { CONFIG } from './config.js';

export class TemplateManager {
    constructor(domManager) {
        this.dom = domManager;
        this.templates = CONFIG.TEMPLATES;
        this.currentTemplate = null;
        
        console.log('🎨 TemplateManager initialisé');
    }

    /**
     * Applique un template aux contrôles de l'interface
     */
    applyTemplate(templateName) {
        const template = this.templates[templateName];
        if (!template) {
            console.warn(`⚠️ Template '${templateName}' non trouvé`);
            return false;
        }

        try {
            this.currentTemplate = templateName;
            
            // Appliquer les paramètres de redimensionnement
            this.applyResizeSettings(template.resize);
            
            // Appliquer les paramètres de recadrage
            this.applyCropSettings(template.crop);
            
            // Appliquer les paramètres de conversion
            this.applyConvertSettings(template.convert);
            
            console.log(`✅ Template '${templateName}' appliqué`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur application template '${templateName}':`, error);
            return false;
        }
    }

    /**
     * Applique les paramètres de redimensionnement
     */
    applyResizeSettings(resizeConfig) {
        if (!resizeConfig) return;

        const enableResize = this.dom.get('enableResize');
        const resizePercentSlider = this.dom.get('resizePercentSlider');
        const resizePercentValue = this.dom.get('resizePercentValue');

        if (enableResize) {
            enableResize.checked = resizeConfig.enabled;
        }

        if (resizeConfig.enabled && resizePercentSlider && resizePercentValue) {
            this.dom.setValue('resizePercentSlider', resizeConfig.percent);
            this.dom.setText('resizePercentValue', resizeConfig.percent + '%');
        }
    }

    /**
     * Applique les paramètres de recadrage
     */
    applyCropSettings(cropConfig) {
        if (!cropConfig) return;

        const enableCrop = this.dom.get('enableCrop');
        
        if (enableCrop) {
            enableCrop.checked = cropConfig.enabled;
        }

        if (cropConfig.enabled) {
            this.dom.setValue('aspectRatio', cropConfig.aspectRatio);
            this.dom.setValue('cropPosition', cropConfig.position);
        }
    }

    /**
     * Applique les paramètres de conversion
     */
    applyConvertSettings(convertConfig) {
        if (!convertConfig) return;

        const enableConvert = this.dom.get('enableConvert');
        
        if (enableConvert) {
            enableConvert.checked = convertConfig.enabled;
        }

        if (convertConfig.enabled) {
            this.dom.setValue('outputFormat', convertConfig.format);
            this.dom.setValue('qualitySlider', convertConfig.quality);
            this.dom.setText('qualityValue', convertConfig.quality + '%');
        }
    }

    /**
     * Récupère la configuration actuelle sous forme de template
     */
    getCurrentConfiguration() {
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
     * Compare la configuration actuelle avec un template
     */
    isTemplateActive(templateName) {
        const template = this.templates[templateName];
        const current = this.getCurrentConfiguration();
        
        if (!template) return false;

        // Comparaison basique des paramètres principaux
        return (
            template.resize.enabled === current.resize.enabled &&
            (!template.resize.enabled || template.resize.percent === current.resize.percent) &&
            template.crop.enabled === current.crop.enabled &&
            (!template.crop.enabled || template.crop.aspectRatio === current.crop.aspectRatio) &&
            template.convert.enabled === current.convert.enabled &&
            (!template.convert.enabled || template.convert.format === current.convert.format)
        );
    }

    /**
     * Génère un nom de fichier basé sur le template actuel
     */
    generateFileName(originalName, index = 0) {
        if (!this.currentTemplate) {
            return this.generateGenericFileName(originalName);
        }

        const template = this.templates[this.currentTemplate];
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        
        // Extension basée sur la conversion
        let extension = 'webp';
        if (template.convert?.enabled) {
            extension = template.convert.format === 'jpeg' ? 'jpg' : template.convert.format;
        } else {
            extension = originalName.split('.').pop().toLowerCase();
        }

        // Suffix du template
        let suffix = template.suffix || '_processed';
        
        // Gestion spéciale pour Instagram (multi-format)
        if (this.currentTemplate === 'instagram' && template.multiFormat) {
            // Pour l'instant, utiliser le premier format
            // Dans une version complète, on traiterait chaque format séparément
            suffix = template.multiFormat[0].suffix;
        }

        // Dimensions estimées pour certains templates
        let dimensions = '';
        if (template.crop?.enabled) {
            const ratio = template.crop.aspectRatio;
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
     * Génère un nom de fichier générique
     */
    generateGenericFileName(originalName) {
        const current = this.getCurrentConfiguration();
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        
        // Extension
        let extension = 'webp';
        if (current.convert.enabled) {
            extension = current.convert.format === 'jpeg' ? 'jpg' : current.convert.format;
        } else {
            extension = originalName.split('.').pop().toLowerCase();
        }

        // Suffix basé sur les actions
        const actions = [];
        if (current.resize.enabled) {
            actions.push(`${current.resize.percent}pct`);
        }
        if (current.crop.enabled) {
            actions.push(current.crop.aspectRatio.replace('/', 'x'));
        }
        if (current.convert.enabled) {
            actions.push(extension);
        }

        const suffix = actions.length > 0 ? `_${actions.join('_')}` : '_optimized';
        
        return `${baseName}${suffix}.${extension}`;
    }

    /**
     * Crée un template personnalisé basé sur la configuration actuelle
     */
    createCustomTemplate(name) {
        const config = this.getCurrentConfiguration();
        
        const customTemplate = {
            name: name,
            resize: config.resize,
            crop: config.crop,
            convert: config.convert,
            suffix: `_${name.toLowerCase().replace(/\s+/g, '_')}`,
            custom: true,
            created: new Date().toISOString()
        };

        return customTemplate;
    }

    /**
     * Valide qu'un template est correctement formé
     */
    validateTemplate(template) {
        const errors = [];

        if (!template.name) {
            errors.push('Nom du template manquant');
        }

        if (!template.resize || typeof template.resize.enabled !== 'boolean') {
            errors.push('Configuration resize invalide');
        }

        if (!template.crop || typeof template.crop.enabled !== 'boolean') {
            errors.push('Configuration crop invalide');
        }

        if (!template.convert || typeof template.convert.enabled !== 'boolean') {
            errors.push('Configuration convert invalide');
        }

        // Validations spécifiques
        if (template.resize.enabled && (!template.resize.percent || template.resize.percent < 10 || template.resize.percent > 200)) {
            errors.push('Pourcentage de redimensionnement invalide (10-200%)');
        }

        if (template.convert.enabled && (!template.convert.format || !['webp', 'jpeg', 'png'].includes(template.convert.format))) {
            errors.push('Format de conversion invalide');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Estime les performances d'un template
     */
    estimateTemplatePerformance(templateName, filesCount = 1, avgFileSize = 1024 * 1024) {
        const template = this.templates[templateName];
        if (!template) return null;

        let complexity = 1; // Score de complexité de base
        let timeMultiplier = 1;

        // Facteurs de complexité
        if (template.resize?.enabled) {
            complexity += 0.3;
            const percent = template.resize.percent / 100;
            timeMultiplier *= percent > 1 ? 1.2 : 0.8; // Agrandissement plus lent
        }

        if (template.crop?.enabled) {
            complexity += 0.4;
        }

        if (template.convert?.enabled) {
            complexity += 0.5;
            // WebP plus rapide que les autres formats
            if (template.convert.format === 'webp') {
                timeMultiplier *= 0.9;
            } else if (template.convert.format === 'png') {
                timeMultiplier *= 1.3;
            }
        }

        // Estimation du temps (en secondes)
        const baseTimePerImage = 0.5;
        const estimatedTimePerImage = baseTimePerImage * complexity * timeMultiplier;
        const totalTime = estimatedTimePerImage * filesCount;

        // Estimation de l'économie d'espace
        let spaceSaving = 0;
        if (template.resize?.enabled) {
            const scale = template.resize.percent / 100;
            spaceSaving += (1 - Math.pow(scale, 2)) * 100;
        }
        if (template.convert?.enabled) {
            if (template.convert.format === 'webp') {
                spaceSaving += 25; // WebP économise ~25% en moyenne
            } else if (template.convert.format === 'jpeg') {
                spaceSaving += 15; // JPEG économise ~15% vs PNG
            }
        }

        return {
            complexity,
            estimatedTime: totalTime,
            spaceSaving: Math.min(spaceSaving, 85), // Max 85% d'économie
            performance: complexity > 2 ? 'intensive' : complexity > 1.5 ? 'moderate' : 'light'
        };
    }

    /**
     * Récupère la liste des templates disponibles avec leurs informations
     */
    getAvailableTemplates() {
        return Object.entries(this.templates).map(([key, template]) => ({
            key,
            name: template.name,
            description: this.generateTemplateDescription(template),
            performance: this.estimateTemplatePerformance(key),
            isActive: this.isTemplateActive(key)
        }));
    }

    /**
     * Génère une description textuelle d'un template
     */
    generateTemplateDescription(template) {
        const parts = [];
        
        if (template.resize?.enabled) {
            parts.push(`Redim: ${template.resize.percent}%`);
        }
        
        if (template.crop?.enabled) {
            parts.push(`Format: ${template.crop.aspectRatio}`);
        }
        
        if (template.convert?.enabled) {
            parts.push(`${template.convert.format.toUpperCase()} ${template.convert.quality}%`);
        }

        return parts.join(' • ') || 'Configuration de base';
    }

    /**
     * Réinitialise le template actuel
     */
    clearCurrentTemplate() {
        this.currentTemplate = null;
        console.log('🔄 Template actuel effacé');
    }

    /**
     * Récupère des statistiques sur l'utilisation des templates
     */
    getStats() {
        return {
            availableTemplates: Object.keys(this.templates).length,
            currentTemplate: this.currentTemplate,
            templatesWithMultiFormat: Object.values(this.templates).filter(t => t.multiFormat).length
        };
    }
}