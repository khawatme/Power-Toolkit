/**
 * @file UI manipulation and interaction utilities.
 * @module helpers/ui.helpers
 * @description Provides utilities for accordion controls, pagination, table sorting, and UI state management.
 */

/**
 * UI manipulation utility functions.
 * @namespace UIHelpers
 */
export const UIHelpers = {
    /**
     * Updates pagination UI elements with current page state.
     * @param {HTMLButtonElement} prevBtn - Previous page button element.
     * @param {HTMLButtonElement} nextBtn - Next page button element.
     * @param {HTMLElement} pageInfo - Page info text element.
     * @param {number} currentPage - Current page number (1-indexed).
     * @param {boolean} hasNext - Whether there is a next page available.
     */
    updatePaginationUI(prevBtn, nextBtn, pageInfo, currentPage, hasNext) {
        if (pageInfo) {
            pageInfo.textContent = `Page ${currentPage}`;
        }
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = !hasNext;
        }
    },

    /**
     * Toggles an element's height with smooth animation using maxHeight.
     * Useful for expand/collapse effects on details sections.
     * @param {HTMLElement} element - The element to toggle.
     */
    toggleElementHeight(element) {
        if (!element) {
            return;
        }
        const isOpen = element.style.maxHeight && element.style.maxHeight !== '0px';
        element.style.maxHeight = isOpen ? '0px' : `${element.scrollHeight}px`;
    },

    /**
     * Toggles an accordion category's expanded/collapsed state.
     * Manages both CSS class and ARIA attributes for accessibility.
     * @param {HTMLElement} categoryElement - The category element to toggle.
     * @param {string} headerSelector - CSS selector for the header within the category (default: '.codehub-category-header').
     * @returns {boolean} - True if expanded, false if collapsed.
     */
    toggleAccordionCategory(categoryElement, headerSelector = '.codehub-category-header') {
        if (!categoryElement) {
            return false;
        }
        const isExpanded = categoryElement.classList.toggle('expanded');
        const header = categoryElement.querySelector(headerSelector);
        if (header) {
            header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        }
        return isExpanded;
    },

    /**
     * Sets all accordion categories to expanded or collapsed state.
     * Useful for "Expand All" / "Collapse All" functionality.
     * @param {HTMLElement} container - The container element with categories.
     * @param {string} categorySelector - CSS selector for category elements.
     * @param {boolean} expand - True to expand all, false to collapse all.
     * @param {string} headerSelector - CSS selector for headers within categories (default: '.codehub-category-header').
     */
    setAllAccordionCategories(container, categorySelector, expand, headerSelector = '.codehub-category-header') {
        if (!container) {
            return;
        }
        container.querySelectorAll(categorySelector).forEach(cat => {
            if (expand) {
                cat.classList.add('expanded');
            } else {
                cat.classList.remove('expanded');
            }
            const header = cat.querySelector(headerSelector);
            if (header) {
                header.setAttribute('aria-expanded', expand ? 'true' : 'false');
            }
        });
    },

    /**
     * Collapses all accordion items within a container.
     * Removes 'expanded' class and sets maxHeight to 0 for smooth collapse animation.
     * @param {HTMLElement} container - The container element with accordion items.
     * @param {string} itemSelector - CSS selector for accordion items (e.g., '.help-card').
     * @param {string} detailsSelector - CSS selector for the expandable content within each item.
     */
    collapseAllAccordionItems(container, itemSelector, detailsSelector) {
        if (!container) {
            return;
        }
        container.querySelectorAll(`${itemSelector}.expanded`).forEach(item => {
            item.classList.remove('expanded');
            const details = item.querySelector(detailsSelector);
            if (details) {
                details.style.maxHeight = '0px';
            }
        });
    },

    /**
     * Builds a searchable index string from multiple text fields.
     * Combines fields into lowercase string for case-insensitive searching.
     * @param {Array<string>} fields - Array of text values to include in search index.
     * @returns {string} - Lowercase concatenated search index.
     */
    buildSearchIndex(...fields) {
        return fields.filter(f => f).join(' ').toLowerCase();
    },

    /**
     * Sorts an array of objects by a specified column/property in ascending or descending order.
     * Uses case-insensitive localeCompare for string comparisons.
     * @param {Array<object>} array - The array to sort (will be sorted in-place).
     * @param {string} column - The property/column name to sort by.
     * @param {'asc'|'desc'} direction - The sort direction ('asc' for ascending, 'desc' for descending).
     * @returns {Array<object>} The sorted array (same reference as input).
     */
    sortArrayByColumn(array, column, direction = 'asc') {
        if (!Array.isArray(array) || array.length === 0) {
            return array;
        }

        const multiplier = direction === 'asc' ? 1 : -1;
        array.sort((a, b) => {
            const valA = a[column];
            const valB = b[column];

            // Handle null/undefined values
            if ((valA === null || valA === undefined) && (valB === null || valB === undefined)) {
                return 0;
            }
            if (valA === null || valA === undefined) {
                return 1 * multiplier;
            }
            if (valB === null || valB === undefined) {
                return -1 * multiplier;
            }

            // Use localeCompare for string comparison
            return String(valA).localeCompare(String(valB), undefined, { sensitivity: 'base' }) * multiplier;
        });

        return array;
    },

    /**
     * Updates a sort state object when a column is clicked, toggling direction for the same column
     * or resetting to 'asc' for a new column.
     * @param {{column: string, direction: 'asc'|'desc'}} sortState - The current sort state object.
     * @param {string} newColumn - The column being clicked/selected.
     * @returns {{column: string, direction: 'asc'|'desc'}} The updated sort state (same reference).
     */
    toggleSortState(sortState, newColumn) {
        if (sortState.column === newColumn) {
            // Toggle direction for the same column
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, reset to ascending
            sortState.column = newColumn;
            sortState.direction = 'asc';
        }
        return sortState;
    },

    /**
     * Generates HTML for sortable table headers with sort direction indicators.
     * @param {Array<{key: string, label: string}>} headers - Array of header definitions.
     * @param {{column: string, direction: 'asc'|'desc'}} sortState - Current sort state.
     * @returns {string} HTML string for table header row.
     */
    generateSortableTableHeaders(headers, sortState) {
        if (!Array.isArray(headers)) {
            return '';
        }

        // Import escapeHtml dynamically to avoid circular dependency
        const escapeHtml = (str) => {
            const p = document.createElement('p');
            p.textContent = String(str ?? '');
            return p.innerHTML;
        };

        const headerCells = headers.map(header => {
            const isSorted = sortState.column === header.key;
            const sortClass = isSorted ? `sort-${sortState.direction}` : '';
            const ariaSort = isSorted
                ? (sortState.direction === 'asc' ? 'ascending' : 'descending')
                : 'none';

            return `<th class="${sortClass}" data-sort-key="${escapeHtml(header.key)}" aria-sort="${ariaSort}" tabindex="0" role="button" aria-label="Sort by ${escapeHtml(header.label)}">${escapeHtml(header.label)}</th>`;
        }).join('');

        return `<tr>${headerCells}</tr>`;
    },

    /**
     * Initialize column resizing for a table.
     * @param {HTMLTableElement} table - The table element.
     */
    initColumnResize(table) {
        if (!table) {
            return;
        }

        // Defensive cleanup
        try {
            this.destroyColumnResize(table);
        } catch (_) {
            // ignore
        }

        const context = this._prepareTableForResize(table);
        if (!context) {
            return;
        }

        const { headers, headerMap, colgroup, colCount, resizeMode, minWidth, threshold } = context;

        // Attach resizer to each header
        headerMap.forEach((m) => {
            if (m.th.dataset.resizeInit) {
                return;
            }
            m.th.dataset.resizeInit = 'true';

            const resizer = this._createResizerElement(m.end);
            m.th.appendChild(resizer);

            // Ensure parent is positioned
            this._ensureRelativePosition(m.th);

            // Attach event handlers
            const handlers = this._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers,
                headerMap,
                colCount,
                resizeMode,
                minWidth,
                threshold
            });

            this._attachResizeListeners(resizer, handlers);
        });
    },

    /**
     * Prepare table structure for column resizing.
     * @private
     * @param {HTMLTableElement} table - The table element
     * @returns {Object|null} Context object with table structure info
     */
    _prepareTableForResize(table) {
        const headers = this._getTableHeaders(table);
        if (!headers.length) {
            return null;
        }

        const colCount = this._computeColumnCount(table, headers);
        const colgroup = this._ensureColgroup(table, colCount);
        const headerMap = this._buildHeaderMap(headers);
        const resizeMode = table.dataset?.resizeMode || 'shift';
        const minWidth = 30;
        const threshold = 3;

        return { headers, headerMap, colgroup, colCount, resizeMode, minWidth, threshold };
    },

    /**
     * Get table headers (th elements).
     * @private
     * @param {HTMLTableElement} table - The table element
     * @returns {Array<HTMLElement>} Array of th elements
     */
    _getTableHeaders(table) {
        const thead = table.querySelector('thead');
        const theadRows = thead ? Array.from(thead.querySelectorAll('tr')) : [];
        let headerRow = null;

        if (theadRows.length) {
            headerRow = theadRows[theadRows.length - 1];
        } else {
            headerRow = table.querySelector('tr');
        }

        return headerRow ? Array.from(headerRow.querySelectorAll('th')) : [];
    },

    /**
     * Compute total column count accounting for colspans.
     * @private
     * @param {HTMLTableElement} table - The table element
     * @param {Array<HTMLElement>} headers - Array of th elements
     * @returns {number} Total column count
     */
    _computeColumnCount(table, headers) {
        let colCount = 0;
        const thead = table.querySelector('thead');

        if (thead) {
            Array.from(thead.querySelectorAll('tr')).forEach(row => {
                let c = 0;
                Array.from(row.children || []).forEach(cell => {
                    c += (cell.colSpan || 1);
                });
                colCount = Math.max(colCount, c);
            });
        }

        const firstBodyRow = table.querySelector('tbody tr');
        if (firstBodyRow) {
            colCount = Math.max(colCount, firstBodyRow.children.length);
        }

        return colCount || headers.length;
    },

    /**
     * Ensure colgroup exists with correct number of col elements.
     * @private
     * @param {HTMLTableElement} table - The table element
     * @param {number} colCount - Number of columns
     * @returns {HTMLElement} The colgroup element
     */
    _ensureColgroup(table, colCount) {
        let colgroup = table.querySelector('colgroup');

        if (!colgroup) {
            colgroup = document.createElement('colgroup');
            for (let i = 0; i < colCount; i += 1) {
                colgroup.appendChild(document.createElement('col'));
            }
            table.insertBefore(colgroup, table.firstChild);
        } else {
            // Normalize col count
            const cols = Array.from(colgroup.children || []);
            const diff = colCount - cols.length;

            if (diff > 0) {
                for (let i = 0; i < diff; i += 1) {
                    colgroup.appendChild(document.createElement('col'));
                }
            } else if (diff < 0) {
                for (let i = cols.length - 1; i >= colCount; i -= 1) {
                    colgroup.removeChild(cols[i]);
                }
            }
        }

        return colgroup;
    },

    /**
     * Build header map with column span information.
     * @private
     * @param {Array<HTMLElement>} headers - Array of th elements
     * @returns {Array<Object>} Header map with {th, start, end, span}
     */
    _buildHeaderMap(headers) {
        const headerMap = [];
        let colIdx = 0;

        headers.forEach(th => {
            const span = th.colSpan || 1;
            const start = colIdx;
            const end = start + span - 1;
            headerMap.push({ th, start, end, span });
            colIdx += span;
        });

        return headerMap;
    },

    /**
     * Create resizer element with accessibility attributes.
     * @private
     * @param {number} colIndex - Column index
     * @returns {HTMLElement} Resizer element
     */
    _createResizerElement(colIndex) {
        const resizer = document.createElement('div');
        resizer.className = 'pdt-column-resizer';
        resizer.setAttribute('role', 'separator');
        resizer.setAttribute('aria-orientation', 'horizontal');
        resizer.setAttribute('aria-label', 'Resize column');
        resizer.title = 'Drag to resize column';
        resizer.tabIndex = 0;
        resizer.dataset.colIndex = String(colIndex);
        return resizer;
    },

    /**
     * Ensure element has relative positioning for absolute child.
     * @private
     * @param {HTMLElement} element - The element to check
     */
    _ensureRelativePosition(element) {
        try {
            if (window.getComputedStyle(element).position === 'static') {
                element.style.position = 'relative';
            }
        } catch (_) {
            // ignore
        }
    },

    /**
     * Create all event handlers for a resizer.
     * @private
     * @param {Object} config - Configuration object
     * @returns {Object} Handler functions
     */
    _createResizeHandlers(config) {
        const { table, resizer, colgroup, headers, headerMap, colCount, resizeMode, minWidth, threshold } = config;

        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;
        let startTableWidth = 0;
        let dragging = false;
        let preventDocClick = null;

        const getCols = () => Array.from(colgroup.querySelectorAll('col'));
        const getRows = () => Array.from(table.querySelectorAll('tbody tr'));

        const startDrag = (clientX, colIndex) => {
            const cols = getCols();
            const leftCol = cols[colIndex];
            const rightCol = cols[colIndex + 1];
            startX = clientX;
            startLeftWidth = leftCol ? leftCol.getBoundingClientRect().width : headers[colIndex].getBoundingClientRect().width;
            startRightWidth = rightCol ? rightCol.getBoundingClientRect().width : 0;
            startTableWidth = table.getBoundingClientRect().width;
        };

        const lockColumnWidths = () => {
            this._lockTableColumnWidths(table, colgroup, headerMap, colCount, minWidth, getRows);
        };

        const onPointerMove = (e) => {
            const delta = e.clientX - startX;
            if (!dragging && Math.abs(delta) < threshold) {
                return;
            }

            if (!dragging) {
                dragging = true;
                document.body.classList.add('pdt-col-resize-active');
                preventDocClick = (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                };
                document.addEventListener('click', preventDocClick, true);
                lockColumnWidths();

                // Recompute start widths after lock
                const colIndexPost = Number(resizer.dataset.colIndex);
                const colsPost = getCols();
                const leftColPost = colsPost[colIndexPost];
                const rightColPost = colsPost[colIndexPost + 1];
                startLeftWidth = leftColPost ? leftColPost.getBoundingClientRect().width : headers[colIndexPost].getBoundingClientRect().width;
                startRightWidth = rightColPost ? rightColPost.getBoundingClientRect().width : 0;
                startTableWidth = table.getBoundingClientRect().width;
            }

            this._applyColumnResize({
                resizer,
                delta,
                getCols,
                startLeftWidth,
                startRightWidth,
                startTableWidth,
                resizeMode,
                minWidth,
                table
            });
        };

        const endDrag = () => {
            if (preventDocClick) {
                document.removeEventListener('click', preventDocClick, true);
                preventDocClick = null;
            }
            document.body.classList.remove('pdt-col-resize-active');
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', endDrag);
            document.removeEventListener('pointercancel', endDrag);
            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('mouseup', endDrag);
            dragging = false;

            if (resizer._pdtResizeHandlers?.activePointer) {
                try {
                    const ap = resizer._pdtResizeHandlers.activePointer;
                    if (ap?.target?.releasePointerCapture && ap.id !== null) {
                        ap.target.releasePointerCapture(ap.id);
                    }
                } catch (_) {
                    // ignore
                }
                delete resizer._pdtResizeHandlers.activePointer;
            }
        };

        const onPointerDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startDrag(e.clientX, Number(resizer.dataset.colIndex));

            if (e.pointerId) {
                try {
                    e.target.setPointerCapture(e.pointerId);
                } catch (_) {
                    // ignore
                }
            }

            if (e.pointerId) {
                document.addEventListener('pointermove', onPointerMove);
                document.addEventListener('pointerup', endDrag);
                document.addEventListener('pointercancel', endDrag);
            } else {
                document.addEventListener('mousemove', onPointerMove);
                document.addEventListener('mouseup', endDrag);
            }

            if (!resizer._pdtResizeHandlers) {
                resizer._pdtResizeHandlers = {};
            }
            resizer._pdtResizeHandlers.activeDocHandlers = { onMouseMove: onPointerMove, onMouseUp: endDrag };
            if (e.pointerId) {
                resizer._pdtResizeHandlers.activePointer = { id: e.pointerId, target: e.target };
            }
        };

        const onKeyDown = (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                return;
            }

            const colIndex = Number(resizer.dataset.colIndex);
            const cols = getCols();
            const leftCol = cols[colIndex];
            if (!leftCol) {
                return;
            }

            const step = e.shiftKey ? 20 : 5;
            const current = parseFloat(leftCol.style.width || leftCol.getBoundingClientRect().width);
            const newWidth = e.key === 'ArrowLeft' ? Math.max(minWidth, current - step) : current + step;
            leftCol.style.width = `${newWidth}px`;
            e.preventDefault();
        };

        const onMouseDown = (ev) => onPointerDown(ev);
        const stopEvent = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
        };
        const onDragStart = (ev) => {
            ev.preventDefault();
        };

        return { onPointerDown, onMouseDown, onKeyDown, stopEvent, onDragStart };
    },

    /**
     * Lock table column widths to explicit values.
     * @private
     * @param {HTMLTableElement} table - The table element
     * @param {HTMLElement} colgroup - The colgroup element
     * @param {Array<Object>} headerMap - Header map
     * @param {number} colCount - Column count
     * @param {number} minWidth - Minimum column width
     * @param {Function} getRows - Function to get table rows
     */
    _lockTableColumnWidths(table, colgroup, headerMap, colCount, minWidth, getRows) {
        const tableW = Math.max(1, Math.round(table.getBoundingClientRect().width));
        const colWidths = this._computeColumnWidths(headerMap, getRows, colCount, minWidth);
        const scaled = this._scaleColumnWidths(colWidths, tableW, minWidth);
        this._applyColumnWidths(colgroup, headerMap, getRows, scaled, colCount, minWidth);
        table.style.width = `${tableW}px`;
        table.style.tableLayout = 'fixed';
    },

    /**
     * Compute natural column widths from headers and cells.
     * @private
     * @param {Array<Object>} headerMap - Header map
     * @param {Function} getRows - Function to get table rows
     * @param {number} colCount - Column count
     * @param {number} minWidth - Minimum column width
     * @returns {Array<number>} Column widths
     */
    _computeColumnWidths(headerMap, getRows, colCount, minWidth) {
        const colWidths = new Array(colCount).fill(minWidth);

        // Measure headers
        headerMap.forEach((m) => {
            const hW = Math.max(minWidth, Math.round(m.th.getBoundingClientRect().width));
            const per = Math.max(minWidth, Math.floor(hW / Math.max(1, m.span)));
            for (let c = m.start; c <= m.end; c += 1) {
                colWidths[c] = Math.max(colWidths[c], per);
            }
        });

        // Measure body cells
        const rows = getRows();
        rows.forEach((r) => {
            for (let j = 0; j < colCount; j += 1) {
                const cell = r.children[j];
                if (cell) {
                    const w = Math.max(minWidth, Math.ceil((cell.scrollWidth || cell.getBoundingClientRect().width) + 16));
                    colWidths[j] = Math.max(colWidths[j], w);
                }
            }
        });

        return colWidths;
    },

    /**
     * Scale column widths to fit table width exactly.
     * @private
     * @param {Array<number>} colWidths - Natural column widths
     * @param {number} tableW - Target table width
     * @param {number} minWidth - Minimum column width
     * @returns {Array<number>} Scaled column widths
     */
    _scaleColumnWidths(colWidths, tableW, minWidth) {
        const totalW = colWidths.reduce((s, v) => s + v, 0) || 1;
        const scale = tableW / totalW;
        const scaled = colWidths.map((w) => Math.max(minWidth, Math.floor(w * scale)));

        // Fix rounding errors
        let sumScaled = scaled.reduce((s, v) => s + v, 0);

        // Add pixels to reach target
        let i = 0;
        while (sumScaled < tableW) {
            scaled[i % scaled.length] += 1;
            sumScaled += 1;
            i += 1;
        }

        // Remove pixels to reach target
        i = scaled.length - 1;
        let attempts = 0;
        while (sumScaled > tableW && attempts < scaled.length * 2) {
            if (scaled[i] > minWidth) {
                scaled[i] -= 1;
                sumScaled -= 1;
            }
            i = i > 0 ? i - 1 : scaled.length - 1;
            attempts += 1;
        }

        return scaled;
    },

    /**
     * Apply column widths to col elements and cells.
     * @private
     * @param {HTMLElement} colgroup - The colgroup element
     * @param {Array<Object>} headerMap - Header map
     * @param {Function} getRows - Function to get table rows
     * @param {Array<number>} widths - Column widths
     * @param {number} colCount - Column count
     * @param {number} minWidth - Minimum column width
     */
    _applyColumnWidths(colgroup, headerMap, getRows, widths, colCount, minWidth) {
        const cols = Array.from(colgroup.querySelectorAll('col'));

        for (let j = 0; j < colCount; j += 1) {
            const w = widths[j] || minWidth;

            if (cols[j]) {
                cols[j].style.width = `${w}px`;
            }

            const headerForCol = headerMap.find(m => j >= m.start && j <= m.end);
            if (headerForCol?.th) {
                headerForCol.th.style.minWidth = `${w}px`;
            }
        }

        // Apply to body cells
        const rows = getRows();
        rows.forEach((r) => {
            for (let j = 0; j < colCount; j += 1) {
                const td = r.children[j];
                if (td) {
                    td.style.minWidth = `${widths[j] || minWidth}px`;
                }
            }
        });
    },

    /**
     * Apply column resize based on drag delta.
     * @private
     * @param {Object} config - Configuration object
     */
    _applyColumnResize(config) {
        const { resizer, delta, getCols, startLeftWidth, startRightWidth, startTableWidth, resizeMode, minWidth, table } = config;
        const colIndex = Number(resizer.dataset.colIndex);
        const cols = getCols();
        const leftCol = cols[colIndex];
        const rightCol = cols[colIndex + 1];

        if (!leftCol) {
            return;
        }

        if (rightCol) {
            if (resizeMode === 'shift') {
                const desiredLeft = Math.max(minWidth, startLeftWidth + delta);
                leftCol.style.width = `${desiredLeft}px`;
                table.style.width = `${startTableWidth + (desiredLeft - startLeftWidth)}px`;
            } else {
                let desiredLeft = startLeftWidth + delta;
                let desiredRight = startRightWidth - delta;

                if (desiredLeft < minWidth) {
                    desiredLeft = minWidth;
                    desiredRight = Math.max(minWidth, startLeftWidth + startRightWidth - desiredLeft);
                }
                if (desiredRight < minWidth) {
                    desiredRight = minWidth;
                    desiredLeft = Math.max(minWidth, startLeftWidth + startRightWidth - desiredRight);
                }

                leftCol.style.width = `${desiredLeft}px`;
                rightCol.style.width = `${desiredRight}px`;
            }
        } else {
            const desiredLeft = Math.max(minWidth, startLeftWidth + delta);
            leftCol.style.width = `${desiredLeft}px`;
            table.style.width = `${startTableWidth + (desiredLeft - startLeftWidth)}px`;
        }
    },

    /**
     * Attach event listeners to resizer element.
     * @private
     * @param {HTMLElement} resizer - Resizer element
     * @param {Object} handlers - Handler functions
     */
    _attachResizeListeners(resizer, handlers) {
        if (typeof window !== 'undefined' && window.PointerEvent) {
            resizer.addEventListener('pointerdown', handlers.onPointerDown);
        } else {
            resizer.addEventListener('mousedown', handlers.onMouseDown);
        }
        resizer.addEventListener('keydown', handlers.onKeyDown);
        resizer.addEventListener('click', handlers.stopEvent);
        resizer.addEventListener('dblclick', handlers.stopEvent);
        resizer.addEventListener('dragstart', handlers.onDragStart);

        resizer._pdtResizeHandlers = handlers;
    },

    /**
     * Remove any column-resize handlers for a table previously initialized by initColumnResize.
     * Use this to clean up event listeners before destroying or re-rendering a table.
     * @param {HTMLTableElement} table
     */
    destroyColumnResize(table) {
        if (!table) {
            return;
        }
        const resizers = table.querySelectorAll('.pdt-column-resizer');
        resizers.forEach(r => {
            const h = r._pdtResizeHandlers;
            if (h) {
                r.removeEventListener('mousedown', h.onMouseDown);
                r.removeEventListener('pointerdown', h.onPointerDown);
                r.removeEventListener('keydown', h.onKeyDown);
                r.removeEventListener('click', h.stopEvent);
                r.removeEventListener('dblclick', h.stopEvent);
                r.removeEventListener('dragstart', h.onDragStart);
                // If there were active document handlers from a drag in progress, remove them too
                if (h.activeDocHandlers) {
                    try {
                        if (h.activeDocHandlers.onMouseMove) {
                            document.removeEventListener('mousemove', h.activeDocHandlers.onMouseMove);
                        }
                        if (h.activeDocHandlers.onMouseUp) {
                            document.removeEventListener('mouseup', h.activeDocHandlers.onMouseUp);
                        }
                        if (h.activeDocHandlers.onMouseMove) {
                            document.removeEventListener('pointermove', h.activeDocHandlers.onMouseMove);
                        }
                        if (h.activeDocHandlers.onMouseUp) {
                            document.removeEventListener('pointerup', h.activeDocHandlers.onMouseUp);
                            document.removeEventListener('pointercancel', h.activeDocHandlers.onMouseUp);
                        }
                    } catch (_) {
                        // ignore
                    }
                }
                // If a pointer was captured, try to release it
                if (h.activePointer) {
                    try {
                        const ap = h.activePointer;
                        if (ap && ap.target && typeof ap.target.releasePointerCapture === 'function' && ap.id !== null) {
                            ap.target.releasePointerCapture(ap.id);
                        }
                    } catch (_) {
                        // ignore
                    }
                }
                // remove attached properties
                delete r._pdtResizeHandlers;
            }
            if (r.parentNode) {
                try {
                    const parent = r.parentNode;
                    if (parent && parent.dataset && parent.dataset.resizeInit) {
                        delete parent.dataset.resizeInit;
                    }
                } catch (_) {
                    // ignore
                }
                r.parentNode.removeChild(r);
            }
        });
    }
};
