/**
 * @file Service for managing dialog minimize/restore functionality.
 * @module services/MinimizeService
 * @description Provides a service for managing the minimize state
 * of the main toolkit dialog with proper animation handling and state management.
 */

import { Store } from '../core/Store.js';
import { ICONS } from '../assets/Icons.js';
import { MINIMIZE_SERVICE } from '../constants/index.js';
import { NotificationService } from './NotificationService.js';

/**
 * Service for managing dialog minimize/restore functionality.
 * @namespace
 */
export const MinimizeService = {
    /**
     * Reference to the main dialog element.
     * @private
     * @type {HTMLElement|null}
     */
    _dialogElement: null,

    /**
     * Reference to the minimize button element.
     * @private
     * @type {HTMLElement|null}
     */
    _minimizeButton: null,

    /**
     * Bound toggle function for event listener cleanup.
     * @private
     * @type {Function|null}
     */
    _boundToggle: null,

    /**
     * Bound keyboard handler function for event listener cleanup.
     * @private
     * @type {Function|null}
     */
    _boundKeyHandler: null,

    /**
     * Flag to prevent multiple animations running simultaneously.
     * @private
     * @type {boolean}
     */
    _isAnimating: false,

    /**
     * Initializes the MinimizeService with the dialog element.
     * Sets up event listeners for both button clicks and keyboard shortcuts.
     * @param {HTMLElement} dialogElement - The main dialog element.
     * @returns {void}
     */
    init(dialogElement) {
        if (!dialogElement) {
            NotificationService.show(MINIMIZE_SERVICE.messages.initFailed, 'warn');
            return;
        }

        this._dialogElement = dialogElement;
        this._minimizeButton = dialogElement.querySelector('.pdt-minimize-btn');

        if (this._minimizeButton) {
            // Set initial tooltip and add event listener
            this._minimizeButton.title = MINIMIZE_SERVICE.tooltip.minimize;
            this._boundToggle = this.toggle.bind(this);
            this._minimizeButton.addEventListener('click', this._boundToggle);
        } else {
            NotificationService.show(MINIMIZE_SERVICE.messages.buttonNotFound, 'warn');
        }

        // Add keyboard shortcut (Ctrl/Cmd + M)
        this._boundKeyHandler = this._handleKeyPress.bind(this);
        document.addEventListener('keydown', this._boundKeyHandler);

        // Apply initial state asynchronously to ensure DOM is ready
        requestAnimationFrame(() => {
            const isMinimized = Store.getState().isMinimized;
            if (isMinimized) {
                this._applyMinimizedState(false); // No animation on init
                this._updateButtonState(true);
            }
        });
    },

    /**
     * Toggles between minimized and restored states.
     * Validates state before toggling to prevent unexpected behavior.
     * @returns {Promise<void>}
     */
    async toggle() {
        if (this._isAnimating) {
            return;
        }

        if (!this._dialogElement) {
            NotificationService.show(MINIMIZE_SERVICE.messages.initFailed, 'warn');
            return;
        }

        const currentState = Store.getState().isMinimized;

        // Type check for safety
        if (typeof currentState !== 'boolean') {
            console.warn('MinimizeService: Invalid minimized state', currentState);
            Store.setState({ isMinimized: false }); // Reset to known state
            return;
        }

        if (currentState) {
            await this.restore();
        } else {
            await this.minimize();
        }
    },

    /**
     * Minimizes the dialog to show only the header.
     * Updates state, applies visual changes with animation, and handles errors gracefully.
     * If an error occurs, the state is rolled back to prevent inconsistent UI state.
     * @returns {Promise<void>}
     */
    async minimize() {
        if (this._isAnimating || !this._dialogElement) {
            return;
        }

        this._isAnimating = true;

        try {
            Store.setState({ isMinimized: true });
            await this._applyMinimizedState(true);
            this._updateButtonState(true);

        } catch (error) {
            NotificationService.show(MINIMIZE_SERVICE.messages.minimizeFailed, 'error');
            console.error('MinimizeService: Minimize failed', error);

            Store.setState({ isMinimized: false });
        } finally {
            this._isAnimating = false;
        }
    },

    /**
     * Restores the dialog from minimized state to full view.
     * Updates state, removes minimized class, adjusts position, and handles errors gracefully.
     * If an error occurs, the state is rolled back to prevent inconsistent UI state.
     * @returns {Promise<void>}
     */
    async restore() {
        if (this._isAnimating || !this._dialogElement) {
            return;
        }

        this._isAnimating = true;

        try {
            Store.setState({ isMinimized: false });
            await this._applyRestoredState(true);
            this._updateButtonState(false);

        } catch (error) {
            NotificationService.show(MINIMIZE_SERVICE.messages.restoreFailed, 'error');
            console.error('MinimizeService: Restore failed', error);

            Store.setState({ isMinimized: true });
        } finally {
            this._isAnimating = false;
        }
    },

    /**
     * Applies the minimized visual state to the dialog.
     * Adds the minimized CSS class and optionally waits for the animation to complete.
     * @private
     * @param {boolean} [animate=true] - Whether to animate the transition.
     * @returns {Promise<void>} Resolves when animation completes (if animated).
     */
    async _applyMinimizedState(animate = true) {
        if (!this._dialogElement) {
            return;
        }

        this._dialogElement.classList.add(MINIMIZE_SERVICE.classes.minimized);

        if (animate) {
            await this._waitForTransition();
        }
    },

    /**
     * Applies the restored visual state to the dialog.
     * Removes the minimized CSS class, adjusts viewport position, and optionally animates.
     * @private
     * @param {boolean} [animate=true] - Whether to animate the transition.
     * @returns {Promise<void>} Resolves when animation completes (if animated).
     */
    async _applyRestoredState(animate = true) {
        if (!this._dialogElement) {
            return;
        }

        this._dialogElement.classList.remove(MINIMIZE_SERVICE.classes.minimized);
        this._adjustPositionToViewport();

        if (animate) {
            await this._waitForTransition();
        }
    },

    /**
     * Adjusts dialog position to ensure it stays within viewport bounds.
     * Prevents dialog from flowing off-screen when restoring from minimized state.
     * Uses margin constant to maintain consistent spacing from viewport edges.
     * @private
     * @returns {void}
     */
    _adjustPositionToViewport() {
        if (!this._dialogElement) {
            return;
        }

        const rect = this._dialogElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = MINIMIZE_SERVICE.viewport.margin;

        let adjustedLeft = parseInt(this._dialogElement.style.left) || rect.left;
        let adjustedTop = parseInt(this._dialogElement.style.top) || rect.top;
        let needsAdjustment = false;

        // Check if dialog extends beyond right edge
        if (rect.right > viewportWidth) {
            adjustedLeft = viewportWidth - rect.width - margin;
            needsAdjustment = true;
        }

        // Check if dialog extends beyond bottom edge
        if (rect.bottom > viewportHeight) {
            adjustedTop = viewportHeight - rect.height - margin;
            needsAdjustment = true;
        }

        // Ensure dialog doesn't go off left edge
        if (adjustedLeft < margin) {
            adjustedLeft = margin;
            needsAdjustment = true;
        }

        // Ensure dialog doesn't go off top edge
        if (adjustedTop < margin) {
            adjustedTop = margin;
            needsAdjustment = true;
        }

        // Apply adjustments if needed
        if (needsAdjustment) {
            this._dialogElement.style.left = `${adjustedLeft}px`;
            this._dialogElement.style.top = `${adjustedTop}px`;
        }
    },

    /**
     * Handles keyboard shortcut for toggling minimize state.
     * Responds to Ctrl/Cmd + M key combination.
     * @private
     * @param {KeyboardEvent} e - The keyboard event object.
     * @returns {void}
     */
    _handleKeyPress(e) {
        const config = MINIMIZE_SERVICE.keyboard;
        const hasModifier = config.modifiers.some(modifier => e[modifier]);

        if (hasModifier && e.key.toLowerCase() === config.shortcut) {
            e.preventDefault();
            this.toggle();
        }
    },

    /**
     * Updates the minimize button's icon and tooltip based on current state.
     * Changes between minimize and restore icons accordingly.
     * @private
     * @param {boolean} isMinimized - The current minimized state.
     * @returns {void}
     */
    _updateButtonState(isMinimized) {
        if (!this._minimizeButton) {
            return;
        }

        if (isMinimized) {
            this._minimizeButton.innerHTML = ICONS.restore;
            this._minimizeButton.title = MINIMIZE_SERVICE.tooltip.restore;
        } else {
            this._minimizeButton.innerHTML = ICONS.minimize;
            this._minimizeButton.title = MINIMIZE_SERVICE.tooltip.minimize;
        }
    },

    /**
     * Waits for CSS transitions to complete.
     * Uses transitionend event for accurate timing with a timeout fallback
     * to ensure the promise always resolves even if the event doesn't fire.
     * @private
     * @returns {Promise<void>} Resolves when transition completes or times out.
     */
    _waitForTransition() {
        return new Promise(resolve => {
            if (!this._dialogElement) {
                resolve();
                return;
            }

            const duration = MINIMIZE_SERVICE.animation.duration;
            let resolved = false;

            // Listen for actual transition end event
            const handleTransitionEnd = (e) => {
                if (e.target === this._dialogElement && !resolved) {
                    resolved = true;
                    this._dialogElement.removeEventListener('transitionend', handleTransitionEnd);
                    resolve();
                }
            };

            this._dialogElement.addEventListener('transitionend', handleTransitionEnd);

            // Fallback timeout in case transition event doesn't fire
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this._dialogElement.removeEventListener('transitionend', handleTransitionEnd);
                    resolve();
                }
            }, duration + 50); // Add 50ms buffer
        });
    },

    /**
     * Cleans up the service by removing all event listeners and references.
     * Prevents memory leaks by ensuring all listeners are properly removed.
     * @returns {void}
     */
    destroy() {
        if (this._minimizeButton && this._boundToggle) {
            this._minimizeButton.removeEventListener('click', this._boundToggle);
        }

        if (this._boundKeyHandler) {
            document.removeEventListener('keydown', this._boundKeyHandler);
        }

        this._dialogElement = null;
        this._minimizeButton = null;
        this._boundToggle = null;
        this._boundKeyHandler = null;
        this._isAnimating = false;
    }
};