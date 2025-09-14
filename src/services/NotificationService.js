/**
 * @file Handles the display of toast notifications.
 * @module services/NotificationService
 * @description A simple, dependency-free service to show temporary, non-blocking messages to the user.
 */

/**
 * Provides a method to show toast-style notifications.
 * @namespace
 */
export const NotificationService = {
    /**
     * Displays a notification message at the bottom of the screen.
     * @param {string} message - The text to display.
     * @param {'info' | 'success' | 'warn' | 'error'} [type='info'] - The type of notification, which determines its color.
     */
    show(message, type = 'info') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.setAttribute('role', 'alert');

        const colors = {
            success: 'var(--pro-success)',
            error: 'var(--pro-error)',
            warn: 'var(--pro-warn)',
            info: '#333333' // A neutral, dark default for info messages
        };

        // Apply styles directly. This makes the service self-contained and not dependent on a specific class name.
        Object.assign(notification.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: '10003',
            color: 'white',
            fontFamily: `"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif`,
            fontSize: '14px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            backgroundColor: colors[type] || colors.info,
            transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
            opacity: '0',
            transform: 'translateX(-50%) translateY(20px)' // Start off-screen
        });

        document.body.appendChild(notification);

        // --- Animation and Cleanup ---

        // Animate in: Trigger a reflow, then apply the 'in' styles.
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        }, 10); // A small delay is needed to ensure the transition triggers.

        // Animate out and remove the notification after a delay.
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(20px)';
            // Remove the element from the DOM after the fade-out transition completes.
            setTimeout(() => notification.remove(), 500); // 500ms matches the transition duration.
        }, 3500); // Keep the notification visible for 3.5 seconds.
    }
};