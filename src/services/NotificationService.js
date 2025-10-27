/**
 * @file Handles the display of toast notifications.
 * @module services/NotificationService
 * @description A simple, dependency-free service to show temporary, non-blocking messages to the user.
 */

import { Config } from '../constants/index.js';

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
        _notificationContainer.id = Config.NOTIFICATION_CONTAINER_ID;
        Object.assign(_notificationContainer.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: Config.NOTIFICATION_STYLES.gap,
            padding: Config.NOTIFICATION_STYLES.padding,
            zIndex: Config.NOTIFICATION_STYLES.zIndex,
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
     * @param {number} [duration] - The time in milliseconds to display the notification.
     * @returns {void}
     */
    show(message, type = 'info', duration = Config.NOTIFICATION_TIMINGS.duration) {
        const container = _getOrCreateContainer();
        const notification = document.createElement('div');

        // Format message: convert \r\n to <br>, preserve whitespace
        const formattedMessage = String(message || '')
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, '<br>');

        notification.innerHTML = formattedMessage;
        notification.setAttribute('role', 'alert');

        // For error messages with line breaks, make them larger and increase duration
        const hasLineBreaks = formattedMessage.includes('<br>');
        const isLongMessage = message.length > 150;
        const isError = type === 'error';

        // Automatically increase duration for long error messages
        let adjustedDuration = duration;
        if (isError && (hasLineBreaks || isLongMessage)) {
            // Calculate duration based on message length (min 8s, max 30s)
            adjustedDuration = Math.min(Math.max(8000, message.length * 50), 30000);
        }

        Object.assign(notification.style, {
            padding: hasLineBreaks ? '16px 24px' : '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontFamily: `"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif`,
            fontSize: '14px',
            lineHeight: '1.5',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            backgroundColor: Config.NOTIFICATION_COLORS[type] || Config.NOTIFICATION_COLORS.info,
            transition: 'opacity 0.5s, transform 0.5s',
            opacity: '0',
            transform: 'translateY(20px)',
            pointerEvents: 'auto',
            cursor: isError ? 'pointer' : 'default',
            maxWidth: hasLineBreaks ? '600px' : '400px',
            textAlign: 'left',
            whiteSpace: 'normal',
            wordBreak: 'break-word'
        });

        // Add close button for errors
        if (isError) {
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '&times;';
            closeBtn.setAttribute('title', 'Click to dismiss');
            Object.assign(closeBtn.style, {
                position: 'absolute',
                top: '8px',
                right: '12px',
                fontSize: '20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                opacity: '0.7',
                transition: 'opacity 0.2s'
            });
            closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
            closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.7');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(20px)';
                setTimeout(() => notification.remove(), Config.NOTIFICATION_TIMINGS.fadeOut);
            });

            notification.style.position = 'relative';
            notification.style.paddingRight = '40px';
            notification.appendChild(closeBtn);

            // Click to dismiss
            notification.addEventListener('click', () => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(20px)';
                setTimeout(() => notification.remove(), Config.NOTIFICATION_TIMINGS.fadeOut);
            });
            notification.setAttribute('title', 'Click to dismiss');
        }

        container.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, Config.NOTIFICATION_TIMINGS.fadeIn);

        // Animate out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(20px)';
            setTimeout(() => notification.remove(), Config.NOTIFICATION_TIMINGS.fadeOut);
        }, adjustedDuration);
    }
};