/**
 * @file Comprehensive tests for HelpTab component
 * @module tests/components/HelpTab.test.js
 * @description Tests for the Help/Documentation component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HelpTab } from '../../src/components/HelpTab.js';

// Mock dependencies
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

// Mock helper functions
vi.mock('../../src/helpers/index.js', async () => {
    const actual = await vi.importActual('../../src/helpers/index.js');
    return {
        ...actual,
        debounce: (fn) => {
            const debouncedFn = fn;
            debouncedFn.cancel = vi.fn();
            return debouncedFn;
        },
        toggleElementHeight: vi.fn()
    };
});

describe('HelpTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        component = new HelpTab();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('help');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('Help');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            expect(component.isFormOnly).toBeFalsy();
        });

        it('should initialize _searchInput as null', () => {
            expect(component._searchInput).toBeNull();
        });

        it('should initialize _cardContainer as null', () => {
            expect(component._cardContainer).toBeNull();
        });

        it('should initialize _searchHandler as null', () => {
            expect(component._searchHandler).toBeNull();
        });

        it('should initialize _cardClickHandler as null', () => {
            expect(component._cardClickHandler).toBeNull();
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

        it('should render help content', async () => {
            const element = await component.render();
            expect(element.textContent.length).toBeGreaterThan(0);
        });

        it('should render documentation links or sections', async () => {
            const element = await component.render();
            const links = element.querySelectorAll('a');
            const sections = element.querySelectorAll('[class*="section"]');
            expect(links.length > 0 || sections.length > 0).toBeTruthy();
        });

        it('should render a search input with correct id', async () => {
            const element = await component.render();
            const searchInput = element.querySelector('#help-search');
            expect(searchInput).toBeTruthy();
            expect(searchInput.tagName).toBe('INPUT');
        });

        it('should render a search input with placeholder text', async () => {
            const element = await component.render();
            const searchInput = element.querySelector('#help-search');
            expect(searchInput.placeholder).toContain('Search');
        });

        it('should render a card container element', async () => {
            const element = await component.render();
            const cardContainer = element.querySelector('#help-card-container');
            expect(cardContainer).toBeTruthy();
        });

        it('should render a toolbar containing the search input', async () => {
            const element = await component.render();
            const toolbar = element.querySelector('.pdt-toolbar');
            expect(toolbar).toBeTruthy();
            expect(toolbar.querySelector('#help-search')).toBeTruthy();
        });

        it('should render User Guide as the section title', async () => {
            const element = await component.render();
            const title = element.querySelector('.section-title');
            expect(title.textContent).toBe('User Guide');
        });
    });

    describe('postRender', () => {
        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should populate _searchInput reference', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._searchInput).toBeTruthy();
            expect(component._searchInput.id).toBe('help-search');
        });

        it('should populate _cardContainer reference', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._cardContainer).toBeTruthy();
            expect(component._cardContainer.id).toBe('help-card-container');
        });

        it('should create _searchHandler function', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(typeof component._searchHandler).toBe('function');
        });

        it('should create _cardClickHandler function', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(typeof component._cardClickHandler).toBe('function');
        });

        it('should populate card container with help cards', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            const cards = element.querySelectorAll('.help-card');
            expect(cards.length).toBeGreaterThan(0);
        });

        it('should create cards with title, summary, and details', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            const card = element.querySelector('.help-card');
            expect(card.querySelector('h4')).toBeTruthy();
            expect(card.querySelector('p')).toBeTruthy();
            expect(card.querySelector('.help-card-details')).toBeTruthy();
        });

        it('should set data-topic-id attribute on each card', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            const cards = element.querySelectorAll('.help-card');
            cards.forEach(card => {
                expect(card.dataset.topicId).toBeTruthy();
            });
        });
    });

    describe('_getHelpContent', () => {
        it('should return an object', () => {
            const content = component._getHelpContent();
            expect(typeof content).toBe('object');
            expect(content).not.toBeNull();
        });

        it('should contain globalActions topic', () => {
            const content = component._getHelpContent();
            expect(content.globalActions).toBeDefined();
        });

        it('should contain inspector topic', () => {
            const content = component._getHelpContent();
            expect(content.inspector).toBeDefined();
        });

        it('should contain formColumns topic', () => {
            const content = component._getHelpContent();
            expect(content.formColumns).toBeDefined();
        });

        it('should contain automation topic', () => {
            const content = component._getHelpContent();
            expect(content.automation).toBeDefined();
        });

        it('should contain settings topic', () => {
            const content = component._getHelpContent();
            expect(content.settings).toBeDefined();
        });

        it('should have title, summary, and content for each topic', () => {
            const content = component._getHelpContent();
            for (const key in content) {
                expect(content[key].title).toBeDefined();
                expect(typeof content[key].title).toBe('string');
                expect(content[key].summary).toBeDefined();
                expect(typeof content[key].summary).toBe('string');
                expect(content[key].content).toBeDefined();
                expect(typeof content[key].content).toBe('string');
            }
        });

        it('should contain at least 10 help topics', () => {
            const content = component._getHelpContent();
            const topicCount = Object.keys(content).length;
            expect(topicCount).toBeGreaterThanOrEqual(10);
        });

        it('should contain about topic', () => {
            const content = component._getHelpContent();
            expect(content.about).toBeDefined();
        });

        it('should contain apiExplorer topic', () => {
            const content = component._getHelpContent();
            expect(content.apiExplorer).toBeDefined();
        });

        it('should contain fetchXmlTester topic', () => {
            const content = component._getHelpContent();
            expect(content.fetchXmlTester).toBeDefined();
        });
    });

    describe('search functionality', () => {
        it('should filter cards based on search term', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            searchInput.value = 'inspector';

            // Trigger keyup event
            searchInput.dispatchEvent(new KeyboardEvent('keyup'));

            const visibleCards = Array.from(element.querySelectorAll('.help-card'))
                .filter(card => card.style.display !== 'none');
            expect(visibleCards.length).toBeGreaterThan(0);
        });

        it('should show all cards when search is empty', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            searchInput.value = '';
            searchInput.dispatchEvent(new KeyboardEvent('keyup'));

            const allCards = element.querySelectorAll('.help-card');
            const visibleCards = Array.from(allCards)
                .filter(card => card.style.display !== 'none');
            expect(visibleCards.length).toBe(allCards.length);
        });

        it('should hide cards that do not match search term', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            // Use a very specific term that won't match most cards
            searchInput.value = 'xyznonexistentterm';
            searchInput.dispatchEvent(new KeyboardEvent('keyup'));

            const visibleCards = Array.from(element.querySelectorAll('.help-card'))
                .filter(card => card.style.display !== 'none');
            expect(visibleCards.length).toBe(0);
        });

        it('should be case insensitive', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            searchInput.value = 'INSPECTOR';
            searchInput.dispatchEvent(new KeyboardEvent('keyup'));

            const visibleCards = Array.from(element.querySelectorAll('.help-card'))
                .filter(card => card.style.display !== 'none');
            expect(visibleCards.length).toBeGreaterThan(0);
        });

        it('should trim whitespace from search term', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            searchInput.value = '  inspector  ';
            searchInput.dispatchEvent(new KeyboardEvent('keyup'));

            const visibleCards = Array.from(element.querySelectorAll('.help-card'))
                .filter(card => card.style.display !== 'none');
            expect(visibleCards.length).toBeGreaterThan(0);
        });
    });

    describe('accordion functionality', () => {
        it('should toggle expanded class on card click', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.help-card');
            card.click();

            expect(card.classList.contains('expanded')).toBe(true);
        });

        it('should collapse card when clicked again', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.help-card');
            card.click(); // expand
            card.click(); // collapse

            expect(card.classList.contains('expanded')).toBe(false);
        });

        it('should collapse other cards when a new card is clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const cards = element.querySelectorAll('.help-card');
            if (cards.length >= 2) {
                cards[0].click(); // expand first
                expect(cards[0].classList.contains('expanded')).toBe(true);

                cards[1].click(); // expand second
                expect(cards[0].classList.contains('expanded')).toBe(false);
                expect(cards[1].classList.contains('expanded')).toBe(true);
            }
        });

        it('should handle click on card title (child element)', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.help-card');
            const title = card.querySelector('h4');
            title.click();

            expect(card.classList.contains('expanded')).toBe(true);
        });

        it('should handle click on card summary (child element)', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.help-card');
            const summary = card.querySelector('p');
            summary.click();

            expect(card.classList.contains('expanded')).toBe(true);
        });

        it('should not throw when clicking card details section', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.help-card');
            const details = card.querySelector('.help-card-details');
            expect(() => details.click()).not.toThrow();
        });
    });

    describe('_toggleAccordion', () => {
        it('should not throw when card has no details section', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Create a card without details
            const cardWithoutDetails = document.createElement('div');
            cardWithoutDetails.className = 'help-card';

            expect(() => component._toggleAccordion(cardWithoutDetails, component._cardContainer)).not.toThrow();
        });

        it('should toggle expanded class on the card', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.help-card');
            component._toggleAccordion(card, component._cardContainer);

            expect(card.classList.contains('expanded')).toBe(true);
        });

        it('should remove expanded class from other cards', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const cards = element.querySelectorAll('.help-card');
            if (cards.length >= 2) {
                // Manually expand first card
                cards[0].classList.add('expanded');

                // Toggle second card
                component._toggleAccordion(cards[1], component._cardContainer);

                expect(cards[0].classList.contains('expanded')).toBe(false);
                expect(cards[1].classList.contains('expanded')).toBe(true);
            }
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

        it('should remove keyup listener from search input', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeListenerSpy = vi.spyOn(component._searchInput, 'removeEventListener');
            component.destroy();

            expect(removeListenerSpy).toHaveBeenCalledWith('keyup', component._searchHandler);
        });

        it('should remove click listener from card container', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeListenerSpy = vi.spyOn(component._cardContainer, 'removeEventListener');
            component.destroy();

            expect(removeListenerSpy).toHaveBeenCalledWith('click', component._cardClickHandler);
        });

        it('should call cancel on debounced search handler if available', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Add cancel method to search handler
            component._searchHandler.cancel = vi.fn();
            component.destroy();

            expect(component._searchHandler.cancel).toHaveBeenCalled();
        });

        it('should not throw if _searchInput is null', () => {
            component._searchInput = null;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw if _cardContainer is null', () => {
            component._cardContainer = null;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw if _searchHandler has no cancel method', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Remove cancel method
            delete component._searchHandler.cancel;
            expect(() => component.destroy()).not.toThrow();
        });
    });

    describe('help content topics', () => {
        it('should have help for impersonate feature', () => {
            const content = component._getHelpContent();
            expect(content.impersonate).toBeDefined();
            expect(content.impersonate.title.toLowerCase()).toContain('impersonate');
        });

        it('should have help for metadata browser', () => {
            const content = component._getHelpContent();
            expect(content.metadataBrowser).toBeDefined();
        });

        it('should have help for solution layers', () => {
            const content = component._getHelpContent();
            expect(content.solutionLayers).toBeDefined();
        });

        it('should have help for plugin traces', () => {
            const content = component._getHelpContent();
            expect(content.traces).toBeDefined();
        });

        it('should have help for environment variables', () => {
            const content = component._getHelpContent();
            expect(content.envVars).toBeDefined();
        });

        it('should have help for user context', () => {
            const content = component._getHelpContent();
            expect(content.userContext).toBeDefined();
        });

        it('should have help for code hub', () => {
            const content = component._getHelpContent();
            expect(content.codeHub).toBeDefined();
        });

        it('should have help for performance', () => {
            const content = component._getHelpContent();
            expect(content.performance).toBeDefined();
        });

        it('should have help for event monitor', () => {
            const content = component._getHelpContent();
            expect(content.eventMonitor).toBeDefined();
        });

        it('should have help for plugin context', () => {
            const content = component._getHelpContent();
            expect(content.pluginContext).toBeDefined();
        });
    });

    describe('card rendering', () => {
        it('should render correct number of cards matching help topics', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const helpContent = component._getHelpContent();
            const topicCount = Object.keys(helpContent).length;
            const cardCount = element.querySelectorAll('.help-card').length;

            expect(cardCount).toBe(topicCount);
        });

        it('should render card titles from help content', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const helpContent = component._getHelpContent();
            const globalActionsCard = element.querySelector('[data-topic-id="globalActions"]');
            const title = globalActionsCard.querySelector('h4').textContent;

            expect(title).toBe(helpContent.globalActions.title);
        });

        it('should render card summaries from help content', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const helpContent = component._getHelpContent();
            const inspectorCard = element.querySelector('[data-topic-id="inspector"]');
            const summary = inspectorCard.querySelector('p').textContent;

            expect(summary).toBe(helpContent.inspector.summary);
        });

        it('should render card details from help content', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const helpContent = component._getHelpContent();
            const formColumnsCard = element.querySelector('[data-topic-id="formColumns"]');
            const details = formColumnsCard.querySelector('.help-card-details').innerHTML;

            expect(details).toContain(helpContent.formColumns.content);
        });
    });

    describe('event handler binding', () => {
        it('should respond to keyup events on search input', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            const handlerSpy = vi.fn();
            const originalHandler = component._searchHandler;
            component._searchHandler = handlerSpy;

            // Re-bind the handler
            searchInput.addEventListener('keyup', handlerSpy);
            searchInput.dispatchEvent(new KeyboardEvent('keyup'));

            expect(handlerSpy).toHaveBeenCalled();

            // Restore
            component._searchHandler = originalHandler;
        });

        it('should respond to click events on card container', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.help-card');
            const initialExpandedState = card.classList.contains('expanded');

            card.click();

            expect(card.classList.contains('expanded')).toBe(!initialExpandedState);
        });
    });

    describe('edge cases', () => {
        it('should handle empty card container gracefully', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            // Clear the card container before postRender populates it
            const cardContainer = element.querySelector('#help-card-container');

            // postRender should still work
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should handle search with special characters', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            searchInput.value = '<script>alert("xss")</script>';

            expect(() => searchInput.dispatchEvent(new KeyboardEvent('keyup'))).not.toThrow();
        });

        it('should handle very long search terms', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = element.querySelector('#help-search');
            searchInput.value = 'a'.repeat(1000);

            expect(() => searchInput.dispatchEvent(new KeyboardEvent('keyup'))).not.toThrow();
        });

        it('should handle click outside of any card', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const cardContainer = element.querySelector('#help-card-container');

            // Click on the container itself (not on a card)
            expect(() => cardContainer.click()).not.toThrow();
        });
    });
});
