/**
 * @file Handles the display of toast notifications.
 * @module services/NotificationService
 * @description A simple, dependency-free service to show temporary, non-blocking messages to the user.
 */

/** @private @type {HTMLElement|null} A persistent container for all notifications. */
let _notificationContainer = null;

/**
 * Creates the notification container if it doesn't exist and appends it to the body.
 * @returns {HTMLElement} The notification container element.
 * @private
 */
function _getOrCreateContainer() {
    if (!_notificationContainer) {
        _notificationContainer = document.createElement('div');
        Object.assign(_notificationContainer.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            padding: '20px',
            zIndex: '10002',
            pointerEvents: 'none' // Allow clicks to pass through the container
        });
        document.body.appendChild(_notificationContainer);
    }
    return _notificationContainer;
}

/**
 * Provides a method to show toast-style notifications.
 * @namespace
 */
export const NotificationService = {
    /**
     * Displays a notification message at the bottom of the screen.
     * Multiple notifications will stack vertically.
     * @param {string} message - The text to display.
     * @param {'info' | 'success' | 'warn' | 'error'} [type='info'] - The type of notification, which determines its color.
     * @param {number} [duration=3500] - The time in milliseconds to display the notification.
     * @returns {void}
     */
    show(message, type = 'info', duration = 3500) {
        const container = _getOrCreateContainer();
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.setAttribute('role', 'alert');

        const colors = {
            success: 'var(--pro-success)',
            error: 'var(--pro-error)',
            warn: 'var(--pro-warn)',
            info: '#333333'
        };

        Object.assign(notification.style, {
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontFamily: `"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif`,
            fontSize: '14px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            backgroundColor: colors[type] || colors.info,
            transition: 'opacity 0.5s, transform 0.5s',
            opacity: '0',
            transform: 'translateY(20px)',
            pointerEvents: 'auto' // Re-enable pointer events for the notification itself
        });

        container.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);

        // Animate out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(20px)';
            setTimeout(() => notification.remove(), 500); // Remove after transition
        }, duration);
    }
};