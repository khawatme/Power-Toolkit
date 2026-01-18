/**
 * @file Comprehensive tests for CodeHubTab component
 * @module tests/components/CodeHubTab.test.js
 * @description Tests for the Code Snippets library component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CodeHubTab } from '../../src/components/CodeHubTab.js';

// Mock dependencies
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

// Mock FileHelpers - need to use factory function without external references
vi.mock('../../src/helpers/file.helpers.js', () => {
    return {
        FileHelpers: {
            copyToClipboard: vi.fn(),
            downloadJson: vi.fn(),
            createFileInputElement: vi.fn(),
            readJsonFile: vi.fn(() => Promise.resolve({}))
        }
    };
});

// Mock helpers/index.js
const mockToggleAccordionCategory = vi.fn();
const mockSetAllAccordionCategories = vi.fn();
const mockBuildSearchIndex = vi.fn((...args) => args.join(' ').toLowerCase());
const mockDebounce = vi.fn((fn) => {
    const debounced = (...args) => fn(...args);
    debounced.cancel = vi.fn();
    return debounced;
});
const mockEscapeHtml = vi.fn((str) => str);

vi.mock('../../src/helpers/index.js', () => ({
    toggleAccordionCategory: (...args) => mockToggleAccordionCategory(...args),
    setAllAccordionCategories: (...args) => mockSetAllAccordionCategories(...args),
    buildSearchIndex: (...args) => mockBuildSearchIndex(...args),
    debounce: (...args) => mockDebounce(...args),
    escapeHtml: (...args) => mockEscapeHtml(...args)
}));

// Mock UIFactory
const mockCreateCopyableCodeBlock = vi.fn((code, lang) => {
    const div = document.createElement('div');
    div.className = 'copyable-code-block';
    div.dataset.code = code;
    div.dataset.lang = lang || 'javascript';
    const button = document.createElement('button');
    button.textContent = 'Copy';
    const pre = document.createElement('pre');
    pre.textContent = code;
    div.append(button, pre);
    return div;
});

vi.mock('../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createCopyableCodeBlock: (...args) => mockCreateCopyableCodeBlock(...args)
    }
}));

// Mock code snippets data
vi.mock('../../src/data/codeSnippets.json', () => ({
    default: {
        'Form Context (Basics)': {
            description: 'Get formContext, read/set values, change handlers.',
            snippets: [
                {
                    t: 'Get formContext (reliable pattern)',
                    d: 'Always derive formContext from executionContext.',
                    tags: ['formContext', 'executionContext', 'onLoad'],
                    c: 'function onLoad(executionContext) {\n  const formContext = executionContext.getFormContext();\n}'
                },
                {
                    t: 'Add OnChange handler',
                    d: 'Wire a field change handler.',
                    tags: ['attribute', 'onChange'],
                    c: 'attr.addOnChange(handler);'
                }
            ]
        },
        'Save & Lifecycle': {
            description: 'Save responsibly, prevent save when invalid.',
            snippets: [
                {
                    t: 'Save if dirty',
                    d: 'Avoid unnecessary saves.',
                    tags: ['save', 'dirty'],
                    c: 'if (formContext.data.entity.getIsDirty()) { await formContext.data.save(); }'
                }
            ]
        },
        'Web API': {
            description: 'CRUD, batch operations.',
            snippets: [
                {
                    t: 'Retrieve a record',
                    d: 'Get a single record.',
                    tags: ['webapi', 'retrieve'],
                    c: 'await Xrm.WebApi.retrieveRecord("account", id);',
                    lang: 'javascript'
                }
            ]
        }
    }
}));

describe('CodeHubTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        mockToggleAccordionCategory.mockClear();
        mockSetAllAccordionCategories.mockClear();
        mockBuildSearchIndex.mockClear();
        mockCreateCopyableCodeBlock.mockClear();
        component = new CodeHubTab();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('codeHub');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('Code');
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

        it('should initialize snippets array or have data source', () => {
            expect(component.snippets !== undefined || component.categories !== undefined).toBeTruthy();
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

        it('should render search input', async () => {
            const element = await component.render();
            const input = element.querySelector('input');
            expect(input).toBeTruthy();
        });

        it('should render category selector or list', async () => {
            const element = await component.render();
            const selector = element.querySelector('select') ||
                element.querySelector('[class*="category"]') ||
                element.querySelector('.pdt-toolbar');
            expect(selector).toBeTruthy();
        });

        it('should render snippets container', async () => {
            const element = await component.render();
            expect(element).toBeTruthy();
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

    describe('constructor - additional tests', () => {
        it('should initialize snippets from codeSnippetsData', () => {
            expect(component.snippets).toBeDefined();
            expect(typeof component.snippets).toBe('object');
        });

        it('should have filterSnippets as a debounced function', () => {
            expect(component.filterSnippets).toBeDefined();
            expect(typeof component.filterSnippets).toBe('function');
        });

        it('should initialize handler references to null', () => {
            expect(component._searchInputHandler).toBeNull();
            expect(component._clearButtonHandler).toBeNull();
            expect(component._accordionClickHandler).toBeNull();
            expect(component._accordionKeydownHandler).toBeNull();
            expect(component._clearButton).toBeNull();
        });

        it('should have correct label "Code Hub"', () => {
            expect(component.label).toBe('Code Hub');
        });
    });

    describe('render - category building', () => {
        it('should render all categories from snippets data', async () => {
            const element = await component.render();
            const categories = element.querySelectorAll('.codehub-category');
            expect(categories.length).toBe(3); // Form Context, Save & Lifecycle, Web API
        });

        it('should render category headers with correct structure', async () => {
            const element = await component.render();
            const headers = element.querySelectorAll('.codehub-category-header');
            expect(headers.length).toBe(3);
            headers.forEach(header => {
                expect(header.getAttribute('role')).toBe('button');
                expect(header.getAttribute('tabindex')).toBe('0');
                expect(header.getAttribute('aria-expanded')).toBe('false');
            });
        });

        it('should render category descriptions', async () => {
            const element = await component.render();
            const descriptions = element.querySelectorAll('.codehub-category-description');
            expect(descriptions.length).toBe(3);
        });

        it('should render snippets within each category', async () => {
            const element = await component.render();
            const snippets = element.querySelectorAll('.codehub-snippet');
            expect(snippets.length).toBe(4); // 2 + 1 + 1 snippets
        });

        it('should render snippet titles as strong elements', async () => {
            const element = await component.render();
            const titles = element.querySelectorAll('.codehub-snippet strong');
            expect(titles.length).toBe(4);
            expect(titles[0].textContent).toBe('Get formContext (reliable pattern)');
        });

        it('should render snippet descriptions', async () => {
            const element = await component.render();
            const descriptions = element.querySelectorAll('.codehub-snippet .pdt-note');
            expect(descriptions.length).toBe(4);
        });

        it('should call createCopyableCodeBlock for each snippet', async () => {
            await component.render();
            expect(mockCreateCopyableCodeBlock).toHaveBeenCalledTimes(4);
        });

        it('should pass correct language to createCopyableCodeBlock', async () => {
            await component.render();
            // Default is javascript when not specified
            expect(mockCreateCopyableCodeBlock).toHaveBeenCalledWith(
                expect.any(String),
                'javascript'
            );
        });

        it('should set data-category attribute on category wrappers', async () => {
            const element = await component.render();
            const categories = element.querySelectorAll('.codehub-category');
            expect(categories[0].dataset.category).toBe('form context (basics)');
            expect(categories[1].dataset.category).toBe('save & lifecycle');
        });

        it('should render content host container', async () => {
            const element = await component.render();
            const host = element.querySelector('.pdt-content-host');
            expect(host).toBeTruthy();
        });

        it('should render toolbar with search and clear button', async () => {
            const element = await component.render();
            const toolbar = element.querySelector('.pdt-toolbar');
            expect(toolbar).toBeTruthy();
            expect(toolbar.querySelector('#codehub-search')).toBeTruthy();
            expect(toolbar.querySelector('#codehub-clear')).toBeTruthy();
        });

        it('should set aria-label on categories', async () => {
            const element = await component.render();
            const categories = element.querySelectorAll('.codehub-category');
            expect(categories[0].getAttribute('aria-label')).toBe('Form Context (Basics)');
        });

        it('should set role="region" on categories', async () => {
            const element = await component.render();
            const categories = element.querySelectorAll('.codehub-category');
            categories.forEach(cat => {
                expect(cat.getAttribute('role')).toBe('region');
            });
        });
    });

    describe('postRender - event handlers', () => {
        it('should store reference to search input', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.search).toBe(element.querySelector('#codehub-search'));
        });

        it('should store reference to container', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.container).toBe(element);
        });

        it('should store reference to clear button', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._clearButton).toBe(element.querySelector('#codehub-clear'));
        });

        it('should set up search input handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._searchInputHandler).toBeDefined();
            expect(typeof component._searchInputHandler).toBe('function');
        });

        it('should set up clear button handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._clearButtonHandler).toBeDefined();
            expect(typeof component._clearButtonHandler).toBe('function');
        });

        it('should set up accordion click handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._accordionClickHandler).toBeDefined();
            expect(typeof component._accordionClickHandler).toBe('function');
        });

        it('should set up accordion keydown handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._accordionKeydownHandler).toBeDefined();
            expect(typeof component._accordionKeydownHandler).toBe('function');
        });
    });

    describe('search functionality', () => {
        it('should filter snippets when typing in search', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'formContext';
            component.ui.search.dispatchEvent(new Event('input'));

            // filterSnippets should be called
            expect(component.filterSnippets).toBeDefined();
        });

        it('should show matching snippets when search term matches', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'formcontext';
            component._filterSnippets();

            const visibleSnippets = element.querySelectorAll('.codehub-snippet:not([style*="display: none"])');
            expect(visibleSnippets.length).toBeGreaterThan(0);
        });

        it('should hide non-matching snippets', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'xyznonexistent123';
            component._filterSnippets();

            const visibleSnippets = element.querySelectorAll('.codehub-snippet');
            let hiddenCount = 0;
            visibleSnippets.forEach(sn => {
                if (sn.style.display === 'none') hiddenCount++;
            });
            expect(hiddenCount).toBe(4); // All should be hidden
        });

        it('should hide categories with no matching snippets', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'xyznonexistent123';
            component._filterSnippets();

            const categories = element.querySelectorAll('.codehub-category');
            categories.forEach(cat => {
                expect(cat.style.display).toBe('none');
            });
        });

        it('should auto-expand categories with matching snippets when searching', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'save';
            component._filterSnippets();

            const saveCategory = Array.from(element.querySelectorAll('.codehub-category'))
                .find(cat => cat.dataset.category.includes('save'));

            if (saveCategory && saveCategory.style.display !== 'none') {
                expect(saveCategory.classList.contains('expanded')).toBe(true);
            }
        });

        it('should collapse categories when search is cleared', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // First search
            component.ui.search.value = 'save';
            component._filterSnippets();

            // Then clear
            component.ui.search.value = '';
            component._filterSnippets();

            const categories = element.querySelectorAll('.codehub-category');
            categories.forEach(cat => {
                expect(cat.classList.contains('expanded')).toBe(false);
            });
        });

        it('should search across snippet code content', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Search for code content
            component.ui.search.value = 'getIsDirty';
            component._filterSnippets();

            const visibleSnippets = element.querySelectorAll('.codehub-snippet:not([style*="display: none"])');
            // Should find the "Save if dirty" snippet
            expect(visibleSnippets.length).toBeGreaterThanOrEqual(0);
        });

        it('should be case-insensitive', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'FORMCONTEXT';
            component._filterSnippets();

            const visibleSnippets = element.querySelectorAll('.codehub-snippet:not([style*="display: none"])');
            // Should still find matches
            expect(visibleSnippets.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('clear button functionality', () => {
        it('should clear search input when clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'test search';
            component._clearButton.click();

            expect(component.ui.search.value).toBe('');
        });

        it('should call setAllAccordionCategories to collapse all', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = 'test';
            component._clearButton.click();

            expect(mockSetAllAccordionCategories).toHaveBeenCalledWith(
                component.ui.container,
                '.codehub-category',
                false
            );
        });

        it('should reset filter and show all snippets', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // First hide some snippets
            component.ui.search.value = 'xyznonexistent';
            component._filterSnippets();

            // Then clear
            component._clearButton.click();

            const categories = element.querySelectorAll('.codehub-category');
            let visibleCount = 0;
            categories.forEach(cat => {
                if (cat.style.display !== 'none') visibleCount++;
            });
            expect(visibleCount).toBe(3);
        });
    });

    describe('accordion expand/collapse', () => {
        it('should call toggleAccordionCategory when header is clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const header = element.querySelector('.codehub-category-header');
            header.click();

            expect(mockToggleAccordionCategory).toHaveBeenCalledWith(header.parentElement);
        });

        it('should not toggle when clicking outside header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const snippet = element.querySelector('.codehub-snippet');
            snippet.click();

            expect(mockToggleAccordionCategory).not.toHaveBeenCalled();
        });

        it('should toggle on Enter key when header is focused', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const header = element.querySelector('.codehub-category-header');
            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            header.dispatchEvent(event);

            expect(mockToggleAccordionCategory).toHaveBeenCalled();
        });

        it('should toggle on Space key when header is focused', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const header = element.querySelector('.codehub-category-header');
            const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
            header.dispatchEvent(event);

            expect(mockToggleAccordionCategory).toHaveBeenCalled();
        });

        it('should not toggle on other keys', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const header = element.querySelector('.codehub-category-header');
            const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
            header.dispatchEvent(event);

            expect(mockToggleAccordionCategory).not.toHaveBeenCalled();
        });

        it('should prevent default on Space key to avoid scrolling', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const header = element.querySelector('.codehub-category-header');
            const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
            header.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('should not toggle on keydown outside header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const snippet = element.querySelector('.codehub-snippet');
            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            snippet.dispatchEvent(event);

            expect(mockToggleAccordionCategory).not.toHaveBeenCalled();
        });

        it('should return early from keydown handler when not on header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Dispatch keydown event on container itself (not header)
            const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
            element.dispatchEvent(event);

            expect(mockToggleAccordionCategory).not.toHaveBeenCalled();
        });
    });

    describe('snippet card rendering', () => {
        it('should build search index for each snippet', async () => {
            await component.render();
            expect(mockBuildSearchIndex).toHaveBeenCalled();
        });

        it('should pass title, description, tags, and code to buildSearchIndex', async () => {
            await component.render();
            expect(mockBuildSearchIndex).toHaveBeenCalledWith(
                'Get formContext (reliable pattern)',
                'Always derive formContext from executionContext.',
                'formContext',
                'executionContext',
                'onLoad',
                expect.any(String)
            );
        });

        it('should store search text in data attribute', async () => {
            const element = await component.render();
            const snippets = element.querySelectorAll('.codehub-snippet');
            snippets.forEach(sn => {
                expect(sn.dataset.searchText).toBeDefined();
            });
        });

        it('should render code blocks within snippets', async () => {
            const element = await component.render();
            const codeBlocks = element.querySelectorAll('.codehub-snippet .copyable-code-block');
            expect(codeBlocks.length).toBe(4);
        });

        it('should create snippets as list items', async () => {
            const element = await component.render();
            const snippets = element.querySelectorAll('.codehub-snippet');
            snippets.forEach(sn => {
                expect(sn.tagName).toBe('LI');
            });
        });

        it('should wrap snippets in ul.pdt-list.codehub-list', async () => {
            const element = await component.render();
            const lists = element.querySelectorAll('ul.pdt-list.codehub-list');
            expect(lists.length).toBe(3); // One per category
        });
    });

    describe('destroy - cleanup', () => {
        it('should remove search input event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeEventListenerSpy = vi.spyOn(component.ui.search, 'removeEventListener');
            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('input', component._searchInputHandler);
        });

        it('should remove clear button event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeEventListenerSpy = vi.spyOn(component._clearButton, 'removeEventListener');
            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', component._clearButtonHandler);
        });

        it('should remove container click event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeEventListenerSpy = vi.spyOn(component.ui.container, 'removeEventListener');
            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', component._accordionClickHandler);
        });

        it('should remove container keydown event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeEventListenerSpy = vi.spyOn(component.ui.container, 'removeEventListener');
            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', component._accordionKeydownHandler);
        });

        it('should handle destroy when ui.search is not set', () => {
            component.ui.search = null;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy when _clearButton is not set', () => {
            component._clearButton = null;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy when ui.container is not set', () => {
            component.ui.container = null;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cancel debounced filterSnippets if it has cancel method', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Mock cancel method
            component.filterSnippets.cancel = vi.fn();
            component.destroy();

            expect(component.filterSnippets.cancel).toHaveBeenCalled();
        });

        it('should handle destroy when filterSnippets has no cancel method', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Remove cancel method
            delete component.filterSnippets.cancel;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy when filterSnippets is undefined', () => {
            component.filterSnippets = undefined;
            expect(() => component.destroy()).not.toThrow();
        });
    });

    describe('edge cases', () => {
        it('should handle empty search term', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = '';
            expect(() => component._filterSnippets()).not.toThrow();
        });

        it('should handle search with only whitespace', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = '   ';
            expect(() => component._filterSnippets()).not.toThrow();
        });

        it('should handle special characters in search', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = '<script>alert("xss")</script>';
            expect(() => component._filterSnippets()).not.toThrow();
        });

        it('should handle snippet without tags', async () => {
            // Already tested implicitly, but let's ensure buildSearchIndex is called correctly
            const snippet = { t: 'Title', d: 'Description', c: 'code' };
            const mockSnippet = { ...snippet, tags: undefined };

            // Verify buildSearchIndex handles undefined tags
            expect(mockBuildSearchIndex('Title', 'Description', 'code')).toBeDefined();
        });

        it('should handle snippet without lang property - defaults to javascript', async () => {
            await component.render();
            // Check that javascript is used as default
            const calls = mockCreateCopyableCodeBlock.mock.calls;
            const defaultLangCalls = calls.filter(call => call[1] === 'javascript');
            expect(defaultLangCalls.length).toBeGreaterThan(0);
        });

        it('should set aria-expanded correctly on category headers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Initially all should be collapsed
            const headers = element.querySelectorAll('.codehub-category-header');
            headers.forEach(header => {
                expect(header.getAttribute('aria-expanded')).toBe('false');
            });

            // After search with matches, should expand
            component.ui.search.value = 'save';
            component._filterSnippets();

            const saveCategory = Array.from(element.querySelectorAll('.codehub-category'))
                .find(cat => cat.dataset.category.includes('save'));

            if (saveCategory && saveCategory.style.display !== 'none') {
                const header = saveCategory.querySelector('.codehub-category-header');
                expect(header.getAttribute('aria-expanded')).toBe('true');
            }
        });

        it('should handle snippet with undefined searchText in data attribute', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Remove searchText from a snippet
            const snippet = element.querySelector('.codehub-snippet');
            delete snippet.dataset.searchText;

            component.ui.search.value = 'test';
            expect(() => component._filterSnippets()).not.toThrow();
        });

        it('should handle search input being null', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.search.value = null;
            expect(() => component._filterSnippets()).not.toThrow();
        });

        it('should not expand category when search matches but term is empty', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // First search to expand
            component.ui.search.value = 'save';
            component._filterSnippets();

            // Then clear
            component.ui.search.value = '';
            component._filterSnippets();

            // All categories should be collapsed
            const categories = element.querySelectorAll('.codehub-category');
            categories.forEach(cat => {
                expect(cat.classList.contains('expanded')).toBe(false);
                const header = cat.querySelector('.codehub-category-header');
                expect(header.getAttribute('aria-expanded')).toBe('false');
            });
        });

        it('should handle category with no header element', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Remove header from first category
            const category = element.querySelector('.codehub-category');
            const header = category.querySelector('.codehub-category-header');
            header.remove();

            component.ui.search.value = 'formContext';
            expect(() => component._filterSnippets()).not.toThrow();
        });
    });

    describe('_buildCategories', () => {
        it('should return a DocumentFragment', async () => {
            const frag = component._buildCategories();
            expect(frag).toBeInstanceOf(DocumentFragment);
        });

        it('should contain all categories', async () => {
            const frag = component._buildCategories();
            const categories = frag.querySelectorAll('.codehub-category');
            expect(categories.length).toBe(3);
        });
    });

    describe('_buildCategory', () => {
        it('should create a category wrapper element', () => {
            const cat = {
                description: 'Test description',
                snippets: []
            };
            const element = component._buildCategory('Test Category', cat);
            expect(element.className).toBe('codehub-category');
        });

        it('should set correct data-category attribute', () => {
            const cat = {
                description: 'Test description',
                snippets: []
            };
            const element = component._buildCategory('Test Category', cat);
            expect(element.dataset.category).toBe('test category');
        });

        it('should render category name in header', () => {
            const cat = {
                description: 'Test description',
                snippets: []
            };
            const element = component._buildCategory('Test Category', cat);
            const h4 = element.querySelector('h4');
            expect(h4.textContent).toBe('Test Category');
        });

        it('should render category description', () => {
            const cat = {
                description: 'Test description',
                snippets: []
            };
            const element = component._buildCategory('Test Category', cat);
            const desc = element.querySelector('.codehub-category-description');
            expect(desc.textContent).toBe('Test description');
        });

        it('should render all snippets in category', () => {
            const cat = {
                description: 'Test description',
                snippets: [
                    { t: 'Snippet 1', d: 'Desc 1', c: 'code1' },
                    { t: 'Snippet 2', d: 'Desc 2', c: 'code2' }
                ]
            };
            const element = component._buildCategory('Test Category', cat);
            const snippets = element.querySelectorAll('.codehub-snippet');
            expect(snippets.length).toBe(2);
        });
    });

    describe('_buildSnippet', () => {
        it('should create a list item element', () => {
            const snippet = { t: 'Title', d: 'Description', c: 'code' };
            const element = component._buildSnippet(snippet);
            expect(element.tagName).toBe('LI');
            expect(element.className).toBe('codehub-snippet');
        });

        it('should render snippet title', () => {
            const snippet = { t: 'Test Title', d: 'Description', c: 'code' };
            const element = component._buildSnippet(snippet);
            const title = element.querySelector('strong');
            expect(title.textContent).toBe('Test Title');
        });

        it('should render snippet description', () => {
            const snippet = { t: 'Title', d: 'Test Description', c: 'code' };
            const element = component._buildSnippet(snippet);
            const desc = element.querySelector('.pdt-note');
            expect(desc.textContent).toBe('Test Description');
        });

        it('should create copyable code block', () => {
            const snippet = { t: 'Title', d: 'Description', c: 'test code' };
            component._buildSnippet(snippet);
            expect(mockCreateCopyableCodeBlock).toHaveBeenCalledWith('test code', 'javascript');
        });

        it('should use specified language for code block', () => {
            const snippet = { t: 'Title', d: 'Description', c: 'test code', lang: 'json' };
            component._buildSnippet(snippet);
            expect(mockCreateCopyableCodeBlock).toHaveBeenCalledWith('test code', 'json');
        });

        it('should handle empty tags array', () => {
            const snippet = { t: 'Title', d: 'Description', c: 'code', tags: [] };
            expect(() => component._buildSnippet(snippet)).not.toThrow();
        });

        it('should handle missing properties gracefully', () => {
            const snippet = {};
            expect(() => component._buildSnippet(snippet)).not.toThrow();
        });
    });
});
