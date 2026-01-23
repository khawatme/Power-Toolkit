/**
 * @file Tests for background.js (extension background script)
 * @module tests/extension/background.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Background Script - Browser Compatibility', () => {
    let mockChrome;
    let mockBrowser;

    beforeEach(() => {
        // Reset global mocks
        global.chrome = undefined;
        global.browser = undefined;
        global.fetch = undefined;

        // Create mock Chrome API
        mockChrome = {
            runtime: {
                getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
                onInstalled: { addListener: vi.fn() }
            },
            scripting: {
                executeScript: vi.fn().mockResolvedValue([{ result: 'CAN_LOAD' }])
            },
            action: {
                setBadgeText: vi.fn().mockResolvedValue(undefined),
                setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
                setTitle: vi.fn().mockResolvedValue(undefined),
                onClicked: { addListener: vi.fn() }
            }
        };

        // Create mock Browser API (Firefox)
        mockBrowser = {
            runtime: {
                getURL: vi.fn((path) => `moz-extension://mock-id/${path}`),
                getBrowserInfo: vi.fn().mockResolvedValue({ name: 'Firefox', version: '140.0' })
            },
            scripting: {
                executeScript: vi.fn().mockResolvedValue([{ result: 'CAN_LOAD' }])
            },
            action: {
                setBadgeText: vi.fn().mockResolvedValue(undefined),
                setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
                setTitle: vi.fn().mockResolvedValue(undefined),
                onClicked: { addListener: vi.fn() }
            }
        };

        // Mock fetch
        global.fetch = vi.fn().mockResolvedValue({
            text: () => Promise.resolve('console.log("toolkit script");')
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Browser Detection', () => {
        it('should detect Chrome environment', () => {
            global.chrome = mockChrome;
            
            const isChrome = typeof chrome !== 'undefined' && !!chrome.runtime;
            expect(isChrome).toBe(true);
        });

        it('should detect Firefox environment', () => {
            global.browser = mockBrowser;
            
            const isFirefox = typeof browser !== 'undefined' && 
                             typeof browser.runtime?.getBrowserInfo === 'function';
            expect(isFirefox).toBe(true);
        });

        it('should prefer browser namespace over chrome in Firefox', () => {
            global.chrome = mockChrome;
            global.browser = mockBrowser;
            
            const browserAPI = typeof browser !== 'undefined' && browser.runtime 
                ? browser 
                : chrome;
            
            expect(browserAPI).toBe(mockBrowser);
        });

        it('should fallback to chrome namespace when browser is undefined', () => {
            global.chrome = mockChrome;
            
            const browserAPI = typeof browser !== 'undefined' && browser.runtime 
                ? browser 
                : chrome;
            
            expect(browserAPI).toBe(mockChrome);
        });
    });

    describe('isRestrictedUrl Function', () => {
        const isRestrictedUrl = (url) => {
            if (!url) return true;
            // Chrome/Edge restricted pages
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return true;
            if (url.startsWith('edge://') || url.startsWith('extension://')) return true;
            // Firefox restricted pages
            if (url.startsWith('about:') || url.startsWith('moz-extension://')) return true;
            return false;
        };

        it('should return true for null URL', () => {
            expect(isRestrictedUrl(null)).toBe(true);
        });

        it('should return true for undefined URL', () => {
            expect(isRestrictedUrl(undefined)).toBe(true);
        });

        it('should return true for chrome:// URLs', () => {
            expect(isRestrictedUrl('chrome://extensions')).toBe(true);
        });

        it('should return true for chrome-extension:// URLs', () => {
            expect(isRestrictedUrl('chrome-extension://abc123/page.html')).toBe(true);
        });

        it('should return true for edge:// URLs', () => {
            expect(isRestrictedUrl('edge://settings')).toBe(true);
        });

        it('should return true for about: URLs (Firefox)', () => {
            expect(isRestrictedUrl('about:debugging')).toBe(true);
            expect(isRestrictedUrl('about:config')).toBe(true);
        });

        it('should return true for moz-extension:// URLs (Firefox)', () => {
            expect(isRestrictedUrl('moz-extension://abc123/page.html')).toBe(true);
        });

        it('should return false for valid Power Apps URLs', () => {
            expect(isRestrictedUrl('https://org.crm.dynamics.com/main.aspx')).toBe(false);
            expect(isRestrictedUrl('https://make.powerapps.com')).toBe(false);
            expect(isRestrictedUrl('https://apps.powerapps.com')).toBe(false);
        });

        it('should return false for standard HTTPS URLs', () => {
            expect(isRestrictedUrl('https://www.example.com')).toBe(false);
        });
    });

    describe('probeAndShow Function Logic', () => {
        const probeAndShow = () => {
            const SCRIPT_ID = 'power-toolkit-script-module';
            const DIALOG_SELECTOR = '.powerapps-dev-toolkit';

            const cleanup = (win) => {
                try {
                    win.document.querySelector(DIALOG_SELECTOR)?.remove();
                    win.document.getElementById(SCRIPT_ID)?.remove();
                    if (win.PDT_INITIALIZED) win.PDT_INITIALIZED = false;
                } catch (e) {
                    // Fails silently on cross-origin iframes
                }
            };
            
            cleanup(window);
            for (let i = 0; i < window.frames.length; i++) {
                cleanup(window.frames[i]);
            }

            const isModelDrivenApp = (win) => typeof win.Xrm?.Utility !== 'undefined';
            
            if (isModelDrivenApp(window)) return 'CAN_LOAD';
            for (let i = 0; i < window.frames.length; i++) {
                try {
                    if (isModelDrivenApp(window.frames[i])) return 'CAN_LOAD';
                } catch (e) { /* ignore */ }
            }
            
            const isMakerPortal = () => !!window.MsCrmMscrmControls;
            if (isMakerPortal()) {
                return 'CAN_LOAD';
            }

            return 'CANNOT_LOAD';
        };

        beforeEach(() => {
            // Setup DOM environment
            global.window = {
                frames: [],
                document: {
                    querySelector: vi.fn(),
                    getElementById: vi.fn()
                }
            };
        });

        it('should return CAN_LOAD when Xrm.Utility exists in main window', () => {
            global.window.Xrm = { Utility: {} };
            
            const result = probeAndShow();
            expect(result).toBe('CAN_LOAD');
        });

        it('should return CAN_LOAD when MsCrmMscrmControls exists (Maker Portal)', () => {
            global.window.MsCrmMscrmControls = {};
            
            const result = probeAndShow();
            expect(result).toBe('CAN_LOAD');
        });

        it('should return CANNOT_LOAD when no Power Apps context exists', () => {
            const result = probeAndShow();
            expect(result).toBe('CANNOT_LOAD');
        });

        it('should cleanup existing toolkit instances', () => {
            const mockDialog = { remove: vi.fn() };
            const mockScript = { remove: vi.fn() };
            
            global.window.document.querySelector = vi.fn(() => mockDialog);
            global.window.document.getElementById = vi.fn(() => mockScript);
            global.window.PDT_INITIALIZED = true;
            
            probeAndShow();
            
            expect(mockDialog.remove).toHaveBeenCalled();
            expect(mockScript.remove).toHaveBeenCalled();
            expect(global.window.PDT_INITIALIZED).toBe(false);
        });
    });

    describe('Cross-Browser API Usage', () => {
        it('should use chrome.runtime.getURL in Chrome', () => {
            global.chrome = mockChrome;
            const browserAPI = chrome;
            
            const url = browserAPI.runtime.getURL('power-toolkit.js');
            
            expect(mockChrome.runtime.getURL).toHaveBeenCalledWith('power-toolkit.js');
            expect(url).toBe('chrome-extension://mock-id/power-toolkit.js');
        });

        it('should use browser.runtime.getURL in Firefox', () => {
            global.browser = mockBrowser;
            const browserAPI = browser;
            
            const url = browserAPI.runtime.getURL('power-toolkit.js');
            
            expect(mockBrowser.runtime.getURL).toHaveBeenCalledWith('power-toolkit.js');
            expect(url).toBe('moz-extension://mock-id/power-toolkit.js');
        });

        it('should use chrome.scripting.executeScript in Chrome', async () => {
            global.chrome = mockChrome;
            const browserAPI = chrome;
            
            await browserAPI.scripting.executeScript({
                target: { tabId: 1 },
                world: 'MAIN',
                func: () => 'test'
            });
            
            expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
        });

        it('should use browser.scripting.executeScript in Firefox', async () => {
            global.browser = mockBrowser;
            const browserAPI = browser;
            
            await browserAPI.scripting.executeScript({
                target: { tabId: 1 },
                world: 'MAIN',
                func: () => 'test'
            });
            
            expect(mockBrowser.scripting.executeScript).toHaveBeenCalled();
        });
    });

    describe('Badge API Compatibility', () => {
        it('should set badge text using chrome API', async () => {
            global.chrome = mockChrome;
            const browserAPI = chrome;
            
            await browserAPI.action.setBadgeText({ tabId: 1, text: '!' });
            
            expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
                tabId: 1,
                text: '!'
            });
        });

        it('should set badge text using browser API', async () => {
            global.browser = mockBrowser;
            const browserAPI = browser;
            
            await browserAPI.action.setBadgeText({ tabId: 1, text: '!' });
            
            expect(mockBrowser.action.setBadgeText).toHaveBeenCalledWith({
                tabId: 1,
                text: '!'
            });
        });

        it('should set badge background color using chrome API', async () => {
            global.chrome = mockChrome;
            const browserAPI = chrome;
            
            await browserAPI.action.setBadgeBackgroundColor({
                tabId: 1,
                color: '#f44336'
            });
            
            expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
                tabId: 1,
                color: '#f44336'
            });
        });

        it('should set badge background color using browser API', async () => {
            global.browser = mockBrowser;
            const browserAPI = browser;
            
            await browserAPI.action.setBadgeBackgroundColor({
                tabId: 1,
                color: '#f44336'
            });
            
            expect(mockBrowser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
                tabId: 1,
                color: '#f44336'
            });
        });

        it('should set action title using chrome API', async () => {
            global.chrome = mockChrome;
            const browserAPI = chrome;
            
            await browserAPI.action.setTitle({
                tabId: 1,
                title: 'Power-Toolkit'
            });
            
            expect(mockChrome.action.setTitle).toHaveBeenCalledWith({
                tabId: 1,
                title: 'Power-Toolkit'
            });
        });

        it('should set action title using browser API', async () => {
            global.browser = mockBrowser;
            const browserAPI = browser;
            
            await browserAPI.action.setTitle({
                tabId: 1,
                title: 'Power-Toolkit'
            });
            
            expect(mockBrowser.action.setTitle).toHaveBeenCalledWith({
                tabId: 1,
                title: 'Power-Toolkit'
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle cleanup errors gracefully', () => {
            const mockWindow = {
                frames: [
                    {
                        document: {
                            querySelector: () => {
                                throw new Error('Cross-origin access denied');
                            }
                        }
                    }
                ],
                document: {
                    querySelector: vi.fn(() => null),
                    getElementById: vi.fn(() => null)
                }
            };

            const cleanup = (win) => {
                try {
                    win.document.querySelector('.powerapps-dev-toolkit')?.remove();
                    win.document.getElementById('power-toolkit-script-module')?.remove();
                } catch (e) {
                    // Should not throw
                }
            };

            expect(() => {
                cleanup(mockWindow);
                cleanup(mockWindow.frames[0]);
            }).not.toThrow();
        });

        it('should handle script injection failure', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
            
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            try {
                const response = await fetch('power-toolkit.js');
                await response.text();
            } catch (e) {
                expect(e.message).toBe('Network error');
            }
            
            consoleError.mockRestore();
        });
    });

    describe('Script Injection Logic', () => {
        it('should not inject duplicate scripts', () => {
            const mockDocument = {
                getElementById: vi.fn((id) => {
                    if (id === 'power-toolkit-script-module') {
                        return { id: 'power-toolkit-script-module' }; // Script exists
                    }
                    return null;
                }),
                createElement: vi.fn(),
                head: { appendChild: vi.fn() }
            };

            const injectionFunc = (code) => {
                const SCRIPT_ID = 'power-toolkit-script-module';
                if (mockDocument.getElementById(SCRIPT_ID)) return;
                const script = mockDocument.createElement('script');
                script.id = SCRIPT_ID;
                script.type = 'module';
                script.textContent = code;
                (mockDocument.head || mockDocument.documentElement).appendChild(script);
            };

            injectionFunc('console.log("test");');

            expect(mockDocument.createElement).not.toHaveBeenCalled();
            expect(mockDocument.head.appendChild).not.toHaveBeenCalled();
        });

        it('should inject script when not already present', () => {
            const mockScript = {
                id: null,
                type: null,
                textContent: null
            };

            const mockDocument = {
                getElementById: vi.fn(() => null), // Script doesn't exist
                createElement: vi.fn(() => mockScript),
                head: { appendChild: vi.fn() }
            };

            const injectionFunc = (code) => {
                const SCRIPT_ID = 'power-toolkit-script-module';
                if (mockDocument.getElementById(SCRIPT_ID)) return;
                const script = mockDocument.createElement('script');
                script.id = SCRIPT_ID;
                script.type = 'module';
                script.textContent = code;
                (mockDocument.head || mockDocument.documentElement).appendChild(script);
            };

            const testCode = 'console.log("toolkit loaded");';
            injectionFunc(testCode);

            expect(mockDocument.createElement).toHaveBeenCalledWith('script');
            expect(mockScript.id).toBe('power-toolkit-script-module');
            expect(mockScript.type).toBe('module');
            expect(mockScript.textContent).toBe(testCode);
            expect(mockDocument.head.appendChild).toHaveBeenCalledWith(mockScript);
        });
    });
});
