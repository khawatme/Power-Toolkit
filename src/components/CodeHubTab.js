/**
 * @file Code Hub component.
 * @module components/CodeHubTab
 * @description A searchable, best-practice library of modern JavaScript code snippets for Power Apps (Model-driven apps).
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { UIFactory } from '../ui/UIFactory.js';
import { buildSearchIndex, debounce, escapeHtml, setAllAccordionCategories, toggleAccordionCategory } from '../helpers/index.js';
import codeSnippetsData from '../data/codeSnippets.json';

/**
 * @typedef {object} CodeSnippet
 * @property {string} t  - Title
 * @property {string} d  - Description
 * @property {string} c  - Code
 * @property {string[]} [tags] - Search tags (optional)
 * @property {string}  [lang] - Language for syntax hint (defaults to 'javascript')
 */

/**
 * @typedef {object} SnippetCategory
 * @property {string} description
 * @property {CodeSnippet[]} snippets
 */

/**
 * A searchable, accessible code library for Model-driven app development.
 * @extends {BaseComponent}
 */
export class CodeHubTab extends BaseComponent {
    constructor() {
        super('codeHub', 'Code Hub', ICONS.codeHub);
        /** @type {{[category: string]: SnippetCategory}} */
        this.snippets = codeSnippetsData;
        /** @type {{container?:HTMLElement, search?:HTMLInputElement}} */
        this.ui = {};
        this.filterSnippets = debounce(this._filterSnippets, 200);

        // Handler references for cleanup
        /** @private {Function|null} */ this._searchInputHandler = null;
        /** @private {Function|null} */ this._clearButtonHandler = null;
        /** @private {Function|null} */ this._accordionClickHandler = null;
        /** @private {Function|null} */ this._accordionKeydownHandler = null;
        /** @private {HTMLElement|null} */ this._clearButton = null;
    }

    /** @returns {Promise<HTMLElement>} */
    async render() {
        const root = document.createElement('div');

        // Title
        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = 'Code Hub';

        // Toolbar (search + clear)
        const bar = document.createElement('div');
        bar.className = 'pdt-toolbar';
        bar.innerHTML = `
      <input id="codehub-search" class="pdt-input" type="text"
             placeholder="Search (e.g. prevent save, navigateTo, lookup filter)…"
             aria-label="Search code snippets" />
      <div class="pdt-toolbar-group">
        <button id="codehub-clear" class="modern-button" title="Clear search">Clear</button>
      </div>
    `;

        // Content
        const host = document.createElement('div');
        host.className = 'pdt-content-host';
        host.appendChild(this._buildCategories());

        root.append(title, bar, host);
        return root;
    }

    /** @param {HTMLElement} element */
    postRender(element) {
        this.ui.container = element;
        this.ui.search = element.querySelector('#codehub-search');
        this._clearButton = element.querySelector('#codehub-clear');

        // Store handlers for cleanup
        this._searchInputHandler = () => this.filterSnippets();
        this._clearButtonHandler = () => {
            this.ui.search.value = '';
            this.filterSnippets();
            // Collapse all when search is cleared
            setAllAccordionCategories(this.ui.container, '.codehub-category', false);
        };
        this._accordionClickHandler = (e) => {
            const header = e.target.closest('.codehub-category-header');
            if (!header) {
                return;
            }
            toggleAccordionCategory(header.parentElement);
        };
        this._accordionKeydownHandler = (e) => {
            const header = e.target.closest('.codehub-category-header');
            if (!header) {
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleAccordionCategory(header.parentElement);
            }
        };

        // Attach listeners
        this.ui.search.addEventListener('input', this._searchInputHandler);
        this._clearButton.addEventListener('click', this._clearButtonHandler);
        element.addEventListener('click', this._accordionClickHandler);
        element.addEventListener('keydown', this._accordionKeydownHandler);
    }

    /** @returns {DocumentFragment} */
    _buildCategories() {
        const frag = document.createDocumentFragment();
        Object.entries(this.snippets).forEach(([name, cat]) => {
            frag.appendChild(this._buildCategory(name, cat));
        });
        return frag;
    }

    /**
     * @param {string} name
     * @param {SnippetCategory} cat
     * @returns {HTMLElement}
     */
    _buildCategory(name, cat) {
        const wrap = document.createElement('div');
        wrap.className = 'codehub-category';
        wrap.setAttribute('role', 'region');
        wrap.setAttribute('aria-label', name);
        wrap.dataset.category = name.toLowerCase();

        const header = document.createElement('div');
        header.className = 'codehub-category-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        header.innerHTML = `
      <div>
        <h4>${escapeHtml(name)}</h4>
        <p class="codehub-category-description">${escapeHtml(cat.description)}</p>
      </div>
    `;

        const list = document.createElement('ul');
        list.className = 'pdt-list codehub-list';

        cat.snippets.forEach(sn => list.appendChild(this._buildSnippet(sn)));

        wrap.append(header, list);
        return wrap;
    }

    /**
     * @param {CodeSnippet} s
     * @returns {HTMLLIElement}
     */
    _buildSnippet(s) {
        const li = document.createElement('li');
        li.className = 'codehub-snippet';

        // Build search payload (title + description + tags + code)
        li.dataset.searchText = buildSearchIndex(
            s.t || '',
            s.d || '',
            ...(s.tags || []),
            s.c || ''
        );

        const title = document.createElement('strong');
        title.textContent = s.t;

        const desc = document.createElement('p');
        desc.className = 'pdt-note';
        desc.textContent = s.d;

        const code = UIFactory.createCopyableCodeBlock(s.c, s.lang || 'javascript');

        li.append(title, desc, code);
        return li;
    }

    /** Filter snippets across title/desc/tags/code; shows only categories with matches. */
    _filterSnippets = () => {
        const term = (this.ui.search.value || '').toLowerCase().trim();
        const categories = this.ui.container.querySelectorAll('.codehub-category');

        categories.forEach(cat => {
            let visibleCount = 0;
            cat.querySelectorAll('.codehub-snippet').forEach(sn => {
                const match = !term || (sn.dataset.searchText || '').includes(term);
                sn.style.display = match ? '' : 'none';
                if (match) {
                    visibleCount++;
                }
            });
            cat.style.display = visibleCount ? '' : 'none';
            // Auto-expand when searching and there are matches
            const header = cat.querySelector('.codehub-category-header');
            if (visibleCount && term) {
                cat.classList.add('expanded');
                header?.setAttribute('aria-expanded', 'true');
            } else if (!term) {
                // collapse back to tidy state if search cleared
                cat.classList.remove('expanded');
                header?.setAttribute('aria-expanded', 'false');
            }
        });
    };

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this.ui.search) {
            this.ui.search.removeEventListener('input', this._searchInputHandler);
        }
        // Cancel any pending debounced filter
        if (this.filterSnippets?.cancel) {
            this.filterSnippets.cancel();
        }
        if (this._clearButton) {
            this._clearButton.removeEventListener('click', this._clearButtonHandler);
        }
        if (this.ui.container) {
            this.ui.container.removeEventListener('click', this._accordionClickHandler);
            this.ui.container.removeEventListener('keydown', this._accordionKeydownHandler);
        }
    }
}

