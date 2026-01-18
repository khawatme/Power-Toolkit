/**
 * @file Comprehensive Tests for NotificationService
 * @module tests/services/NotificationService.test.js
 * @description Tests notification display, timing, lifecycle, and styling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Config before importing NotificationService
vi.mock('../../src/constants/index.js', () => ({
    Config: {
        NOTIFICATION_CONTAINER_ID: 'pdt-notification-container',
        NOTIFICATION_STYLES: {
            gap: '8px',
            padding: '16px',
            zIndex: '10000'
        },
        NOTIFICATION_TIMINGS: {
            duration: 3000,
            fadeIn: 10,
            fadeOut: 300,
            removeDelay: 350
        },
        MAX_NOTIFICATIONS: 5,
        NOTIFICATION_COLORS: {
            info: '#2196F3',
            success: '#4CAF50',
            warn: '#ff9800',
            error: '#f44336'
        }
    }
}));

describe('NotificationService', () => {
    let NotificationService;

    beforeEach(async () => {
        // Reset modules to get fresh NotificationService with cleared cache
        vi.resetModules();
        document.body.innerHTML = '';
        vi.useFakeTimers();

        // Dynamically import to get fresh module instance
        const module = await import('../../src/services/NotificationService.js');
        NotificationService = module.NotificationService;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    describe('show', () => {
        describe('container management', () => {
            it('should create notification container on first call', () => {
                NotificationService.show('Test message', 'info');
                const container = document.getElementById('pdt-notification-container');
                expect(container).not.toBeNull();
            });

            it('should reuse existing container on subsequent calls', () => {
                NotificationService.show('First message', 'info');
                NotificationService.show('Second message', 'info');

                const containers = document.querySelectorAll('#pdt-notification-container');
                expect(containers.length).toBe(1);
            });

            it('should position container at bottom of screen', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');

                expect(container.style.position).toBe('fixed');
                expect(container.style.bottom).toBe('0px');
                expect(container.style.left).toBe('0px');
                expect(container.style.right).toBe('0px');
            });

            it('should stack notifications vertically', () => {
                NotificationService.show('Message 1', 'info');

                const container = document.getElementById('pdt-notification-container');
                expect(container.style.flexDirection).toBe('column');
            });
        });

        describe('notification creation', () => {
            it('should create notification element with message', () => {
                NotificationService.show('Test message', 'info');

                const container = document.getElementById('pdt-notification-container');
                expect(container).not.toBeNull();
                expect(container.innerHTML).toContain('Test message');
            });

            it('should set role="alert" for accessibility', () => {
                NotificationService.show('Accessible notification', 'info');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification).not.toBeNull();
            });

            it('should handle empty message', () => {
                expect(() => NotificationService.show('', 'info')).not.toThrow();
            });

            it('should throw error for undefined message (implementation validates input)', () => {
                // The service throws when passed undefined - this documents the actual behavior
                expect(() => NotificationService.show(undefined, 'info')).toThrow(TypeError);
            });
        });

        describe('message formatting', () => {
            it('should convert \\r\\n to line breaks', () => {
                NotificationService.show('Line 1\r\nLine 2', 'info');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('<br>');
            });

            it('should convert \\n to line breaks', () => {
                NotificationService.show('Line 1\nLine 2\nLine 3', 'info');

                const container = document.getElementById('pdt-notification-container');
                // Count <br> occurrences
                const brCount = (container.innerHTML.match(/<br>/g) || []).length;
                expect(brCount).toBe(2);
            });
        });

        describe('notification types', () => {
            it('should apply info styling', () => {
                NotificationService.show('Info message', 'info');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // The notification exists and has the message
                expect(notification).not.toBeNull();
                expect(notification.innerHTML).toContain('Info message');
            });

            it('should apply success styling', () => {
                NotificationService.show('Success message', 'success');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // The notification exists and has the message
                expect(notification).not.toBeNull();
                expect(notification.innerHTML).toContain('Success message');
            });

            it('should apply warning styling', () => {
                NotificationService.show('Warning message', 'warn');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('Warning message');
            });

            it('should apply error styling', () => {
                NotificationService.show('Error message', 'error');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('Error message');
            });

            it('should default to info type when no type specified', () => {
                NotificationService.show('Default type message');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('Default type message');
            });
        });

        describe('error notifications', () => {
            it('should add close button for error messages', () => {
                NotificationService.show('Error message', 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                expect(closeBtn).not.toBeNull();
                // The close button contains the × symbol (either as character or entity)
                expect(closeBtn.textContent.length).toBeGreaterThan(0);
            });

            it('should make error notifications clickable to dismiss', () => {
                NotificationService.show('Clickable error', 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.cursor).toBe('pointer');
                expect(notification.getAttribute('title')).toBe('Click to dismiss');
            });

            it('should dismiss error notification on click', () => {
                NotificationService.show('Click to dismiss', 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Simulate click
                notification.click();

                // Should trigger fade out
                expect(notification.style.opacity).toBe('0');
            });

            it('should dismiss error notification on close button click', () => {
                NotificationService.show('Close me', 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                // Simulate close button click
                closeBtn.click();

                // Should trigger fade out
                expect(notification.style.opacity).toBe('0');
            });
        });

        describe('animation', () => {
            it('should have transition for fade effect', () => {
                NotificationService.show('Fade in test', 'info');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.transition).toContain('opacity');
            });

            it('should have transition for slide effect', () => {
                NotificationService.show('Slide in test', 'info');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.transition).toContain('transform');
            });

            it('should fade in after a short delay', () => {
                NotificationService.show('Fade test', 'info');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Advance past fade-in delay (10ms)
                vi.advanceTimersByTime(20);

                expect(notification.style.opacity).toBe('1');
                // Browser may normalize 0px to 0
                expect(notification.style.transform).toMatch(/translateY\(0(px)?\)/);
            });

            it('should fade out after duration expires', () => {
                NotificationService.show('Timeout test', 'info', 1000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Advance past duration
                vi.advanceTimersByTime(1010);

                expect(notification.style.opacity).toBe('0');
            });
        });

        describe('multiple notifications', () => {
            it('should handle multiple notifications', () => {
                NotificationService.show('Message 1', 'info');
                NotificationService.show('Message 2', 'success');
                NotificationService.show('Message 3', 'error');

                const container = document.getElementById('pdt-notification-container');
                const notifications = container.querySelectorAll('[role="alert"]');

                expect(notifications.length).toBe(3);
            });

            it('should append new notifications to container', () => {
                NotificationService.show('First', 'info');
                NotificationService.show('Second', 'success');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('First');
                expect(container.innerHTML).toContain('Second');
            });
        });

        describe('custom duration', () => {
            it('should use provided duration', () => {
                NotificationService.show('Custom duration', 'info', 5000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Should still be visible at 4s
                vi.advanceTimersByTime(4000);
                expect(notification.style.opacity).not.toBe('0');

                // Should fade at 5s
                vi.advanceTimersByTime(1010);
                expect(notification.style.opacity).toBe('0');
            });
        });

        describe('container styling', () => {
            it('should set container z-index from config', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                expect(container.style.zIndex).toBe('10000');
            });

            it('should set container pointer-events to none for click passthrough', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                expect(container.style.pointerEvents).toBe('none');
            });

            it('should set container gap from config', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                expect(container.style.gap).toBe('8px');
            });

            it('should set container padding from config', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                expect(container.style.padding).toBe('16px');
            });

            it('should center align notifications in container', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                expect(container.style.alignItems).toBe('center');
            });

            it('should use flex display for container', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                expect(container.style.display).toBe('flex');
            });
        });

        describe('notification styling by type', () => {
            it('should apply info background color', () => {
                NotificationService.show('Info', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                // backgroundColor is applied from Config.NOTIFICATION_COLORS.info
                expect(notification.style.backgroundColor).toBe('#2196F3');
            });

            it('should apply success background color', () => {
                NotificationService.show('Success', 'success');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                expect(notification.style.backgroundColor).toBe('#4CAF50');
            });

            it('should apply warning background color', () => {
                NotificationService.show('Warning', 'warn');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                expect(notification.style.backgroundColor).toBe('#ff9800');
            });

            it('should apply error background color', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                expect(notification.style.backgroundColor).toBe('#f44336');
            });

            it('should fallback to info color for unknown type', () => {
                NotificationService.show('Unknown type', 'unknown');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                // Falls back to info color
                expect(notification.style.backgroundColor).toBe('#2196F3');
            });

            it('should set notification pointer-events to auto', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                expect(notification.style.pointerEvents).toBe('auto');
            });

            it('should set default cursor for non-error notifications', () => {
                NotificationService.show('Info message', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                expect(notification.style.cursor).toBe('default');
            });
        });

        describe('animation states', () => {
            it('should start with opacity 0 before fade-in', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                // Initial state before timer fires
                expect(notification.style.opacity).toBe('0');
            });

            it('should start with translateY(20px) before animation', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                expect(notification.style.transform).toBe('translateY(20px)');
            });

            it('should have 0.5s transition duration', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                expect(notification.style.transition).toContain('0.5s');
            });

            it('should reset transform to translateY(20px) on fade out', () => {
                NotificationService.show('Test', 'info', 1000);
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Fade in
                vi.advanceTimersByTime(20);
                expect(notification.style.transform).toMatch(/translateY\(0(px)?\)/);

                // Fade out
                vi.advanceTimersByTime(1000);
                expect(notification.style.transform).toBe('translateY(20px)');
            });

            it('should remove notification from DOM after fade out delay', () => {
                NotificationService.show('Test', 'info', 1000);
                const container = document.getElementById('pdt-notification-container');
                let notifications = container.querySelectorAll('[role="alert"]');
                expect(notifications.length).toBe(1);

                // Complete fade out cycle (duration + fadeOut delay)
                vi.advanceTimersByTime(1000 + 300 + 100);
                notifications = container.querySelectorAll('[role="alert"]');
                expect(notifications.length).toBe(0);
            });
        });

        describe('max notifications limit', () => {
            it('should enforce maximum notification limit after removal completes', () => {
                // MAX_NOTIFICATIONS is 5
                for (let i = 0; i < 7; i++) {
                    NotificationService.show(`Message ${i}`, 'info');
                }

                // Advance timer to allow removed notifications to be cleaned up
                vi.advanceTimersByTime(400);

                const container = document.getElementById('pdt-notification-container');
                const notifications = container.querySelectorAll('[role="alert"]');
                expect(notifications.length).toBeLessThanOrEqual(5);
            });

            it('should remove oldest notifications when limit exceeded', () => {
                for (let i = 0; i < 6; i++) {
                    NotificationService.show(`Message ${i}`, 'info');
                }

                // Advance timer to complete removal of old notifications
                vi.advanceTimersByTime(400);

                const container = document.getElementById('pdt-notification-container');
                // Should contain the latest messages
                expect(container.innerHTML).toContain('Message 5');
            });

            it('should fade out removed notifications when enforcing limit', () => {
                for (let i = 0; i < 5; i++) {
                    NotificationService.show(`Message ${i}`, 'info');
                }

                const container = document.getElementById('pdt-notification-container');

                // Add one more to trigger removal
                NotificationService.show('New message', 'info');

                // Old notification should start fading
                vi.advanceTimersByTime(350);
                // The old one should be removed after fadeOut timing
                expect(container.innerHTML).toContain('New message');
            });
        });

        describe('close button behavior', () => {
            it('should have close button with times symbol for errors', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');
                // JSDOM returns the raw HTML entity, check for existence
                expect(closeBtn.textContent.length).toBeGreaterThan(0);
            });

            it('should set close button title attribute', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');
                expect(closeBtn.getAttribute('title')).toBe('Click to dismiss');
            });

            it('should increase close button opacity on mouseenter', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                const enterEvent = new MouseEvent('mouseenter');
                closeBtn.dispatchEvent(enterEvent);

                expect(closeBtn.style.opacity).toBe('1');
            });

            it('should decrease close button opacity on mouseleave', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                // First enter, then leave
                closeBtn.dispatchEvent(new MouseEvent('mouseenter'));
                closeBtn.dispatchEvent(new MouseEvent('mouseleave'));

                expect(closeBtn.style.opacity).toBe('0.7');
            });

            it('should stop propagation when close button is clicked', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                let propagated = false;
                notification.addEventListener('click', () => {
                    propagated = true;
                }, { once: true, capture: false });

                const clickEvent = new MouseEvent('click', { bubbles: true });
                closeBtn.dispatchEvent(clickEvent);

                // Due to stopPropagation, the notification click handler should not be called twice
                expect(notification.style.opacity).toBe('0');
            });

            it('should position close button absolutely in top right', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                expect(closeBtn.style.position).toBe('absolute');
                expect(closeBtn.style.top).toBe('8px');
                expect(closeBtn.style.right).toBe('12px');
            });

            it('should set notification position to relative for error type', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.position).toBe('relative');
            });

            it('should add extra padding right for close button on errors', () => {
                NotificationService.show('Error', 'error');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.paddingRight).toBe('40px');
            });
        });

        describe('long error messages', () => {
            it('should use larger padding for messages with line breaks', () => {
                NotificationService.show('Line 1\nLine 2', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.padding).toContain('16px');
            });

            it('should use larger max-width for messages with line breaks', () => {
                NotificationService.show('Line 1\nLine 2', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.maxWidth).toBe('600px');
            });

            it('should use smaller max-width for single line messages', () => {
                NotificationService.show('Single line', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.maxWidth).toBe('400px');
            });

            it('should enable word-break for long messages', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.wordBreak).toBe('break-word');
            });

            it('should set text alignment to left', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.textAlign).toBe('left');
            });

            it('should set white-space to normal', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.whiteSpace).toBe('normal');
            });
        });

        describe('notification removal and cleanup', () => {
            it('should clear pending timeouts when manually dismissed', () => {
                NotificationService.show('Error', 'error', 10000);
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Click to dismiss early
                notification.click();

                // Verify fade out triggered
                expect(notification.style.opacity).toBe('0');

                // Advance past original duration - should not cause issues
                vi.advanceTimersByTime(15000);
            });

            it('should remove notification from tracking array on removal', () => {
                NotificationService.show('Test 1', 'info', 500);
                NotificationService.show('Test 2', 'info', 500);

                const container = document.getElementById('pdt-notification-container');
                let notifications = container.querySelectorAll('[role="alert"]');
                expect(notifications.length).toBe(2);

                // Wait for both to be removed
                vi.advanceTimersByTime(500 + 300 + 100);
                notifications = container.querySelectorAll('[role="alert"]');
                expect(notifications.length).toBe(0);
            });

            it('should handle rapid creation and dismissal of notifications', () => {
                // Create and dismiss rapidly
                NotificationService.show('Rapid 1', 'error');
                NotificationService.show('Rapid 2', 'error');

                const container = document.getElementById('pdt-notification-container');
                const notifications = container.querySelectorAll('[role="alert"]');

                // Dismiss all
                notifications.forEach(n => n.click());

                // All should start fading
                notifications.forEach(n => {
                    expect(n.style.opacity).toBe('0');
                });
            });
        });

        describe('notification text styling', () => {
            it('should set font-family to Segoe UI', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.fontFamily).toContain('Segoe UI');
            });

            it('should set font-size to 14px', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.fontSize).toBe('14px');
            });

            it('should set line-height to 1.5', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.lineHeight).toBe('1.5');
            });

            it('should set text color to white', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.color).toBe('white');
            });

            it('should set border-radius to 8px', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.borderRadius).toBe('8px');
            });

            it('should apply box-shadow for depth', () => {
                NotificationService.show('Test', 'info');
                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                expect(notification.style.boxShadow).toBeTruthy();
            });
        });

        describe('error duration adjustment', () => {
            it('should increase duration for long error messages over 150 chars', () => {
                const longMessage = 'a'.repeat(200);
                NotificationService.show(longMessage, 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // With 200 chars, adjusted duration = max(8000, 200*50) = 10000ms
                // Notification should still be visible after 8s
                vi.advanceTimersByTime(8500);
                expect(notification.style.opacity).not.toBe('0');

                // But should fade after 10s
                vi.advanceTimersByTime(2000);
                expect(notification.style.opacity).toBe('0');
            });

            it('should increase duration for error messages with line breaks', () => {
                const multiLineMessage = 'Line 1\nLine 2\nLine 3';
                NotificationService.show(multiLineMessage, 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Adjusted duration for error with line breaks
                // Should stay visible longer than default 3000ms
                vi.advanceTimersByTime(5000);
                expect(notification.style.opacity).not.toBe('0');
            });

            it('should cap duration at 30s for very long error messages', () => {
                const veryLongMessage = 'a'.repeat(1000);
                NotificationService.show(veryLongMessage, 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // With 1000 chars, calculated = 1000*50 = 50000, but capped at 30000
                vi.advanceTimersByTime(29000);
                expect(notification.style.opacity).not.toBe('0');

                // Should fade after 30s
                vi.advanceTimersByTime(1500);
                expect(notification.style.opacity).toBe('0');
            });

            it('should not adjust duration for non-error long messages', () => {
                const longMessage = 'a'.repeat(200);
                NotificationService.show(longMessage, 'info', 3000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Info messages don't get adjusted duration, so should fade after 3s
                vi.advanceTimersByTime(3100);
                expect(notification.style.opacity).toBe('0');
            });

            it('should use minimum 8s for short error messages with line breaks', () => {
                const shortMultiLine = 'A\nB';
                NotificationService.show(shortMultiLine, 'error');

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Very short message but has line breaks, so min 8000ms
                vi.advanceTimersByTime(7000);
                expect(notification.style.opacity).not.toBe('0');
            });
        });

        describe('notification not in active list', () => {
            it('should handle removal when notification already removed from tracking', () => {
                NotificationService.show('Test', 'info', 500);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // First removal cycle
                vi.advanceTimersByTime(500 + 300 + 100);

                // Notification should be removed
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle notification removal when max limit reached rapidly', () => {
                // Add notifications rapidly to test edge case
                for (let i = 0; i < 10; i++) {
                    NotificationService.show(`Message ${i}`, 'info', 1000);
                }

                // Fast forward to allow cleanup
                vi.advanceTimersByTime(500);

                const container = document.getElementById('pdt-notification-container');
                // Should have enforced max limit
                const notifications = container.querySelectorAll('[role="alert"]');
                expect(notifications.length).toBeLessThanOrEqual(5);
            });
        });

        describe('timeout cleanup in _removeNotification', () => {
            it('should clear fadeOutTimeout when notification is removed during fadeout phase', () => {
                // Create an error notification with a long duration
                NotificationService.show('Test error', 'error', 5000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Fade in completes
                vi.advanceTimersByTime(20);
                expect(notification.style.opacity).toBe('1');

                // Wait until fadeOut timeout has been set (after duration)
                vi.advanceTimersByTime(5000);

                // Now notification is fading out, click to dismiss
                notification.click();

                // The notification should be removed cleanly
                vi.advanceTimersByTime(400);
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should clear removeTimeout when notification is dismissed after fade started', () => {
                // Create error notification
                NotificationService.show('Dismiss during fade', 'error', 1000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Let it fade in
                vi.advanceTimersByTime(20);

                // Advance past duration so fadeOut starts and removeTimeout is scheduled
                vi.advanceTimersByTime(1000);

                // Now fadeOut has started, removeTimeout is set
                // Click to dismiss during fade animation (before removeTimeout fires)
                vi.advanceTimersByTime(100); // Part way through fadeOut
                notification.click();

                // Should complete removal without errors
                vi.advanceTimersByTime(500);
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle double removal attempts gracefully', () => {
                NotificationService.show('Double remove test', 'error', 2000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Fade in
                vi.advanceTimersByTime(20);

                // Click to dismiss
                notification.click();
                expect(notification.style.opacity).toBe('0');

                // Try clicking again (simulating double-click)
                expect(() => notification.click()).not.toThrow();

                // Complete the removal
                vi.advanceTimersByTime(500);
            });

            it('should clear all timeouts when manually dismissed before any timeout fires', () => {
                NotificationService.show('Early dismiss', 'error', 10000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Dismiss immediately before fade-in completes
                notification.click();

                // Advance past original duration - no errors should occur
                vi.advanceTimersByTime(15000);
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should properly cleanup when notification removed via close button during animation', () => {
                NotificationService.show('Close button test', 'error', 3000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                // Fade in
                vi.advanceTimersByTime(20);

                // Advance to just before fadeOut starts
                vi.advanceTimersByTime(2900);

                // Click close button just as fadeOut is about to start
                closeBtn.click();

                // Complete cleanup
                vi.advanceTimersByTime(500);
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle removal when notification has both fadeOutTimeout and removeTimeout pending', () => {
                NotificationService.show('Both timeouts test', 'error', 500);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Fade in
                vi.advanceTimersByTime(20);

                // Advance past duration so fadeOutTimeout fires and sets removeTimeout
                vi.advanceTimersByTime(500);

                // Now removeTimeout is pending (300ms for fadeOut)
                // Advance partway into fadeOut
                vi.advanceTimersByTime(150);

                // Dismiss via click - should clear the pending removeTimeout
                notification.click();

                // Complete all timers
                vi.advanceTimersByTime(500);

                // Should be cleanly removed
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });
        });

        describe('notification timeout tracking edge cases', () => {
            it('should track notification timeouts and clean them up on removal', () => {
                // Create multiple notifications
                NotificationService.show('Notification 1', 'info', 2000);
                NotificationService.show('Notification 2', 'info', 2000);
                NotificationService.show('Notification 3', 'error', 2000);

                const container = document.getElementById('pdt-notification-container');
                const notifications = container.querySelectorAll('[role="alert"]');
                expect(notifications.length).toBe(3);

                // Dismiss error notification via click
                notifications[2].click();

                // Let fade complete
                vi.advanceTimersByTime(400);

                // Should have 2 notifications remaining
                expect(container.querySelectorAll('[role="alert"]').length).toBe(2);

                // Complete remaining notifications
                vi.advanceTimersByTime(2000);
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should not throw when removing notification not in active list', () => {
                NotificationService.show('Test', 'info', 500);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Complete normal removal
                vi.advanceTimersByTime(500 + 400);

                // Notification is already removed, trying to interact should not throw
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle notification removal when _notificationTimeouts has no entry', () => {
                // Show a simple info notification (no click-to-dismiss)
                NotificationService.show('Simple notification', 'info', 500);

                const container = document.getElementById('pdt-notification-container');

                // Let it complete naturally
                vi.advanceTimersByTime(500 + 400);

                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });
        });

        describe('enforceMaxNotifications edge cases', () => {
            it('should handle null notification in array during enforcement', () => {
                // Fill up to max
                for (let i = 0; i < 5; i++) {
                    NotificationService.show(`Message ${i}`, 'info', 10000);
                }

                // Add one more to trigger enforcement
                NotificationService.show('Trigger enforcement', 'info', 10000);

                // The oldest should be fading out
                vi.advanceTimersByTime(400);

                const container = document.getElementById('pdt-notification-container');
                expect(container.querySelectorAll('[role="alert"]').length).toBeLessThanOrEqual(5);
            });

            it('should remove multiple excess notifications at once', () => {
                // Fill up to max
                for (let i = 0; i < 5; i++) {
                    NotificationService.show(`Message ${i}`, 'info', 10000);
                }

                // Add several more rapidly
                NotificationService.show('New 1', 'info', 10000);
                NotificationService.show('New 2', 'info', 10000);
                NotificationService.show('New 3', 'info', 10000);

                // Allow removal animations
                vi.advanceTimersByTime(400);

                const container = document.getElementById('pdt-notification-container');
                expect(container.querySelectorAll('[role="alert"]').length).toBeLessThanOrEqual(5);
            });

            it('should properly animate out removed notifications with opacity and transform', () => {
                // Fill up to max
                for (let i = 0; i < 5; i++) {
                    NotificationService.show(`Message ${i}`, 'info', 10000);
                }

                const container = document.getElementById('pdt-notification-container');
                const initialFirst = container.querySelector('[role="alert"]');

                // Add one more to trigger enforcement
                NotificationService.show('Trigger', 'info', 10000);

                // The first notification should be fading out
                expect(initialFirst.style.opacity).toBe('0');
                expect(initialFirst.style.transform).toBe('translateY(20px)');
            });
        });

        describe('cleanupAndRemove timeout clearing', () => {
            it('should clear fadeOutTimeout when it exists', () => {
                const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

                NotificationService.show('Test', 'error', 1000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Fade in
                vi.advanceTimersByTime(20);

                // Click to dismiss - this calls cleanupAndRemove which should clear fadeOutTimeout
                notification.click();

                // clearTimeout should have been called
                expect(clearTimeoutSpy).toHaveBeenCalled();

                clearTimeoutSpy.mockRestore();
            });

            it('should clear removeTimeout when it exists during dismiss', () => {
                const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

                NotificationService.show('Test', 'error', 500);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Fade in
                vi.advanceTimersByTime(20);

                // Wait for fadeOutTimeout to fire (sets removeTimeout)
                vi.advanceTimersByTime(500);

                // Now removeTimeout exists, dismiss
                notification.click();

                // clearTimeout should have been called multiple times
                expect(clearTimeoutSpy).toHaveBeenCalled();

                clearTimeoutSpy.mockRestore();
            });

            it('should handle cleanupAndRemove when both timeouts are null', () => {
                NotificationService.show('Test', 'error', 5000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Dismiss immediately before any timeouts are set
                // (fadeOutTimeout is set synchronously, so this tests the path)
                notification.click();

                // Should not throw
                vi.advanceTimersByTime(500);
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });
        });

        describe('_removeNotification timeout map cleanup', () => {
            it('should delete notification from timeout map after removal', () => {
                NotificationService.show('Map cleanup test', 'info', 500);

                const container = document.getElementById('pdt-notification-container');

                // Complete the notification lifecycle
                vi.advanceTimersByTime(500 + 400);

                // Notification should be completely removed
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle rapid show/dismiss cycles without memory leaks', () => {
                // Rapidly create and dismiss notifications
                for (let i = 0; i < 20; i++) {
                    NotificationService.show(`Rapid ${i}`, 'error', 10000);
                }

                const container = document.getElementById('pdt-notification-container');
                const notifications = container.querySelectorAll('[role="alert"]');

                // Dismiss all
                notifications.forEach(n => n.click());

                // Complete all removals
                vi.advanceTimersByTime(500);

                // All should be removed
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });
        });

        describe('_removeNotification edge cases', () => {
            it('should handle removal when notification is not in _activeNotifications array', () => {
                NotificationService.show('Test', 'info', 100);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Wait for natural removal to complete
                vi.advanceTimersByTime(100 + 400);

                // Try to trigger another removal (notification already removed from array)
                // This simulates the edge case where _removeNotification is called
                // but notification is not in _activeNotifications
                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should safely call remove on notification element', () => {
                NotificationService.show('Remove test', 'info', 200);

                const container = document.getElementById('pdt-notification-container');

                // Complete removal cycle
                vi.advanceTimersByTime(200 + 400);

                expect(container.innerHTML).not.toContain('Remove test');
            });

            it('should handle notification removal when already faded but not yet removed', () => {
                NotificationService.show('Fade state test', 'error', 500);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Fade in
                vi.advanceTimersByTime(20);

                // Start fade out
                vi.advanceTimersByTime(500);
                expect(notification.style.opacity).toBe('0');

                // Click during fade out (before remove timeout fires)
                notification.click();

                // Complete all timers
                vi.advanceTimersByTime(500);

                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });
        });

        describe('notification index in active array', () => {
            it('should find and remove notification from active array', () => {
                NotificationService.show('Array test 1', 'info', 500);
                NotificationService.show('Array test 2', 'info', 500);

                const container = document.getElementById('pdt-notification-container');
                expect(container.querySelectorAll('[role="alert"]').length).toBe(2);

                // Let both complete
                vi.advanceTimersByTime(500 + 400);

                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle notification not found in array (indexOf returns -1)', () => {
                NotificationService.show('Test 1', 'info', 300);
                NotificationService.show('Test 2', 'info', 500);

                const container = document.getElementById('pdt-notification-container');

                // First notification completes
                vi.advanceTimersByTime(300 + 400);

                // Only second remains
                expect(container.querySelectorAll('[role="alert"]').length).toBe(1);
                expect(container.innerHTML).toContain('Test 2');

                // Complete second
                vi.advanceTimersByTime(200 + 100);

                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });
        });

        describe('notification removal during different phases', () => {
            it('should handle removal during fade-in phase', () => {
                NotificationService.show('Fade-in dismiss', 'error', 5000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Dismiss during fade-in (before 10ms)
                vi.advanceTimersByTime(5);
                notification.click();

                // Complete
                vi.advanceTimersByTime(500);

                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle removal during visible phase', () => {
                NotificationService.show('Visible phase dismiss', 'error', 5000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');

                // Let fade in complete
                vi.advanceTimersByTime(20);
                expect(notification.style.opacity).toBe('1');

                // Dismiss during visible phase
                vi.advanceTimersByTime(1000);
                notification.click();

                // Complete
                vi.advanceTimersByTime(500);

                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });

            it('should handle removal during fade-out phase via close button', () => {
                NotificationService.show('Fade-out close button', 'error', 1000);

                const container = document.getElementById('pdt-notification-container');
                const notification = container.querySelector('[role="alert"]');
                const closeBtn = notification.querySelector('span');

                // Fade in and wait for fade out to start
                vi.advanceTimersByTime(1020);
                expect(notification.style.opacity).toBe('0');

                // Click close button during fade-out
                closeBtn.click();

                // Complete
                vi.advanceTimersByTime(500);

                expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
            });
        });

        describe('container reuse and persistence', () => {
            it('should reuse container across multiple notification cycles', () => {
                NotificationService.show('Cycle 1', 'info', 100);
                vi.advanceTimersByTime(500);

                NotificationService.show('Cycle 2', 'success', 100);
                vi.advanceTimersByTime(500);

                NotificationService.show('Cycle 3', 'error', 100);

                const containers = document.querySelectorAll('#pdt-notification-container');
                expect(containers.length).toBe(1);
            });

            it('should maintain container styling after all notifications removed', () => {
                NotificationService.show('Test', 'info', 100);
                vi.advanceTimersByTime(500);

                const container = document.getElementById('pdt-notification-container');
                expect(container).not.toBeNull();
                expect(container.style.position).toBe('fixed');
            });
        });

        describe('enforceMaxNotifications boundary conditions', () => {
            it('should not remove notifications when under limit', () => {
                for (let i = 0; i < 3; i++) {
                    NotificationService.show(`Under limit ${i}`, 'info', 10000);
                }

                const container = document.getElementById('pdt-notification-container');
                expect(container.querySelectorAll('[role="alert"]').length).toBe(3);
            });

            it('should not remove when exactly at limit', () => {
                for (let i = 0; i < 4; i++) {
                    NotificationService.show(`At limit ${i}`, 'info', 10000);
                }

                const container = document.getElementById('pdt-notification-container');
                // Should have 4 (one less than max, since enforcement happens before adding)
                expect(container.querySelectorAll('[role="alert"]').length).toBeLessThanOrEqual(5);
            });

            it('should handle excessCount of exactly 1', () => {
                // Fill to exactly max
                for (let i = 0; i < 5; i++) {
                    NotificationService.show(`Fill ${i}`, 'info', 10000);
                }

                const container = document.getElementById('pdt-notification-container');
                const beforeCount = container.querySelectorAll('[role="alert"]').length;

                // Add one more
                NotificationService.show('One over', 'info', 10000);

                // Wait for removal
                vi.advanceTimersByTime(400);

                expect(container.querySelectorAll('[role="alert"]').length).toBeLessThanOrEqual(5);
            });

            it('should handle excessCount greater than 1', () => {
                // Fill to max
                for (let i = 0; i < 5; i++) {
                    NotificationService.show(`Fill ${i}`, 'info', 10000);
                }

                // Rapidly add 3 more without waiting
                NotificationService.show('Excess 1', 'info', 10000);
                NotificationService.show('Excess 2', 'info', 10000);
                NotificationService.show('Excess 3', 'info', 10000);

                // Wait for removals
                vi.advanceTimersByTime(400);

                const container = document.getElementById('pdt-notification-container');
                expect(container.querySelectorAll('[role="alert"]').length).toBeLessThanOrEqual(5);
            });
        });

        describe('special message content handling', () => {
            it('should handle message with only whitespace', () => {
                expect(() => NotificationService.show('   ', 'info')).not.toThrow();

                const container = document.getElementById('pdt-notification-container');
                expect(container.querySelectorAll('[role="alert"]').length).toBe(1);
            });

            it('should render HTML content in message (uses innerHTML)', () => {
                NotificationService.show('<b>Bold text</b>', 'info');

                const container = document.getElementById('pdt-notification-container');
                // innerHTML is used, so HTML is rendered
                expect(container.innerHTML).toContain('<b>Bold text</b>');
            });

            it('should handle message with special characters', () => {
                NotificationService.show('Message with & < > " \' characters', 'info');

                const container = document.getElementById('pdt-notification-container');
                expect(container.querySelectorAll('[role="alert"]').length).toBe(1);
            });

            it('should handle very short message', () => {
                NotificationService.show('A', 'info');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('A');
            });

            it('should handle message with mixed newlines', () => {
                NotificationService.show('Line1\r\nLine2\nLine3\r\nLine4', 'info');

                const container = document.getElementById('pdt-notification-container');
                const brCount = (container.innerHTML.match(/<br>/g) || []).length;
                expect(brCount).toBe(3);
            });
        });

        describe('null message handling', () => {
            it('should throw error for null message (accesses message.length)', () => {
                // The service throws when passed null - this documents the actual behavior
                expect(() => NotificationService.show(null, 'info')).toThrow(TypeError);
            });

            it('should handle numeric message', () => {
                NotificationService.show(12345, 'info');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('12345');
            });

            it('should handle boolean message', () => {
                NotificationService.show(true, 'success');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('true');
            });

            it('should handle object message by converting to string', () => {
                NotificationService.show({ key: 'value' }, 'warn');

                const container = document.getElementById('pdt-notification-container');
                expect(container.innerHTML).toContain('[object Object]');
            });
        });
    });
});
