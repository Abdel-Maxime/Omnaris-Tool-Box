// Gestionnaire de l'interface utilisateur
import { CONFIG } from './config.js';
import { 
    formatFileSize, 
    formatTime, 
    estimateFileSavings, 
    calculatePerformanceScore 
} from './utils.js';

export class UIManager {
    constructor(domManager) {
        this.dom = domManager;
        this.messageQueue = [];
        this.isProcessingMessages = false;
        
        console.log('🎨 UIManager initialisé');
    }

    /**
     * Affiche un message à l'utilisateur
     */
    showMessage(message, type = 'info', duration = CONFIG.UI.MESSAGE_DISPLAY_TIME) {
        this.messageQueue.push({ message, type, duration });
        this.processMessageQueue();
    }

    /**
     * Traite la file d'attente des messages
     */
    async processMessageQueue() {
        if (this.isProcessingMessages || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingMessages = true;
        const messageContainer = this.dom.get('messageContainer');
        
        if (!messageContainer) {
            this.isProcessingMessages = false;
            return;
        }

        while (this.messageQueue.length > 0) {
            const { message, type, duration } = this.messageQueue.shift();
            await this.displayMessage(messageContainer, message, type, duration);
        }

        this.isProcessingMessages = false;
    }

    /**
     * Affiche un message individuel
     */
    displayMessage(container, message, type, duration) {
        return new Promise((resolve) => {
            const messageEl = document.createElement('div');
            messageEl.className = `message message-${type}`;
            messageEl.textContent = message;
            container.appendChild(messageEl);

            // Auto-suppression
            setTimeout(() => {
                messageEl.style.opacity = '0';
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.remove();
                    }
                    resolve();
                }, 300);
            }, duration);
        });
    }

    /**
     * Met à jour les estimations d'économies
     */
    updateSavingsEstimate(selectedFiles) {
        if (!selectedFiles || selectedFiles.length === 0) {
            this.clearSavingsEstimate();
            return;
        }

        const totalCurrentSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        let estimatedTotalSize = 0;
        const breakdown = {
            resize: 0,
            crop: 0,
            compression: 0
        };

        // Calcul des estimations pour chaque fichier
        selectedFiles.forEach(file => {
            const settings = this.getCurrentSettings();
            const estimates = estimateFileSavings(file, settings, CONFIG.COMPRESSION_FACTORS);
            estimatedTotalSize += estimates.estimatedSize;
            breakdown.resize += estimates.breakdown.resize;
            breakdown.crop += estimates.breakdown.crop;
            breakdown.compression += estimates.breakdown.compression;
        });

        // Mise à jour de l'affichage
        this.dom.setText('currentSize', formatFileSize(totalCurrentSize));
        this.dom.setText('estimatedSize', formatFileSize(estimatedTotalSize));
        
        const totalSavings = totalCurrentSize - estimatedTotalSize;
        const savingsPercentValue = ((totalSavings / totalCurrentSize) * 100).toFixed(1);
        
        this.dom.setText('savings', formatFileSize(Math.max(0, totalSavings)));
        this.dom.setText('savingsPercent', `${savingsPercentValue}% d'économie`);
        
        // Mise à jour des barres de progression
        this.updateSavingsBreakdown(breakdown, totalSavings);
        
        // Impact environnemental
        const carbonSavings = (totalSavings / (1024 * 1024)) * CONFIG.CO2_FACTOR_PER_MB;
        this.dom.setText('carbonSaved', `${carbonSavings.toFixed(1)} g CO₂`);
        
        // Couleurs dynamiques selon l'économie
        this.updateSavingsColors(savingsPercentValue);
    }

    /**
     * Met à jour les couleurs selon le pourcentage d'économies
     */
    updateSavingsColors(savingsPercent) {
        const savingsEl = this.dom.get('savings');
        const savingsPercentEl = this.dom.get('savingsPercent');
        
        if (!savingsEl || !savingsPercentEl) return;

        if (savingsPercent > 30) {
            savingsEl.className = 'text-lg font-bold text-green-600';
            savingsPercentEl.className = 'text-xs text-green-500 mt-1';
        } else if (savingsPercent > 10) {
            savingsEl.className = 'text-lg font-bold text-blue-600';
            savingsPercentEl.className = 'text-xs text-blue-500 mt-1';
        } else {
            savingsEl.className = 'text-lg font-bold text-orange-600';
            savingsPercentEl.className = 'text-xs text-orange-500 mt-1';
        }
    }

    /**
     * Met à jour la répartition des économies
     */
    updateSavingsBreakdown(breakdown, totalSavings) {
        const maxSaving = Math.max(breakdown.resize, breakdown.crop, breakdown.compression);
        
        // Redimensionnement
        if (breakdown.resize > 0) {
            const percent = maxSaving > 0 ? (breakdown.resize / maxSaving) * 100 : 0;
            this.dom.setAttribute('resizeSavingsBar', 'style', `width: ${percent}%`);
            this.dom.setText('resizeSavingsText', formatFileSize(breakdown.resize));
        } else {
            this.dom.setAttribute('resizeSavingsBar', 'style', 'width: 0%');
            this.dom.setText('resizeSavingsText', '-');
        }
        
        // Recadrage
        if (breakdown.crop > 0) {
            const percent = maxSaving > 0 ? (breakdown.crop / maxSaving) * 100 : 0;
            this.dom.setAttribute('cropSavingsBar', 'style', `width: ${percent}%`);
            this.dom.setText('cropSavingsText', formatFileSize(breakdown.crop));
        } else {
            this.dom.setAttribute('cropSavingsBar', 'style', 'width: 0%');
            this.dom.setText('cropSavingsText', '-');
        }
        
        // Compression
        if (breakdown.compression > 0) {
            const percent = maxSaving > 0 ? (breakdown.compression / maxSaving) * 100 : 0;
            this.dom.setAttribute('compressionSavingsBar', 'style', `width: ${percent}%`);
            this.dom.setText('compressionSavingsText', formatFileSize(breakdown.compression));
        } else {
            this.dom.setAttribute('compressionSavingsBar', 'style', 'width: 0%');
            this.dom.setText('compressionSavingsText', '-');
        }
    }

    /**
     * Efface les estimations d'économies
     */
    clearSavingsEstimate() {
        this.dom.setText('currentSize', '--');
        this.dom.setText('estimatedSize', '--');
        this.dom.setText('savings', '--');
        this.dom.setText('savingsPercent', '--');
        this.dom.setText('carbonSaved', '-- g CO₂');
        
        // Reset des barres
        this.dom.setAttribute('resizeSavingsBar', 'style', 'width: 0%');
        this.dom.setAttribute('cropSavingsBar', 'style', 'width: 0%');
        this.dom.setAttribute('compressionSavingsBar', 'style', 'width: 0%');
        
        this.dom.setText('resizeSavingsText', '-');
        this.dom.setText('cropSavingsText', '-');
        this.dom.setText('compressionSavingsText', '-');
    }

    /**
     * Met à jour les recommandations intelligentes
     */
    updateRecommendations(selectedFiles) {
        const recommendationsList = this.dom.get('recommendationsList');
        if (!recommendationsList) return;

        if (!selectedFiles || selectedFiles.length === 0) {
            recommendationsList.innerHTML = '<p class="text-gray-600">Sélectionnez des images pour voir les recommandations...</p>';
            return;
        }

        const recommendations = this.generateRecommendations(selectedFiles);
        let html = '';

        recommendations.forEach(rec => {
            const iconColor = rec.priority === 'high' ? 'text-red-500' : 
                            rec.priority === 'medium' ? 'text-yellow-500' : 'text-blue-500';
            html += `
                <div class="flex items-start space-x-2">
                    <svg class="w-4 h-4 ${iconColor} mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    <span class="text-gray-700">${rec.message}</span>
                </div>
            `;
        });

        recommendationsList.innerHTML = html;
    }

    /**
     * Génère les recommandations intelligentes
     */
    generateRecommendations(selectedFiles) {
        const recommendations = [];
        const settings = this.getCurrentSettings();
        
        if (selectedFiles.length === 0) return recommendations;

        // Analyser les types de fichiers
        const fileTypes = selectedFiles.map(f => f.type.split('/')[1]);
        const hasPNG = fileTypes.includes('png');
        const hasJPEG = fileTypes.includes('jpeg');
        const avgSize = selectedFiles.reduce((sum, f) => sum + f.size, 0) / selectedFiles.length;

        // Recommandations de format
        if (hasPNG && !settings.convert?.enabled) {
            recommendations.push({
                priority: 'high',
                message: 'Convertissez vos PNG en WebP pour économiser jusqu\'à 50% d\'espace !'
            });
        }

        if (hasJPEG && settings.convert?.format !== 'webp') {
            recommendations.push({
                priority: 'medium',
                message: 'Le format WebP offre une meilleure compression que JPEG sans perte visible.'
            });
        }

        // Recommandations de qualité
        const quality = settings.convert?.quality || 90;
        if (quality > 90) {
            recommendations.push({
                priority: 'medium',
                message: 'Une qualité de 85-90% est généralement suffisante et réduit significativement la taille.'
            });
        }

        // Recommandations de redimensionnement
        if (avgSize > 2 * 1024 * 1024 && !settings.resize?.enabled) { // > 2MB
            recommendations.push({
                priority: 'high',
                message: 'Vos images sont volumineuses. Réduisez leur taille de 20-30% pour un web plus rapide.'
            });
        }

        // Recommandations de recadrage
        if (selectedFiles.length > 1 && !settings.crop?.enabled) {
            recommendations.push({
                priority: 'low',
                message: 'Standardisez vos formats avec le recadrage pour une présentation uniforme.'
            });
        }

        // Score de performance
        const score = this.calculateCurrentPerformanceScore();
        if (score < 70) {
            recommendations.push({
                priority: 'high',
                message: `Score d'optimisation: ${score}/100. Activez plus d'options pour améliorer les performances.`
            });
        } else if (score >= 85) {
            recommendations.push({
                priority: 'low',
                message: `Excellent ! Score d'optimisation: ${score}/100. Configuration optimale détectée.`
            });
        }

        return recommendations;
    }

    /**
     * Calcule le score de performance actuel
     */
    calculateCurrentPerformanceScore() {
        const settings = this.getCurrentSettings();
        return calculatePerformanceScore(settings);
    }

    /**
     * Met à jour l'estimation de performance
     */
    updatePerformanceEstimate(selectedFiles) {
        const performanceEstimate = this.dom.get('performanceEstimate');
        if (!performanceEstimate || !selectedFiles || selectedFiles.length === 0) return;
        
        let estimatedTime = selectedFiles.length * 0.5; // Base: 0.5s par image
        const settings = this.getCurrentSettings();
        
        if (settings.resize?.enabled) {
            const scale = settings.resize.percent / 100;
            estimatedTime += selectedFiles.length * 0.2 * (1 / scale);
        }
        
        if (settings.crop?.enabled) {
            estimatedTime += selectedFiles.length * 0.3;
        }
        
        if (settings.convert?.enabled) {
            estimatedTime += selectedFiles.length * 0.4;
        }
        
        performanceEstimate.textContent = `Temps estimé: ~${formatTime(estimatedTime * 1000)}`;
    }

    /**
     * Met à jour l'état des actions (activer/désactiver les contrôles)
     */
    updateActionStates() {
        const enableResize = this.dom.get('enableResize');
        const enableCrop = this.dom.get('enableCrop');
        const enableConvert = this.dom.get('enableConvert');

        // Activer/désactiver les options selon les checkboxes
        const resizeEnabled = enableResize?.checked || false;
        const cropEnabled = enableCrop?.checked || false;
        const convertEnabled = enableConvert?.checked || false;

        // Redimensionnement
        const resizeOptions = this.dom.get('resizeOptions');
        if (resizeOptions) {
            resizeOptions.style.opacity = resizeEnabled ? '1' : '0.5';
            resizeOptions.style.pointerEvents = resizeEnabled ? 'auto' : 'none';
        }
        
        // Recadrage
        const cropOptions = this.dom.get('cropOptions');
        if (cropOptions) {
            cropOptions.style.opacity = cropEnabled ? '1' : '0.5';
            cropOptions.style.pointerEvents = cropEnabled ? 'auto' : 'none';
        }
        
        // Conversion
        const convertOptions = this.dom.get('convertOptions');
        if (convertOptions) {
            convertOptions.style.opacity = convertEnabled ? '1' : '0.5';
            convertOptions.style.pointerEvents = convertEnabled ? 'auto' : 'none';
        }

        // Bouton de traitement
        const hasActions = resizeEnabled || cropEnabled || convertEnabled;
        this.dom.setDisabled('processButton', !hasActions);
    }

    /**
     * Affiche un résumé d'erreurs
     */
    showErrorSummary(errors) {
        if (!errors || errors.length === 0) return;
        
        const errorsList = this.dom.get('errorsList');
        const errorsContent = this.dom.get('errorsContent');
        
        if (!errorsList || !errorsContent) return;

        this.dom.removeClass('errorsList', 'hidden');
        
        let html = '';
        errors.forEach(error => {
            html += `<li>${error.file}: ${error.message}</li>`;
        });
        
        errorsContent.innerHTML = html;
        this.showMessage(`${errors.length} erreur(s) rencontrée(s)`, 'error');
    }

    /**
     * Masque la liste des erreurs
     */
    hideErrorSummary() {
        this.dom.addClass('errorsList', 'hidden');
        this.dom.setHTML('errorsContent', '');
    }

    /**
     * Met à jour les statistiques finales dans l'écran de résultats
     */
    updateFinalResults(results) {
        if (!results) return;

        this.dom.setText('finalImagesProcessed', results.processedCount);
        this.dom.setText('finalSavingsAmount', formatFileSize(results.savings));
        this.dom.setText('finalSavingsPercent', results.savingsPercent + '%');
        this.dom.setText('finalCarbonSaved', results.carbonSaved.toFixed(1) + 'g');
    }

    /**
     * Récupère la configuration actuelle des contrôles
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
     * Affiche une notification toast
     */
    showToast(message, type = 'info', duration = 3000) {
        // Créer un toast séparé des messages normaux
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white transition-all duration-300 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animation d'entrée
        setTimeout(() => toast.style.transform = 'translateY(0)', 10);
        
        // Auto-suppression
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Met à jour la barre de progression
     */
    updateProgress(current, total, text, startTime = null) {
        const percent = Math.round((current / total) * 100);
        
        this.dom.setAttribute('progressBar', 'style', `width: ${percent}%; transition: width 0.3s ease`);
        this.dom.setAttribute('progressBar', 'aria-valuenow', percent);
        this.dom.setText('progressText', text);
        this.dom.setText('progressPercent', percent + '%');

        // Calculer le temps restant
        if (startTime && current > 0) {
            const elapsed = Date.now() - startTime;
            const timePerItem = elapsed / current;
            const remaining = timePerItem * (total - current);
            this.dom.setText('timeRemaining', `Temps restant: ${formatTime(remaining)}`);
        } else {
            this.dom.setText('timeRemaining', '');
        }
    }

    /**
     * Réinitialise la barre de progression
     */
    resetProgress() {
        this.dom.setAttribute('progressBar', 'style', 'width: 0%');
        this.dom.setAttribute('progressBar', 'aria-valuenow', '0');
        this.dom.setText('progressText', 'Initialisation...');
        this.dom.setText('progressPercent', '0%');
        this.dom.setText('timeRemaining', '');
    }

    /**
     * Efface tous les messages en cours
     */
    clearAllMessages() {
        const messageContainer = this.dom.get('messageContainer');
        if (messageContainer) {
            messageContainer.innerHTML = '';
        }
        this.messageQueue = [];
    }

    /**
     * Récupère des statistiques sur l'UI
     */
    getStats() {
        return {
            messagesInQueue: this.messageQueue.length,
            isProcessingMessages: this.isProcessingMessages,
            currentSettings: this.getCurrentSettings(),
            performanceScore: this.calculateCurrentPerformanceScore()
        };
    }
}