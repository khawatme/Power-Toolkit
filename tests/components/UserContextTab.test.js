/**
 * @file Comprehensive tests for UserContextTab component
 * @module tests/components/UserContextTab.test.js
 * @description Tests for the User Context viewer component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserContextTab } from '../../src/components/UserContextTab.js';

// Mock user context data
const mockUserContext = {
    user: {
        id: '12345-67890-abcde',
        name: 'Test User',
        language: 1033,
        roles: [
            { id: 'role-1-id', name: 'System Administrator' },
            { id: 'role-2-id', name: 'Sales Manager' }
        ]
    },
    client: {
        type: 'Web',
        formFactor: 'Desktop',
        isOffline: false,
        appUrl: 'https://org.crm.dynamics.com'
    },
    organization: {
        id: 'org-123-id',
        name: 'TestOrganization',
        version: '9.2.0.1234',
        isAutoSave: true
    },
    session: {
        timestamp: '2026-01-02T12:00:00.000Z',
        sessionId: 'session-123',
        tenantId: 'tenant-abc',
        objectId: 'object-xyz',
        buildName: 'Build 1.0',
        organizationId: 'org-123-id',
        uniqueName: 'testorg',
        instanceUrl: 'https://org.crm.dynamics.com',
        environmentId: 'env-123',
        clusterEnvironment: 'prod',
        clusterCategory: 'standard',
        clusterGeoName: 'NAM',
        clusterUriSuffix: '.crm.dynamics.com'
    }
};

// Store mock callback holder
let storeCallback = null;

// Mock team memberships data
const mockTeams = [
    { teamid: 'team-1-id', name: 'Sales Team', teamtype: 'Owner' },
    { teamid: 'team-2-id', name: 'Marketing Team', teamtype: 'Access' }
];

// Mock dependencies
vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getUserId: vi.fn(() => '12345-67890'),
        getUserName: vi.fn(() => 'Test User'),
        getUserRoles: vi.fn(() => [])
    }
}));

vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getEnhancedUserContext: vi.fn(() => Promise.resolve(mockUserContext)),
        retrieveRecord: vi.fn(() => Promise.resolve({
            systemuserid: '12345-67890',
            fullname: 'Test User',
            domainname: 'test@test.com'
        })),
        retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] }))
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/SecurityAnalysisService.js', () => ({
    SecurityAnalysisService: {
        getUserTeams: vi.fn(() => Promise.resolve(mockTeams)),
        getUserRoles: vi.fn(() => Promise.resolve([
            { roleid: 'role-1-id', name: 'System Administrator', isInherited: false },
            { roleid: 'role-2-id', name: 'Sales Manager', isInherited: true, teams: [{ teamId: 'team-1-id', teamName: 'Sales Team' }] }
        ]))
    }
}));

vi.mock('../../src/core/Store.js', () => ({
    Store: {
        subscribe: vi.fn((callback) => {
            storeCallback = callback;
            return vi.fn(() => {
                storeCallback = null;
            });
        }),
        getState: vi.fn(() => ({ impersonationUserId: null }))
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    escapeHtml: vi.fn((str) => str || ''),
    copyToClipboard: vi.fn(() => Promise.resolve())
}));

// Import mocked modules for assertions
import { DataService } from '../../src/services/DataService.js';
import { SecurityAnalysisService } from '../../src/services/SecurityAnalysisService.js';
import { Store } from '../../src/core/Store.js';
import { copyToClipboard } from '../../src/helpers/index.js';

describe('UserContextTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        storeCallback = null;
        component = new UserContextTab();
        document.body.innerHTML = '';
        DataService.getEnhancedUserContext.mockResolvedValue(mockUserContext);

        // Reset SecurityAnalysisService mocks to default implementations
        SecurityAnalysisService.getUserTeams.mockResolvedValue(mockTeams);
        SecurityAnalysisService.getUserRoles.mockResolvedValue([
            { roleid: 'role-1-id', name: 'System Administrator', isInherited: false },
            { roleid: 'role-2-id', name: 'Sales Manager', isInherited: true, teams: [{ teamId: 'team-1-id', teamName: 'Sales Team' }] }
        ]);
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('userContext');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('User');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            expect(component.isFormOnly).toBeFalsy();
        });

        it('should initialize UI object', () => {
            expect(component.ui).toBeDefined();
        });

        it('should initialize unsubscribe as null', () => {
            expect(component.unsubscribe).toBeNull();
        });

        it('should initialize _handleClick as null', () => {
            expect(component._handleClick).toBeNull();
        });

        it('should initialize _handleKeydown as null', () => {
            expect(component._handleKeydown).toBeNull();
        });

        it('should initialize _inflight as null', () => {
            expect(component._inflight).toBeNull();
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render loading message initially', async () => {
            const element = await component.render();
            expect(element.querySelector('.pdt-note')).toBeTruthy();
        });

        it('should have pdt-userctx-root class', async () => {
            const element = await component.render();
            expect(element.classList.contains('pdt-userctx-root')).toBeTruthy();
        });

        it('should render a div element', async () => {
            const element = await component.render();
            expect(element.tagName).toBe('DIV');
        });

        it('should contain loading text content', async () => {
            const element = await component.render();
            expect(element.textContent).toContain('Loading');
        });
    });

    describe('postRender', () => {
        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should store container reference in ui object', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.container).toBe(element);
        });

        it('should subscribe to Store', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(Store.subscribe).toHaveBeenCalled();
        });

        it('should set up _handleClick event handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._handleClick).toBeInstanceOf(Function);
        });

        it('should set up _handleKeydown event handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._handleKeydown).toBeInstanceOf(Function);
        });

        it('should call getEnhancedUserContext to load data', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(DataService.getEnhancedUserContext).toHaveBeenCalled();
            });
        });

        it('should call getEnhancedUserContext with bypass cache true', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(DataService.getEnhancedUserContext).toHaveBeenCalledWith(true, expect.any(Object));
            });
        });
    });

    describe('data loading and rendering', () => {
        it('should render user settings card after data loads', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.pdt-card')).toBeTruthy();
            });
        });

        it('should render section title', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.section-title')).toBeTruthy();
            });
        });

        it('should display user name', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Test User');
            });
        });

        it('should display user ID with copyable class', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const copyableElements = element.querySelectorAll('.copyable');
                expect(copyableElements.length).toBeGreaterThan(0);
            });
        });

        it('should display client type information', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Web');
            });
        });

        it('should display organization name', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('TestOrganization');
            });
        });

        it('should display organization version', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('9.2.0.1234');
            });
        });

        it('should display security roles section', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Security Roles');
            });
        });

        it('should display role count in header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('(2)');
            });
        });

        it('should display individual role names', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('System Administrator');
                expect(element.textContent).toContain('Sales Manager');
            });
        });

        it('should render three context cards', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const cards = element.querySelectorAll('.pdt-card');
                expect(cards.length).toBe(3);
            });
        });

        it('should have accessible aria-label on cards', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const cards = element.querySelectorAll('.pdt-card[aria-label]');
                expect(cards.length).toBe(3);
            });
        });
    });

    describe('error handling', () => {
        it('should display error message on load failure', async () => {
            DataService.getEnhancedUserContext.mockRejectedValue(new Error('Network error'));
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.pdt-error')).toBeTruthy();
            });
        });

        it('should include error details in error message', async () => {
            DataService.getEnhancedUserContext.mockRejectedValue(new Error('Connection timeout'));
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Connection timeout');
            });
        });

        it('should handle error without message property', async () => {
            DataService.getEnhancedUserContext.mockRejectedValue('String error');
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.pdt-error')).toBeTruthy();
            });
        });
    });

    describe('copy functionality', () => {
        it('should call copyToClipboard when copyable element is clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.copyable')).toBeTruthy();
            });

            const copyableEl = element.querySelector('.copyable');
            copyableEl.textContent = 'test-id-123';
            copyableEl.click();

            expect(copyToClipboard).toHaveBeenCalledWith('test-id-123', expect.stringContaining('Copied'));
        });

        it('should not call copyToClipboard for non-copyable elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.section-title')).toBeTruthy();
            });

            copyToClipboard.mockClear();
            const nonCopyable = element.querySelector('.section-title');
            nonCopyable.click();

            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('should handle keyboard Enter on copyable elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.copyable')).toBeTruthy();
            });

            copyToClipboard.mockClear();
            const copyableEl = element.querySelector('.copyable');
            copyableEl.textContent = 'keyboard-test-id';

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            copyableEl.dispatchEvent(enterEvent);

            expect(copyToClipboard).toHaveBeenCalledWith('keyboard-test-id', expect.stringContaining('Copied'));
        });

        it('should handle keyboard Space on copyable elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.copyable')).toBeTruthy();
            });

            copyToClipboard.mockClear();
            const copyableEl = element.querySelector('.copyable');
            copyableEl.textContent = 'space-test-id';

            const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
            copyableEl.dispatchEvent(spaceEvent);

            expect(copyToClipboard).toHaveBeenCalledWith('space-test-id', expect.stringContaining('Copied'));
        });

        it('should not trigger copy on other keys', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.copyable')).toBeTruthy();
            });

            copyToClipboard.mockClear();
            const copyableEl = element.querySelector('.copyable');

            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
            copyableEl.dispatchEvent(tabEvent);

            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('should not trigger copy when keydown on non-copyable element', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.section-title')).toBeTruthy();
            });

            copyToClipboard.mockClear();
            const nonCopyableEl = element.querySelector('.section-title');

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            nonCopyableEl.dispatchEvent(enterEvent);

            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('should not copy empty text', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.copyable')).toBeTruthy();
            });

            copyToClipboard.mockClear();
            const copyableEl = element.querySelector('.copyable');
            copyableEl.textContent = '';
            copyableEl.click();

            expect(copyToClipboard).not.toHaveBeenCalled();
        });
    });

    describe('impersonation banner', () => {
        it('should show impersonation banner when user is impersonated', async () => {
            Store.getState.mockReturnValue({ impersonationUserId: 'impersonated-user-123' });
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.pdt-impersonation-banner')).toBeTruthy();
            });
        });

        it('should display impersonated user ID in banner', async () => {
            Store.getState.mockReturnValue({ impersonationUserId: 'impersonated-user-123' });
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('impersonated-user-123');
            });
        });

        it('should not show impersonation banner when not impersonating', async () => {
            Store.getState.mockReturnValue({ impersonationUserId: null });
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.pdt-card')).toBeTruthy();
            });
            expect(element.querySelector('.pdt-impersonation-banner')).toBeFalsy();
        });

        it('should have accessible role on impersonation banner', async () => {
            Store.getState.mockReturnValue({ impersonationUserId: 'user-xyz' });
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const banner = element.querySelector('.pdt-impersonation-banner');
                expect(banner.getAttribute('role')).toBe('status');
            });
        });
    });

    describe('Store subscription and reactivity', () => {
        it('should reload data when impersonation changes', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => {
                expect(DataService.getEnhancedUserContext).toHaveBeenCalledTimes(1);
            });

            // Simulate impersonation change
            if (storeCallback) {
                storeCallback(
                    { impersonationUserId: 'new-user-id' },
                    { impersonationUserId: null }
                );
            }

            await vi.waitFor(() => {
                expect(DataService.getEnhancedUserContext).toHaveBeenCalledTimes(2);
            });
        });

        it('should not reload when impersonation stays the same', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => {
                expect(DataService.getEnhancedUserContext).toHaveBeenCalledTimes(1);
            });

            // Simulate other state change (not impersonation)
            if (storeCallback) {
                storeCallback(
                    { impersonationUserId: null, theme: 'dark' },
                    { impersonationUserId: null, theme: 'light' }
                );
            }

            // Should still be 1, not increased
            expect(DataService.getEnhancedUserContext).toHaveBeenCalledTimes(1);
        });
    });

    describe('abort controller / race condition handling', () => {
        it('should abort previous request when new load is triggered', async () => {
            let resolveFirst;
            const firstPromise = new Promise((resolve) => {
                resolveFirst = resolve;
            });

            DataService.getEnhancedUserContext.mockImplementationOnce(() => firstPromise);
            DataService.getEnhancedUserContext.mockResolvedValueOnce(mockUserContext);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // First load is in progress, trigger second load via impersonation change
            if (storeCallback) {
                storeCallback(
                    { impersonationUserId: 'another-user' },
                    { impersonationUserId: null }
                );
            }

            // Now resolve the first one
            resolveFirst(mockUserContext);

            await vi.waitFor(() => {
                expect(DataService.getEnhancedUserContext).toHaveBeenCalledTimes(2);
            });
        });

        it('should set _inflight to null after load completes', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => {
                expect(element.querySelector('.pdt-card')).toBeTruthy();
            });

            expect(component._inflight).toBeNull();
        });

        it('should handle AbortError gracefully', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            DataService.getEnhancedUserContext.mockRejectedValue(abortError);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Should not show error for AbortError
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(element.querySelector('.pdt-error')).toBeFalsy();
        });
    });

    describe('empty roles handling', () => {
        it('should display "No roles found" message when roles array is empty', async () => {
            const contextWithNoRoles = {
                ...mockUserContext,
                user: { ...mockUserContext.user, roles: [] }
            };
            DataService.getEnhancedUserContext.mockResolvedValue(contextWithNoRoles);
            // Also mock SecurityAnalysisService to return empty roles
            SecurityAnalysisService.getUserRoles.mockResolvedValueOnce([]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => {
                expect(element.textContent).toContain('No roles found');
            });
        });

        it('should display "(0)" in roles header when no roles', async () => {
            const contextWithNoRoles = {
                ...mockUserContext,
                user: { ...mockUserContext.user, roles: [] }
            };
            DataService.getEnhancedUserContext.mockResolvedValue(contextWithNoRoles);
            // Also mock SecurityAnalysisService to return empty roles
            SecurityAnalysisService.getUserRoles.mockResolvedValueOnce([]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => {
                expect(element.textContent).toContain('(0)');
            });
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should remove click event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should remove keydown event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('should call unsubscribe from Store', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const unsubscribe = component.unsubscribe;
            component.destroy();

            expect(component.unsubscribe).toBeNull();
        });

        it('should abort inflight requests', async () => {
            let resolveLoad;
            DataService.getEnhancedUserContext.mockImplementation(() => new Promise((resolve) => {
                resolveLoad = resolve;
            }));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const inflight = component._inflight;
            expect(inflight).not.toBeNull();

            const abortSpy = vi.spyOn(inflight, 'abort');
            component.destroy();

            expect(abortSpy).toHaveBeenCalled();
        });

        it('should set all handler references to null', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.destroy();

            expect(component._handleClick).toBeNull();
            expect(component._handleKeydown).toBeNull();
            expect(component._inflight).toBeNull();
            expect(component.unsubscribe).toBeNull();
        });

        it('should be safe to call destroy multiple times', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(() => {
                component.destroy();
                component.destroy();
                component.destroy();
            }).not.toThrow();
        });
    });

    describe('card rendering structure', () => {
        it('should render User Settings card with correct header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('User Settings');
            });
        });

        it('should render Client & Session card', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Client & Session');
            });
        });

        it('should render Organization Details card', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Organization Details');
            });
        });

        it('should render card emojis', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const emojis = element.querySelectorAll('.pdt-card-emoji');
                expect(emojis.length).toBe(3);
            });
        });

        it('should render info grid within card body', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.info-grid')).toBeTruthy();
            });
        });

        it('should render role list as unordered list', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const roleSections = element.querySelectorAll('.pdt-role-section .pdt-list');
                expect(roleSections.length).toBeGreaterThan(0);
            });
        });

        it('should render role IDs with copyable class', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.querySelector('.pdt-copyable-id.copyable')).toBeTruthy();
            });
        });

        it('should display "via team:" badge for inherited roles', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('via team: Sales Team');
            });
        });

        it('should display "Direct" badge for direct roles', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Direct');
            });
        });

        it('should display multiple team names for roles inherited from multiple teams', async () => {
            // Mock both getUserTeams and getUserRoles for this specific test
            SecurityAnalysisService.getUserTeams.mockResolvedValueOnce(mockTeams);
            SecurityAnalysisService.getUserRoles.mockResolvedValueOnce([
                {
                    roleid: 'role-1',
                    name: 'Shared Role',
                    isInherited: true,
                    teams: [
                        { teamId: 'team-1', teamName: 'Sales Team' },
                        { teamId: 'team-2', teamName: 'Marketing Team' }
                    ]
                }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('via team: Sales Team, Marketing Team');
            });
        });

        it('should use fallback role ID from context when roleid is not present', async () => {
            // Simulate fallback to context roles (which have 'id' instead of 'roleid')
            SecurityAnalysisService.getUserTeams.mockRejectedValueOnce(new Error('API Error'));
            SecurityAnalysisService.getUserRoles.mockRejectedValueOnce(new Error('API Error'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                // Should display IDs from mockUserContext roles (which use 'id' property)
                expect(element.textContent).toContain('role-1-id');
                expect(element.textContent).toContain('role-2-id');
            });
        });

        it('should display "Inherited from Team" for roles without team details', async () => {
            SecurityAnalysisService.getUserTeams.mockResolvedValueOnce(mockTeams);
            SecurityAnalysisService.getUserRoles.mockResolvedValueOnce([
                { roleid: 'role-1', name: 'Mystery Role', isInherited: true }
                // No teams array
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Inherited from Team');
            });
        });

        it('should render Security Roles with same list styling as Team Memberships', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                // Both should use .pdt-list without pdt-role-list
                const lists = element.querySelectorAll('.pdt-role-section .pdt-list');
                expect(lists.length).toBeGreaterThanOrEqual(2); // At least teams and roles

                // Ensure no .pdt-role-list class is used
                const roleLists = element.querySelectorAll('.pdt-role-list');
                expect(roleLists.length).toBe(0);
            });
        });
    });

    describe('accessibility', () => {
        it('should have tabindex on copyable elements for keyboard access', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const copyables = element.querySelectorAll('.copyable[tabindex="0"]');
                expect(copyables.length).toBeGreaterThan(0);
            });
        });

        it('should have title attribute on copyable elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const copyables = element.querySelectorAll('.copyable[title]');
                expect(copyables.length).toBeGreaterThan(0);
            });
        });

        it('should use semantic section elements for cards', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const sections = element.querySelectorAll('section.pdt-card');
                expect(sections.length).toBe(3);
            });
        });

        it('should use header elements within cards', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const headers = element.querySelectorAll('.pdt-card-header');
                expect(headers.length).toBe(3);
            });
        });
    });

    describe('display values formatting', () => {
        it('should display Form Factor from client info', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Desktop');
            });
        });

        it('should display Is Offline boolean value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('false');
            });
        });

        it('should display Auto-Save setting', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('true');
            });
        });

        it('should display language ID', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('1033');
            });
        });

        it('should display timestamp from session', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('2026-01-02');
            });
        });

        it('should display App URL with copyable class', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('https://org.crm.dynamics.com');
            });
        });
    });

    describe('team memberships', () => {
        it('should fetch user teams and roles after loading context', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(SecurityAnalysisService.getUserTeams).toHaveBeenCalledWith('12345-67890-abcde');
                expect(SecurityAnalysisService.getUserRoles).toHaveBeenCalledWith('12345-67890-abcde');
            });
        });

        it('should display Team Memberships section header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Team Memberships');
            });
        });

        it('should display team count in section header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toMatch(/Team Memberships \(2\)/);
            });
        });

        it('should display team names', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Sales Team');
                expect(element.textContent).toContain('Marketing Team');
            });
        });

        it('should display team IDs with copyable class', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const copyableIds = element.querySelectorAll('.pdt-copyable-id');
                const teamIds = Array.from(copyableIds).map(el => el.textContent);
                expect(teamIds).toContain('team-1-id');
                expect(teamIds).toContain('team-2-id');
            });
        });

        it('should display team types as badges', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const badges = element.querySelectorAll('.pdt-badge-small');
                const teamTypes = Array.from(badges).map(el => el.textContent);
                expect(teamTypes).toContain('Owner');
                expect(teamTypes).toContain('Access');
            });
        });

        it('should render teams with pdt-list-item class', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const listItems = element.querySelectorAll('.pdt-list-item');
                expect(listItems.length).toBeGreaterThanOrEqual(2);
            });
        });

        it('should render teams in pdt-role-section container', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const roleSection = element.querySelector('.pdt-role-section');
                expect(roleSection).toBeTruthy();
            });
        });

        it('should display Team Memberships above Security Roles', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const headers = Array.from(element.querySelectorAll('.pdt-section-header'));
                const headerTexts = headers.map(h => h.textContent);
                const teamsIndex = headerTexts.findIndex(t => t.includes('Team Memberships'));
                const rolesIndex = headerTexts.findIndex(t => t.includes('Security Roles'));
                expect(teamsIndex).toBeGreaterThan(-1);
                expect(rolesIndex).toBeGreaterThan(-1);
                expect(teamsIndex).toBeLessThan(rolesIndex);
            });
        });

        it('should handle empty teams array', async () => {
            SecurityAnalysisService.getUserTeams.mockResolvedValueOnce([]);
            SecurityAnalysisService.getUserRoles.mockResolvedValueOnce([]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Team Memberships (0)');
                expect(element.textContent).toContain('No team memberships found');
            });
        });

        it('should handle null teams response', async () => {
            SecurityAnalysisService.getUserTeams.mockResolvedValueOnce(null);
            SecurityAnalysisService.getUserRoles.mockResolvedValueOnce([]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                expect(element.textContent).toContain('Team Memberships (0)');
            });
        });

        it('should handle teams fetch error gracefully', async () => {
            SecurityAnalysisService.getUserTeams.mockRejectedValueOnce(new Error('API Error'));
            SecurityAnalysisService.getUserRoles.mockRejectedValueOnce(new Error('API Error'));
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            // Should still render the page with fallback roles from context
            await vi.waitFor(() => {
                expect(element.textContent).toContain('User & Session Context');
                expect(element.textContent).toContain('Security Roles (2)');
            });
        });

        it('should allow clicking team IDs to copy (via delegation)', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.waitFor(() => {
                const copyableId = element.querySelector('.pdt-copyable-id');
                expect(copyableId).toBeTruthy();
            });

            const copyableId = element.querySelector('.pdt-copyable-id');
            copyableId.click();

            await vi.waitFor(() => {
                expect(copyToClipboard).toHaveBeenCalled();
            });
        });
    });
});
