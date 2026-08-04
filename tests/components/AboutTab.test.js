/**
 * @file Comprehensive tests for AboutTab component
 * @module tests/components/AboutTab.test.js
 * @description Tests for the About/Info component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AboutTab } from '../../src/components/AboutTab.js';

// Mock dependencies
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

describe('AboutTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        component = new AboutTab();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('about');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('About');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            expect(component.isFormOnly).toBeFalsy();
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
        });

        it('should display version information', async () => {
            const element = await component.render();
            const text = element.textContent.toLowerCase();
            expect(text.includes('version') || text.includes('power')).toBeTruthy();
        });

        it('should display author or project information', async () => {
            const element = await component.render();
            expect(element.textContent.length).toBeGreaterThan(0);
        });

        it('should render links or credits', async () => {
            const element = await component.render();
            const links = element.querySelectorAll('a');
            expect(links.length > 0 || element.textContent.length > 50).toBeTruthy();
        });
    });

    describe('what\'s new', () => {
        it('should group the current release by tab', async () => {
            const element = await component.render();
            const groups = [...element.querySelectorAll('.pdt-changelog-group')]
                .map(g => g.textContent);

            expect(groups.some(g => g.includes('AI Workbench'))).toBe(true);
            expect(groups.some(g => g.includes('Metadata Browser'))).toBe(true);
            expect(groups.some(g => g.includes('FetchXML Tester'))).toBe(true);
            expect(groups.some(g => g.includes('WebAPI Explorer'))).toBe(true);
        });

        it('should mark the AI Workbench as a new tab', async () => {
            const element = await component.render();
            const workbench = [...element.querySelectorAll('.pdt-changelog-group')]
                .find(g => g.textContent.includes('AI Workbench'));

            expect(workbench.querySelector('.pdt-badge-small').textContent).toContain('New');
        });

        it('should not badge the AI Workbench as preview', async () => {
            const element = await component.render();
            const workbench = [...element.querySelectorAll('.pdt-changelog-group')]
                .find(g => g.textContent.includes('AI Workbench'));

            expect(workbench.textContent).not.toMatch(/preview/i);
        });

        it('should name a changed tab without an "enhanced" or "fixed" suffix', async () => {
            const element = await component.render();
            const metadata = [...element.querySelectorAll('.pdt-changelog-group')]
                .find(g => g.textContent.includes('Metadata Browser'));

            expect(metadata.textContent.trim()).toBe('Metadata Browser');
            expect(metadata.querySelector('.pdt-badge-small')).toBeNull();
        });

        it('should name a group with no status suffix or badge', async () => {
            const element = await component.render();
            const groups = [...element.querySelectorAll('.pdt-changelog-group')];

            groups.forEach(group => {
                expect(group.textContent).not.toMatch(/—\s*(enhanced|fixed|new)/i);
            });

            // Only the new tab is badged; every other group is just the tab name.
            const badged = groups.filter(g => g.querySelector('.pdt-badge-small'));
            expect(badged).toHaveLength(1);
            expect(badged[0].textContent).toContain('AI Workbench');
        });

        it('should list each tab once', async () => {
            const element = await component.render();
            const names = [...element.querySelectorAll('.pdt-changelog-group')]
                .map(g => g.textContent.trim());

            expect(new Set(names).size).toBe(names.length);
        });

        it('should still list the previous releases', async () => {
            const element = await component.render();
            expect(element.querySelector('.pdt-changelog-previous-releases')).toBeTruthy();
        });
    });

    describe('postRender', () => {
        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
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
    });

    describe('license button', () => {
        it('should show license dialog when license button is clicked', async () => {
            // Need to mock DialogService for this test
            const DialogService = await import('../../src/services/DialogService.js').then(m => m.DialogService);
            vi.spyOn(DialogService, 'show').mockImplementation(() => { });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const licenseBtn = element.querySelector('#view-license-btn');
            expect(licenseBtn).toBeTruthy();

            licenseBtn.click();

            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should not throw when license button does not exist', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            const licenseBtn = element.querySelector('#view-license-btn');
            if (licenseBtn) {
                licenseBtn.remove();
            }

            expect(() => component.postRender(element)).not.toThrow();
        });
    });
});
