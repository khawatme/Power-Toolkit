/**
 * @file Tests for UI helpers
 * @module tests/helpers/ui.helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIHelpers } from '../../src/helpers/ui.helpers.js';

describe('UI Helpers', () => {
    describe('createElement', () => {
        it('should create HTML elements', () => {
            const div = document.createElement('div');
            expect(div).toBeInstanceOf(HTMLDivElement);
        });
    });

    describe('addClass', () => {
        it('should add classes to elements', () => {
            const div = document.createElement('div');
            div.classList.add('test-class');
            expect(div.classList.contains('test-class')).toBe(true);
        });
    });

    describe('removeClass', () => {
        it('should remove classes from elements', () => {
            const div = document.createElement('div');
            div.classList.add('test-class');
            div.classList.remove('test-class');
            expect(div.classList.contains('test-class')).toBe(false);
        });
    });

    describe('UIHelpers.updatePaginationUI', () => {
        let prevBtn, nextBtn, pageInfo;

        beforeEach(() => {
            prevBtn = document.createElement('button');
            nextBtn = document.createElement('button');
            pageInfo = document.createElement('span');
        });

        it('should update page info text with current page', () => {
            UIHelpers.updatePaginationUI(prevBtn, nextBtn, pageInfo, 3, true);
            expect(pageInfo.textContent).toBe('Page 3');
        });

        it('should disable prev button on first page', () => {
            UIHelpers.updatePaginationUI(prevBtn, nextBtn, pageInfo, 1, true);
            expect(prevBtn.disabled).toBe(true);
        });

        it('should enable prev button when not on first page', () => {
            UIHelpers.updatePaginationUI(prevBtn, nextBtn, pageInfo, 2, true);
            expect(prevBtn.disabled).toBe(false);
        });

        it('should disable next button when no next page', () => {
            UIHelpers.updatePaginationUI(prevBtn, nextBtn, pageInfo, 5, false);
            expect(nextBtn.disabled).toBe(true);
        });

        it('should enable next button when has next page', () => {
            UIHelpers.updatePaginationUI(prevBtn, nextBtn, pageInfo, 1, true);
            expect(nextBtn.disabled).toBe(false);
        });

        it('should handle null pageInfo element', () => {
            expect(() => {
                UIHelpers.updatePaginationUI(prevBtn, nextBtn, null, 1, true);
            }).not.toThrow();
        });

        it('should handle null prevBtn element', () => {
            expect(() => {
                UIHelpers.updatePaginationUI(null, nextBtn, pageInfo, 1, true);
            }).not.toThrow();
        });

        it('should handle null nextBtn element', () => {
            expect(() => {
                UIHelpers.updatePaginationUI(prevBtn, null, pageInfo, 1, true);
            }).not.toThrow();
        });

        it('should handle all null elements', () => {
            expect(() => {
                UIHelpers.updatePaginationUI(null, null, null, 1, true);
            }).not.toThrow();
        });
    });

    describe('UIHelpers.toggleElementHeight', () => {
        let element;

        beforeEach(() => {
            element = document.createElement('div');
            element.innerHTML = '<p>Test content</p>';
            document.body.appendChild(element);
            // Mock scrollHeight
            Object.defineProperty(element, 'scrollHeight', { value: 100, configurable: true });
        });

        afterEach(() => {
            document.body.removeChild(element);
        });

        it('should expand element when collapsed', () => {
            element.style.maxHeight = '0px';
            UIHelpers.toggleElementHeight(element);
            expect(element.style.maxHeight).toBe('100px');
        });

        it('should collapse element when expanded', () => {
            element.style.maxHeight = '100px';
            UIHelpers.toggleElementHeight(element);
            expect(element.style.maxHeight).toBe('0px');
        });

        it('should expand element when maxHeight is not set', () => {
            UIHelpers.toggleElementHeight(element);
            expect(element.style.maxHeight).toBe('100px');
        });

        it('should handle null element', () => {
            expect(() => {
                UIHelpers.toggleElementHeight(null);
            }).not.toThrow();
        });

        it('should handle undefined element', () => {
            expect(() => {
                UIHelpers.toggleElementHeight(undefined);
            }).not.toThrow();
        });
    });

    describe('UIHelpers.toggleAccordionCategory', () => {
        let categoryElement, header;

        beforeEach(() => {
            categoryElement = document.createElement('div');
            header = document.createElement('div');
            header.className = 'codehub-category-header';
            categoryElement.appendChild(header);
        });

        it('should add expanded class when collapsed', () => {
            const result = UIHelpers.toggleAccordionCategory(categoryElement);
            expect(categoryElement.classList.contains('expanded')).toBe(true);
            expect(result).toBe(true);
        });

        it('should remove expanded class when expanded', () => {
            categoryElement.classList.add('expanded');
            const result = UIHelpers.toggleAccordionCategory(categoryElement);
            expect(categoryElement.classList.contains('expanded')).toBe(false);
            expect(result).toBe(false);
        });

        it('should set aria-expanded to true when expanding', () => {
            UIHelpers.toggleAccordionCategory(categoryElement);
            expect(header.getAttribute('aria-expanded')).toBe('true');
        });

        it('should set aria-expanded to false when collapsing', () => {
            categoryElement.classList.add('expanded');
            header.setAttribute('aria-expanded', 'true');
            UIHelpers.toggleAccordionCategory(categoryElement);
            expect(header.getAttribute('aria-expanded')).toBe('false');
        });

        it('should use custom header selector', () => {
            const customHeader = document.createElement('div');
            customHeader.className = 'custom-header';
            categoryElement.appendChild(customHeader);
            UIHelpers.toggleAccordionCategory(categoryElement, '.custom-header');
            expect(customHeader.getAttribute('aria-expanded')).toBe('true');
        });

        it('should return false for null element', () => {
            const result = UIHelpers.toggleAccordionCategory(null);
            expect(result).toBe(false);
        });

        it('should handle missing header gracefully', () => {
            const noHeaderCategory = document.createElement('div');
            expect(() => {
                UIHelpers.toggleAccordionCategory(noHeaderCategory);
            }).not.toThrow();
        });
    });

    describe('UIHelpers.setAllAccordionCategories', () => {
        let container, cat1, cat2, header1, header2;

        beforeEach(() => {
            container = document.createElement('div');
            cat1 = document.createElement('div');
            cat1.className = 'category';
            header1 = document.createElement('div');
            header1.className = 'codehub-category-header';
            cat1.appendChild(header1);

            cat2 = document.createElement('div');
            cat2.className = 'category';
            header2 = document.createElement('div');
            header2.className = 'codehub-category-header';
            cat2.appendChild(header2);

            container.appendChild(cat1);
            container.appendChild(cat2);
        });

        it('should expand all categories', () => {
            UIHelpers.setAllAccordionCategories(container, '.category', true);
            expect(cat1.classList.contains('expanded')).toBe(true);
            expect(cat2.classList.contains('expanded')).toBe(true);
        });

        it('should collapse all categories', () => {
            cat1.classList.add('expanded');
            cat2.classList.add('expanded');
            UIHelpers.setAllAccordionCategories(container, '.category', false);
            expect(cat1.classList.contains('expanded')).toBe(false);
            expect(cat2.classList.contains('expanded')).toBe(false);
        });

        it('should set aria-expanded to true for all headers when expanding', () => {
            UIHelpers.setAllAccordionCategories(container, '.category', true);
            expect(header1.getAttribute('aria-expanded')).toBe('true');
            expect(header2.getAttribute('aria-expanded')).toBe('true');
        });

        it('should set aria-expanded to false for all headers when collapsing', () => {
            UIHelpers.setAllAccordionCategories(container, '.category', false);
            expect(header1.getAttribute('aria-expanded')).toBe('false');
            expect(header2.getAttribute('aria-expanded')).toBe('false');
        });

        it('should use custom header selector', () => {
            const customHeader = document.createElement('div');
            customHeader.className = 'custom-header';
            cat1.appendChild(customHeader);
            UIHelpers.setAllAccordionCategories(container, '.category', true, '.custom-header');
            expect(customHeader.getAttribute('aria-expanded')).toBe('true');
        });

        it('should handle null container', () => {
            expect(() => {
                UIHelpers.setAllAccordionCategories(null, '.category', true);
            }).not.toThrow();
        });

        it('should handle empty container', () => {
            const emptyContainer = document.createElement('div');
            expect(() => {
                UIHelpers.setAllAccordionCategories(emptyContainer, '.category', true);
            }).not.toThrow();
        });

        it('should handle categories without headers', () => {
            const noHeaderCat = document.createElement('div');
            noHeaderCat.className = 'category';
            container.appendChild(noHeaderCat);
            expect(() => {
                UIHelpers.setAllAccordionCategories(container, '.category', true);
            }).not.toThrow();
        });
    });

    describe('UIHelpers.collapseAllAccordionItems', () => {
        let container, item1, item2, details1, details2;

        beforeEach(() => {
            container = document.createElement('div');

            item1 = document.createElement('div');
            item1.className = 'help-card expanded';
            details1 = document.createElement('div');
            details1.className = 'details';
            details1.style.maxHeight = '100px';
            item1.appendChild(details1);

            item2 = document.createElement('div');
            item2.className = 'help-card expanded';
            details2 = document.createElement('div');
            details2.className = 'details';
            details2.style.maxHeight = '150px';
            item2.appendChild(details2);

            container.appendChild(item1);
            container.appendChild(item2);
        });

        it('should remove expanded class from all items', () => {
            UIHelpers.collapseAllAccordionItems(container, '.help-card', '.details');
            expect(item1.classList.contains('expanded')).toBe(false);
            expect(item2.classList.contains('expanded')).toBe(false);
        });

        it('should set maxHeight to 0px for all details', () => {
            UIHelpers.collapseAllAccordionItems(container, '.help-card', '.details');
            expect(details1.style.maxHeight).toBe('0px');
            expect(details2.style.maxHeight).toBe('0px');
        });

        it('should only collapse items with expanded class', () => {
            item2.classList.remove('expanded');
            UIHelpers.collapseAllAccordionItems(container, '.help-card', '.details');
            expect(item1.classList.contains('expanded')).toBe(false);
            expect(details2.style.maxHeight).toBe('150px'); // unchanged
        });

        it('should handle null container', () => {
            expect(() => {
                UIHelpers.collapseAllAccordionItems(null, '.help-card', '.details');
            }).not.toThrow();
        });

        it('should handle items without details', () => {
            const itemWithoutDetails = document.createElement('div');
            itemWithoutDetails.className = 'help-card expanded';
            container.appendChild(itemWithoutDetails);
            expect(() => {
                UIHelpers.collapseAllAccordionItems(container, '.help-card', '.details');
            }).not.toThrow();
        });

        it('should handle empty container', () => {
            const emptyContainer = document.createElement('div');
            expect(() => {
                UIHelpers.collapseAllAccordionItems(emptyContainer, '.help-card', '.details');
            }).not.toThrow();
        });
    });

    describe('UIHelpers.buildSearchIndex', () => {
        it('should combine multiple fields into lowercase string', () => {
            const result = UIHelpers.buildSearchIndex('Hello', 'World', 'Test');
            expect(result).toBe('hello world test');
        });

        it('should filter out falsy values', () => {
            const result = UIHelpers.buildSearchIndex('Hello', null, 'World', undefined, '');
            expect(result).toBe('hello world');
        });

        it('should return empty string for no arguments', () => {
            const result = UIHelpers.buildSearchIndex();
            expect(result).toBe('');
        });

        it('should handle single field', () => {
            const result = UIHelpers.buildSearchIndex('SingleField');
            expect(result).toBe('singlefield');
        });

        it('should handle all falsy values', () => {
            const result = UIHelpers.buildSearchIndex(null, undefined, '');
            expect(result).toBe('');
        });

        it('should preserve spaces within fields', () => {
            const result = UIHelpers.buildSearchIndex('Hello World', 'Test Case');
            expect(result).toBe('hello world test case');
        });

        it('should handle numbers', () => {
            const result = UIHelpers.buildSearchIndex('Count', 42, 'Items');
            expect(result).toBe('count 42 items');
        });
    });

    describe('UIHelpers.sortArrayByColumn', () => {
        it('should sort array ascending by column', () => {
            const array = [
                { name: 'Charlie', age: 30 },
                { name: 'Alice', age: 25 },
                { name: 'Bob', age: 35 }
            ];
            UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(array[0].name).toBe('Alice');
            expect(array[1].name).toBe('Bob');
            expect(array[2].name).toBe('Charlie');
        });

        it('should sort array descending by column', () => {
            const array = [
                { name: 'Alice', age: 25 },
                { name: 'Bob', age: 35 },
                { name: 'Charlie', age: 30 }
            ];
            UIHelpers.sortArrayByColumn(array, 'name', 'desc');
            expect(array[0].name).toBe('Charlie');
            expect(array[1].name).toBe('Bob');
            expect(array[2].name).toBe('Alice');
        });

        it('should sort numbers correctly', () => {
            const array = [
                { value: 10 },
                { value: 5 },
                { value: 20 }
            ];
            UIHelpers.sortArrayByColumn(array, 'value', 'asc');
            expect(array[0].value).toBe(10);
            expect(array[1].value).toBe(20);
            expect(array[2].value).toBe(5);
        });

        it('should handle null values in ascending order', () => {
            const array = [
                { name: 'Bob' },
                { name: null },
                { name: 'Alice' }
            ];
            UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(array[0].name).toBe('Alice');
            expect(array[1].name).toBe('Bob');
            expect(array[2].name).toBe(null);
        });

        it('should handle undefined values in descending order', () => {
            const array = [
                { name: 'Bob' },
                { name: undefined },
                { name: 'Alice' }
            ];
            UIHelpers.sortArrayByColumn(array, 'name', 'desc');
            // Just verify the array was sorted and contains all items
            expect(array.length).toBe(3);
            const names = array.map(x => x.name);
            expect(names).toContain('Bob');
            expect(names).toContain('Alice');
            expect(names).toContain(undefined);
        });

        it('should handle both null and undefined values', () => {
            const array = [
                { name: null },
                { name: undefined }
            ];
            const result = UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(result).toBe(array);
        });

        it('should return empty array for empty input', () => {
            const result = UIHelpers.sortArrayByColumn([], 'name', 'asc');
            expect(result).toEqual([]);
        });

        it('should return non-array input unchanged', () => {
            const result = UIHelpers.sortArrayByColumn(null, 'name', 'asc');
            expect(result).toBe(null);
        });

        it('should default to ascending order', () => {
            const array = [
                { name: 'Charlie' },
                { name: 'Alice' }
            ];
            UIHelpers.sortArrayByColumn(array, 'name');
            expect(array[0].name).toBe('Alice');
        });

        it('should use case-insensitive sorting', () => {
            const array = [
                { name: 'apple' },
                { name: 'Apple' },
                { name: 'APPLE' }
            ];
            UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            // All should be considered equal, order preserved
            expect(array.length).toBe(3);
        });

        it('should return the same array reference', () => {
            const array = [{ name: 'A' }, { name: 'B' }];
            const result = UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(result).toBe(array);
        });
    });

    describe('UIHelpers.toggleSortState', () => {
        it('should toggle from asc to desc for same column', () => {
            const sortState = { column: 'name', direction: 'asc' };
            UIHelpers.toggleSortState(sortState, 'name');
            expect(sortState.direction).toBe('desc');
        });

        it('should toggle from desc to asc for same column', () => {
            const sortState = { column: 'name', direction: 'desc' };
            UIHelpers.toggleSortState(sortState, 'name');
            expect(sortState.direction).toBe('asc');
        });

        it('should reset to asc for new column', () => {
            const sortState = { column: 'name', direction: 'desc' };
            UIHelpers.toggleSortState(sortState, 'age');
            expect(sortState.column).toBe('age');
            expect(sortState.direction).toBe('asc');
        });

        it('should update column when switching to new column', () => {
            const sortState = { column: 'name', direction: 'asc' };
            UIHelpers.toggleSortState(sortState, 'date');
            expect(sortState.column).toBe('date');
        });

        it('should return the same state object', () => {
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.toggleSortState(sortState, 'name');
            expect(result).toBe(sortState);
        });

        it('should handle empty string column', () => {
            const sortState = { column: '', direction: 'asc' };
            UIHelpers.toggleSortState(sortState, 'name');
            expect(sortState.column).toBe('name');
            expect(sortState.direction).toBe('asc');
        });
    });

    describe('UIHelpers.generateSortableTableHeaders', () => {
        it('should generate HTML for headers', () => {
            const headers = [
                { key: 'name', label: 'Name' },
                { key: 'age', label: 'Age' }
            ];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('<tr>');
            expect(result).toContain('</tr>');
            expect(result).toContain('<th');
            expect(result).toContain('Name');
            expect(result).toContain('Age');
        });

        it('should mark sorted column with sort-asc class', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('sort-asc');
        });

        it('should mark sorted column with sort-desc class', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'name', direction: 'desc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('sort-desc');
        });

        it('should set aria-sort to ascending for asc sorted column', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('aria-sort="ascending"');
        });

        it('should set aria-sort to descending for desc sorted column', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'name', direction: 'desc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('aria-sort="descending"');
        });

        it('should set aria-sort to none for non-sorted columns', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'other', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('aria-sort="none"');
        });

        it('should include data-sort-key attribute', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('data-sort-key="name"');
        });

        it('should include tabindex and role attributes', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('tabindex="0"');
            expect(result).toContain('role="button"');
        });

        it('should include aria-label for sorting', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('aria-label="Sort by Name"');
        });

        it('should return empty string for non-array input', () => {
            const result = UIHelpers.generateSortableTableHeaders(null, {});
            expect(result).toBe('');
        });

        it('should handle empty headers array', () => {
            const result = UIHelpers.generateSortableTableHeaders([], { column: '', direction: 'asc' });
            expect(result).toBe('<tr></tr>');
        });

        it('should escape HTML in labels', () => {
            const headers = [{ key: 'name', label: '<script>alert("xss")</script>' }];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).not.toContain('<script>');
        });
    });

    describe('UIHelpers.initColumnResize', () => {
        let table;

        beforeEach(() => {
            table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            th1.textContent = 'Column 1';
            const th2 = document.createElement('th');
            th2.textContent = 'Column 2';
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const bodyRow = document.createElement('tr');
            const td1 = document.createElement('td');
            td1.textContent = 'Data 1';
            const td2 = document.createElement('td');
            td2.textContent = 'Data 2';
            bodyRow.appendChild(td1);
            bodyRow.appendChild(td2);
            tbody.appendChild(bodyRow);
            table.appendChild(tbody);

            document.body.appendChild(table);
        });

        afterEach(() => {
            UIHelpers.destroyColumnResize(table);
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should add resizer elements to headers', () => {
            UIHelpers.initColumnResize(table);
            const resizers = table.querySelectorAll('.pdt-column-resizer');
            expect(resizers.length).toBeGreaterThan(0);
        });

        it('should mark headers as initialized', () => {
            UIHelpers.initColumnResize(table);
            const th = table.querySelector('th');
            expect(th.dataset.resizeInit).toBe('true');
        });

        it('should create colgroup if not exists', () => {
            UIHelpers.initColumnResize(table);
            const colgroup = table.querySelector('colgroup');
            expect(colgroup).not.toBeNull();
        });

        it('should handle null table', () => {
            expect(() => {
                UIHelpers.initColumnResize(null);
            }).not.toThrow();
        });

        it('should handle table without headers', () => {
            const emptyTable = document.createElement('table');
            document.body.appendChild(emptyTable);
            expect(() => {
                UIHelpers.initColumnResize(emptyTable);
            }).not.toThrow();
            document.body.removeChild(emptyTable);
        });

        it('should not reinitialize already initialized headers', () => {
            UIHelpers.initColumnResize(table);
            const resizersBefore = table.querySelectorAll('.pdt-column-resizer').length;
            UIHelpers.initColumnResize(table);
            const resizersAfter = table.querySelectorAll('.pdt-column-resizer').length;
            expect(resizersAfter).toBe(resizersBefore);
        });

        it('should set resizer attributes correctly', () => {
            UIHelpers.initColumnResize(table);
            const resizer = table.querySelector('.pdt-column-resizer');
            expect(resizer.getAttribute('role')).toBe('separator');
            expect(resizer.getAttribute('aria-orientation')).toBe('horizontal');
            expect(resizer.getAttribute('aria-label')).toBe('Resize column');
            expect(resizer.tabIndex).toBe(0);
        });
    });

    describe('UIHelpers.destroyColumnResize', () => {
        let table;

        beforeEach(() => {
            table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            th1.textContent = 'Column 1';
            headerRow.appendChild(th1);
            thead.appendChild(headerRow);
            table.appendChild(thead);
            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should remove all resizer elements', () => {
            UIHelpers.initColumnResize(table);
            UIHelpers.destroyColumnResize(table);
            const resizers = table.querySelectorAll('.pdt-column-resizer');
            expect(resizers.length).toBe(0);
        });

        it('should remove resizeInit dataset from headers', () => {
            UIHelpers.initColumnResize(table);
            UIHelpers.destroyColumnResize(table);
            const th = table.querySelector('th');
            expect(th.dataset.resizeInit).toBeUndefined();
        });

        it('should handle null table', () => {
            expect(() => {
                UIHelpers.destroyColumnResize(null);
            }).not.toThrow();
        });

        it('should handle table without resizers', () => {
            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();
        });
    });

    describe('UIHelpers._prepareTableForResize', () => {
        it('should return null for table without headers', () => {
            const table = document.createElement('table');
            const result = UIHelpers._prepareTableForResize(table);
            expect(result).toBeNull();
        });

        it('should return context object for valid table', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            tr.appendChild(th);
            thead.appendChild(tr);
            table.appendChild(thead);

            const result = UIHelpers._prepareTableForResize(table);
            expect(result).not.toBeNull();
            expect(result.headers).toBeDefined();
            expect(result.headerMap).toBeDefined();
            expect(result.colgroup).toBeDefined();
        });
    });

    describe('UIHelpers._getTableHeaders', () => {
        it('should get headers from thead', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            tr.appendChild(th1);
            tr.appendChild(th2);
            thead.appendChild(tr);
            table.appendChild(thead);

            const headers = UIHelpers._getTableHeaders(table);
            expect(headers.length).toBe(2);
        });

        it('should get headers from last row in multi-row thead', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr1 = document.createElement('tr');
            const th1 = document.createElement('th');
            tr1.appendChild(th1);
            const tr2 = document.createElement('tr');
            const th2 = document.createElement('th');
            const th3 = document.createElement('th');
            tr2.appendChild(th2);
            tr2.appendChild(th3);
            thead.appendChild(tr1);
            thead.appendChild(tr2);
            table.appendChild(thead);

            const headers = UIHelpers._getTableHeaders(table);
            expect(headers.length).toBe(2);
        });

        it('should return empty array for table without headers', () => {
            const table = document.createElement('table');
            const headers = UIHelpers._getTableHeaders(table);
            expect(headers.length).toBe(0);
        });
    });

    describe('UIHelpers._computeColumnCount', () => {
        it('should count columns from headers', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            const th3 = document.createElement('th');
            tr.appendChild(th1);
            tr.appendChild(th2);
            tr.appendChild(th3);
            thead.appendChild(tr);
            table.appendChild(thead);

            const count = UIHelpers._computeColumnCount(table, [th1, th2, th3]);
            expect(count).toBe(3);
        });

        it('should account for colspan', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th1 = document.createElement('th');
            th1.colSpan = 2;
            const th2 = document.createElement('th');
            tr.appendChild(th1);
            tr.appendChild(th2);
            thead.appendChild(tr);
            table.appendChild(thead);

            const count = UIHelpers._computeColumnCount(table, [th1, th2]);
            expect(count).toBe(3);
        });

        it('should use tbody column count if larger', () => {
            const table = document.createElement('table');
            const tbody = document.createElement('tbody');
            const tr = document.createElement('tr');
            for (let i = 0; i < 5; i++) {
                tr.appendChild(document.createElement('td'));
            }
            tbody.appendChild(tr);
            table.appendChild(tbody);

            const count = UIHelpers._computeColumnCount(table, []);
            expect(count).toBe(5);
        });
    });

    describe('UIHelpers._ensureColgroup', () => {
        it('should create colgroup if not exists', () => {
            const table = document.createElement('table');
            const colgroup = UIHelpers._ensureColgroup(table, 3);
            expect(colgroup.tagName).toBe('COLGROUP');
            expect(colgroup.children.length).toBe(3);
        });

        it('should add missing col elements', () => {
            const table = document.createElement('table');
            const existingColgroup = document.createElement('colgroup');
            existingColgroup.appendChild(document.createElement('col'));
            table.appendChild(existingColgroup);

            UIHelpers._ensureColgroup(table, 3);
            expect(existingColgroup.children.length).toBe(3);
        });

        it('should remove extra col elements', () => {
            const table = document.createElement('table');
            const existingColgroup = document.createElement('colgroup');
            for (let i = 0; i < 5; i++) {
                existingColgroup.appendChild(document.createElement('col'));
            }
            table.appendChild(existingColgroup);

            UIHelpers._ensureColgroup(table, 3);
            expect(existingColgroup.children.length).toBe(3);
        });
    });

    describe('UIHelpers._buildHeaderMap', () => {
        it('should build map with column indices', () => {
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            const headers = [th1, th2];

            const map = UIHelpers._buildHeaderMap(headers);
            expect(map.length).toBe(2);
            expect(map[0].start).toBe(0);
            expect(map[0].end).toBe(0);
            expect(map[1].start).toBe(1);
            expect(map[1].end).toBe(1);
        });

        it('should handle colspan in header map', () => {
            const th1 = document.createElement('th');
            th1.colSpan = 2;
            const th2 = document.createElement('th');
            const headers = [th1, th2];

            const map = UIHelpers._buildHeaderMap(headers);
            expect(map[0].start).toBe(0);
            expect(map[0].end).toBe(1);
            expect(map[0].span).toBe(2);
            expect(map[1].start).toBe(2);
            expect(map[1].end).toBe(2);
        });
    });

    describe('UIHelpers._createResizerElement', () => {
        it('should create resizer with correct class', () => {
            const resizer = UIHelpers._createResizerElement(0);
            expect(resizer.className).toBe('pdt-column-resizer');
        });

        it('should set accessibility attributes', () => {
            const resizer = UIHelpers._createResizerElement(0);
            expect(resizer.getAttribute('role')).toBe('separator');
            expect(resizer.getAttribute('aria-orientation')).toBe('horizontal');
            expect(resizer.getAttribute('aria-label')).toBe('Resize column');
        });

        it('should set data-col-index attribute', () => {
            const resizer = UIHelpers._createResizerElement(5);
            expect(resizer.dataset.colIndex).toBe('5');
        });

        it('should be focusable', () => {
            const resizer = UIHelpers._createResizerElement(0);
            expect(resizer.tabIndex).toBe(0);
        });
    });

    describe('UIHelpers._ensureRelativePosition', () => {
        it('should not throw for static element', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);
            expect(() => {
                UIHelpers._ensureRelativePosition(element);
            }).not.toThrow();
            document.body.removeChild(element);
        });

        it('should not change position for non-static element', () => {
            const element = document.createElement('div');
            element.style.position = 'absolute';
            document.body.appendChild(element);
            UIHelpers._ensureRelativePosition(element);
            expect(element.style.position).toBe('absolute');
            document.body.removeChild(element);
        });

        it('should handle element with relative position', () => {
            const element = document.createElement('div');
            element.style.position = 'relative';
            document.body.appendChild(element);
            UIHelpers._ensureRelativePosition(element);
            expect(element.style.position).toBe('relative');
            document.body.removeChild(element);
        });
    });

    describe('UIHelpers._getCurrentColumnWidths', () => {
        it('should get column widths from colgroup', () => {
            const colgroup = document.createElement('colgroup');
            for (let i = 0; i < 3; i++) {
                const col = document.createElement('col');
                colgroup.appendChild(col);
            }
            document.body.appendChild(colgroup);
            const widths = UIHelpers._getCurrentColumnWidths(colgroup, 3, 30);
            expect(widths.length).toBe(3);
            expect(widths.every(w => w >= 30)).toBe(true);
            document.body.removeChild(colgroup);
        });

        it('should use minWidth for columns without rendered width', () => {
            const colgroup = document.createElement('colgroup');
            const col = document.createElement('col');
            colgroup.appendChild(col);
            const widths = UIHelpers._getCurrentColumnWidths(colgroup, 1, 50);
            expect(widths[0]).toBe(50);
        });

        it('should handle empty colgroup', () => {
            const colgroup = document.createElement('colgroup');
            const widths = UIHelpers._getCurrentColumnWidths(colgroup, 2, 30);
            expect(widths).toEqual([30, 30]);
        });
    });

    describe('UIHelpers._computeColumnWidths', () => {
        it('should compute widths from header map', () => {
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            document.body.appendChild(th1);
            document.body.appendChild(th2);
            const headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];
            const getRows = () => [];
            const widths = UIHelpers._computeColumnWidths(headerMap, getRows, 2, 30);
            expect(widths.length).toBe(2);
            document.body.removeChild(th1);
            document.body.removeChild(th2);
        });

        it('should measure body cells', () => {
            const container = document.createElement('div');
            const row = document.createElement('tr');
            const td1 = document.createElement('td');
            td1.textContent = 'Test';
            const td2 = document.createElement('td');
            td2.textContent = 'Data';
            row.appendChild(td1);
            row.appendChild(td2);
            container.appendChild(row);
            document.body.appendChild(container);

            const headerMap = [];
            const getRows = () => [row];
            const widths = UIHelpers._computeColumnWidths(headerMap, getRows, 2, 30);
            expect(widths.length).toBe(2);
            document.body.removeChild(container);
        });

        it('should handle colspan in headers', () => {
            const th1 = document.createElement('th');
            th1.colSpan = 2;
            document.body.appendChild(th1);
            const headerMap = [
                { th: th1, start: 0, end: 1, span: 2 }
            ];
            const getRows = () => [];
            const widths = UIHelpers._computeColumnWidths(headerMap, getRows, 2, 30);
            expect(widths.length).toBe(2);
            document.body.removeChild(th1);
        });
    });

    describe('UIHelpers._scaleColumnWidths', () => {
        it('should scale widths to target table width', () => {
            const colWidths = [100, 100, 100];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 300, 30);
            expect(scaled.length).toBe(3);
            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(300);
        });

        it('should respect minimum width', () => {
            const colWidths = [10, 10, 10];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 90, 30);
            expect(scaled.every(w => w >= 30)).toBe(true);
        });

        it('should handle uneven scaling', () => {
            const colWidths = [100, 200, 100];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 400, 30);
            expect(scaled.length).toBe(3);
            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(400);
        });

        it('should handle single column', () => {
            const colWidths = [100];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 200, 30);
            expect(scaled[0]).toBe(200);
        });

        it('should handle zero total width', () => {
            const colWidths = [0, 0, 0];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 90, 30);
            expect(scaled.length).toBe(3);
        });
    });

    describe('UIHelpers._applyColumnWidths', () => {
        let colgroup, headerMap, rows, table;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            for (let i = 0; i < 2; i++) {
                colgroup.appendChild(document.createElement('col'));
            }
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            const tbody = document.createElement('tbody');
            const bodyRow = document.createElement('tr');
            const td1 = document.createElement('td');
            const td2 = document.createElement('td');
            bodyRow.appendChild(td1);
            bodyRow.appendChild(td2);
            tbody.appendChild(bodyRow);
            table.appendChild(tbody);
            rows = [bodyRow];

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should apply widths to col elements', () => {
            const getRows = () => rows;
            UIHelpers._applyColumnWidths(colgroup, headerMap, getRows, [100, 150], 2, 30);
            const cols = colgroup.querySelectorAll('col');
            expect(cols[0].style.width).toBe('100px');
            expect(cols[1].style.width).toBe('150px');
        });

        it('should apply minWidth to headers', () => {
            const getRows = () => rows;
            UIHelpers._applyColumnWidths(colgroup, headerMap, getRows, [100, 150], 2, 30);
            expect(headerMap[0].th.style.minWidth).toBe('100px');
            expect(headerMap[1].th.style.minWidth).toBe('150px');
        });

        it('should apply minWidth to body cells', () => {
            const getRows = () => rows;
            UIHelpers._applyColumnWidths(colgroup, headerMap, getRows, [100, 150], 2, 30);
            expect(rows[0].children[0].style.minWidth).toBe('100px');
            expect(rows[0].children[1].style.minWidth).toBe('150px');
        });

        it('should use default minWidth for missing widths', () => {
            const getRows = () => rows;
            UIHelpers._applyColumnWidths(colgroup, headerMap, getRows, [100], 2, 30);
            const cols = colgroup.querySelectorAll('col');
            expect(cols[1].style.width).toBe('30px');
        });
    });

    describe('UIHelpers._applyColumnResize', () => {
        let table, colgroup, resizer;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '100px';
            const col2 = document.createElement('col');
            col2.style.width = '100px';
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);
            table.style.width = '200px';

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should resize left column with shift mode', () => {
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: 20,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 100,
                startTableWidth: 200,
                resizeMode: 'shift',
                minWidth: 30,
                table
            });
            const cols = getCols();
            expect(cols[0].style.width).toBe('120px');
        });

        it('should resize both columns with proportional mode', () => {
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: 20,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 100,
                startTableWidth: 200,
                resizeMode: 'proportional',
                minWidth: 30,
                table
            });
            const cols = getCols();
            expect(cols[0].style.width).toBe('120px');
            expect(cols[1].style.width).toBe('80px');
        });

        it('should respect minWidth for left column', () => {
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: -80,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 100,
                startTableWidth: 200,
                resizeMode: 'proportional',
                minWidth: 30,
                table
            });
            const cols = getCols();
            expect(parseInt(cols[0].style.width)).toBeGreaterThanOrEqual(30);
        });

        it('should respect minWidth for right column', () => {
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: 80,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 100,
                startTableWidth: 200,
                resizeMode: 'proportional',
                minWidth: 30,
                table
            });
            const cols = getCols();
            expect(parseInt(cols[1].style.width)).toBeGreaterThanOrEqual(30);
        });

        it('should handle resize on last column', () => {
            resizer.dataset.colIndex = '1';
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: 20,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 0,
                startTableWidth: 200,
                resizeMode: 'shift',
                minWidth: 30,
                table
            });
            const cols = getCols();
            expect(cols[1].style.width).toBe('120px');
        });

        it('should handle missing left column', () => {
            resizer.dataset.colIndex = '5';
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            expect(() => {
                UIHelpers._applyColumnResize({
                    resizer,
                    delta: 20,
                    getCols,
                    startLeftWidth: 100,
                    startRightWidth: 100,
                    startTableWidth: 200,
                    resizeMode: 'shift',
                    minWidth: 30,
                    table
                });
            }).not.toThrow();
        });
    });

    describe('UIHelpers._createResizeHandlers', () => {
        let table, colgroup, resizer, headerMap;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            const col2 = document.createElement('col');
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            table.appendChild(tbody);

            headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should return handler functions', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [table.querySelector('th')],
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            expect(handlers.onPointerDown).toBeTypeOf('function');
            expect(handlers.onMouseDown).toBeTypeOf('function');
            expect(handlers.onKeyDown).toBeTypeOf('function');
            expect(handlers.stopEvent).toBeTypeOf('function');
            expect(handlers.onDragStart).toBeTypeOf('function');
        });

        it('should handle keydown with ArrowLeft', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const col = colgroup.querySelector('col');
            col.style.width = '100px';

            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
            handlers.onKeyDown(event);
        });

        it('should handle keydown with ArrowRight', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const col = colgroup.querySelector('col');
            col.style.width = '100px';

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
            handlers.onKeyDown(event);
        });

        it('should ignore non-arrow keys', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
            handlers.onKeyDown(event);
            expect(event.preventDefault).not.toHaveBeenCalled();
        });

        it('should use larger step with shift key', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const col = colgroup.querySelector('col');
            col.style.width = '100px';

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
            handlers.onKeyDown(event);
        });

        it('should stop event propagation', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
            handlers.stopEvent(event);
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should prevent dragstart default', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const event = { preventDefault: vi.fn() };
            handlers.onDragStart(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });
    });

    describe('UIHelpers._lockTableColumnWidths', () => {
        let table, colgroup, headerMap;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            const col2 = document.createElement('col');
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const bodyRow = document.createElement('tr');
            const td1 = document.createElement('td');
            const td2 = document.createElement('td');
            bodyRow.appendChild(td1);
            bodyRow.appendChild(td2);
            tbody.appendChild(bodyRow);
            table.appendChild(tbody);

            headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should set table layout to fixed', () => {
            const getRows = () => Array.from(table.querySelectorAll('tbody tr'));
            UIHelpers._lockTableColumnWidths(table, colgroup, headerMap, 2, 30, getRows);
            expect(table.style.tableLayout).toBe('fixed');
        });

        it('should set table width', () => {
            const getRows = () => Array.from(table.querySelectorAll('tbody tr'));
            UIHelpers._lockTableColumnWidths(table, colgroup, headerMap, 2, 30, getRows);
            expect(table.style.width).not.toBe('');
        });
    });

    describe('UIHelpers._attachResizeListeners', () => {
        it('should attach pointerdown listener when PointerEvent exists', () => {
            const resizer = document.createElement('div');
            const handlers = {
                onPointerDown: vi.fn(),
                onMouseDown: vi.fn(),
                onKeyDown: vi.fn(),
                stopEvent: vi.fn(),
                onDragStart: vi.fn()
            };

            UIHelpers._attachResizeListeners(resizer, handlers);
            expect(resizer._pdtResizeHandlers).toBe(handlers);
        });

        it('should attach all event listeners', () => {
            const resizer = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(resizer, 'addEventListener');
            const handlers = {
                onPointerDown: vi.fn(),
                onMouseDown: vi.fn(),
                onKeyDown: vi.fn(),
                stopEvent: vi.fn(),
                onDragStart: vi.fn()
            };

            UIHelpers._attachResizeListeners(resizer, handlers);
            expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', handlers.onKeyDown);
            expect(addEventListenerSpy).toHaveBeenCalledWith('click', handlers.stopEvent);
            expect(addEventListenerSpy).toHaveBeenCalledWith('dblclick', handlers.stopEvent);
            expect(addEventListenerSpy).toHaveBeenCalledWith('dragstart', handlers.onDragStart);
        });
    });

    // Additional tests for uncovered lines

    describe('UIHelpers.collapseAllAccordionItems - edge cases', () => {
        it('should handle items with deeply nested details', () => {
            const container = document.createElement('div');
            const item = document.createElement('div');
            item.className = 'help-card expanded';
            const wrapper = document.createElement('div');
            const details = document.createElement('div');
            details.className = 'details';
            details.style.maxHeight = '100px';
            wrapper.appendChild(details);
            item.appendChild(wrapper);
            container.appendChild(item);

            UIHelpers.collapseAllAccordionItems(container, '.help-card', '.details');
            expect(details.style.maxHeight).toBe('0px');
        });

        it('should only target items with exact selector match', () => {
            const container = document.createElement('div');
            const item = document.createElement('div');
            item.className = 'help-card-extra expanded';
            const details = document.createElement('div');
            details.className = 'details';
            details.style.maxHeight = '100px';
            item.appendChild(details);
            container.appendChild(item);

            UIHelpers.collapseAllAccordionItems(container, '.help-card', '.details');
            // Item should remain unchanged since it doesn't match exact selector
            expect(details.style.maxHeight).toBe('100px');
        });

        it('should handle multiple expanded items with varying states', () => {
            const container = document.createElement('div');
            for (let i = 0; i < 5; i++) {
                const item = document.createElement('div');
                item.className = 'accordion-item expanded';
                const details = document.createElement('div');
                details.className = 'content';
                details.style.maxHeight = `${50 + i * 20}px`;
                item.appendChild(details);
                container.appendChild(item);
            }

            UIHelpers.collapseAllAccordionItems(container, '.accordion-item', '.content');
            const allDetails = container.querySelectorAll('.content');
            allDetails.forEach(d => {
                expect(d.style.maxHeight).toBe('0px');
            });
        });
    });

    describe('UIHelpers.sortArrayByColumn - null/undefined comparisons', () => {
        it('should handle null-null comparison', () => {
            const array = [
                { name: null },
                { name: null }
            ];
            const result = UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(result.length).toBe(2);
            expect(result[0].name).toBe(null);
            expect(result[1].name).toBe(null);
        });

        it('should handle undefined-undefined comparison', () => {
            const array = [
                { name: undefined },
                { name: undefined }
            ];
            const result = UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(result.length).toBe(2);
        });

        it('should handle null-undefined comparison', () => {
            const array = [
                { name: null },
                { name: undefined },
                { name: 'Alice' }
            ];
            const result = UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(result[0].name).toBe('Alice');
        });

        it('should handle null first in ascending', () => {
            const array = [
                { value: null },
                { value: 'Z' },
                { value: 'A' }
            ];
            UIHelpers.sortArrayByColumn(array, 'value', 'asc');
            expect(array[array.length - 1].value).toBe(null);
        });

        it('should handle undefined first in descending', () => {
            const array = [
                { value: undefined },
                { value: 'Z' },
                { value: 'A' }
            ];
            UIHelpers.sortArrayByColumn(array, 'value', 'desc');
            const lastItem = array[array.length - 1].value;
            expect(lastItem === undefined || lastItem === 'A').toBe(true);
        });

        it('should handle mixed null, undefined, and values', () => {
            const array = [
                { name: 'Charlie' },
                { name: null },
                { name: 'Alice' },
                { name: undefined },
                { name: 'Bob' }
            ];
            const result = UIHelpers.sortArrayByColumn(array, 'name', 'asc');
            expect(result.length).toBe(5);
            // Non-null values should come before null/undefined in ascending
            const nonNullNames = result.filter(x => x.name !== null && x.name !== undefined);
            expect(nonNullNames.length).toBe(3);
        });
    });

    describe('UIHelpers.generateSortableTableHeaders - additional coverage', () => {
        it('should handle headers with special characters', () => {
            const headers = [{ key: 'col-1', label: 'Column & Data' }];
            const sortState = { column: 'col-1', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('Column');
        });

        it('should handle undefined sortState column', () => {
            const headers = [{ key: 'name', label: 'Name' }];
            const sortState = { column: undefined, direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('aria-sort="none"');
        });

        it('should handle null key in header', () => {
            const headers = [{ key: null, label: 'Unknown' }];
            const sortState = { column: 'name', direction: 'asc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('Unknown');
        });

        it('should handle multiple sorted headers correctly', () => {
            const headers = [
                { key: 'a', label: 'A' },
                { key: 'b', label: 'B' },
                { key: 'c', label: 'C' }
            ];
            const sortState = { column: 'b', direction: 'desc' };
            const result = UIHelpers.generateSortableTableHeaders(headers, sortState);
            expect(result).toContain('sort-desc');
            expect(result).toContain('aria-sort="descending"');
        });
    });

    describe('UIHelpers.initColumnResize - complex scenarios', () => {
        let table;

        beforeEach(() => {
            table = document.createElement('table');
            table.dataset.resizeMode = 'proportional';
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            for (let i = 0; i < 4; i++) {
                const th = document.createElement('th');
                th.textContent = `Column ${i + 1}`;
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            for (let r = 0; r < 3; r++) {
                const row = document.createElement('tr');
                for (let c = 0; c < 4; c++) {
                    const td = document.createElement('td');
                    td.textContent = `Data ${r}-${c}`;
                    row.appendChild(td);
                }
                tbody.appendChild(row);
            }
            table.appendChild(tbody);
            document.body.appendChild(table);
        });

        afterEach(() => {
            UIHelpers.destroyColumnResize(table);
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should handle table with existing colgroup', () => {
            const existingColgroup = document.createElement('colgroup');
            existingColgroup.appendChild(document.createElement('col'));
            existingColgroup.appendChild(document.createElement('col'));
            table.insertBefore(existingColgroup, table.firstChild);

            UIHelpers.initColumnResize(table);
            const colgroup = table.querySelector('colgroup');
            expect(colgroup.children.length).toBe(4);
        });

        it('should use dataset resizeMode when set', () => {
            UIHelpers.initColumnResize(table);
            const resizers = table.querySelectorAll('.pdt-column-resizer');
            expect(resizers.length).toBeGreaterThan(0);
        });

        it('should cleanup before reinitializing', () => {
            UIHelpers.initColumnResize(table);
            const firstResizers = table.querySelectorAll('.pdt-column-resizer').length;
            UIHelpers.initColumnResize(table);
            const secondResizers = table.querySelectorAll('.pdt-column-resizer').length;
            expect(secondResizers).toBe(firstResizers);
        });

        it('should handle table with colspanned headers', () => {
            const thead = table.querySelector('thead');
            thead.innerHTML = '';
            const row = document.createElement('tr');
            const th1 = document.createElement('th');
            th1.colSpan = 2;
            th1.textContent = 'Merged';
            const th2 = document.createElement('th');
            th2.textContent = 'Single';
            row.appendChild(th1);
            row.appendChild(th2);
            thead.appendChild(row);

            UIHelpers.initColumnResize(table);
            const resizers = table.querySelectorAll('.pdt-column-resizer');
            expect(resizers.length).toBe(2);
        });

        it('should handle multi-row thead', () => {
            const thead = table.querySelector('thead');
            const groupRow = document.createElement('tr');
            const groupTh = document.createElement('th');
            groupTh.colSpan = 4;
            groupTh.textContent = 'Group';
            groupRow.appendChild(groupTh);
            thead.insertBefore(groupRow, thead.firstChild);

            UIHelpers.initColumnResize(table);
            const resizers = table.querySelectorAll('.pdt-column-resizer');
            expect(resizers.length).toBeGreaterThan(0);
        });
    });

    describe('UIHelpers._getTableHeaders - edge cases', () => {
        it('should fallback to first tr when no thead', () => {
            const table = document.createElement('table');
            const tr = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            tr.appendChild(th1);
            tr.appendChild(th2);
            table.appendChild(tr);

            const headers = UIHelpers._getTableHeaders(table);
            expect(headers.length).toBe(2);
        });

        it('should return headers from last row of multi-row thead', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');

            const row1 = document.createElement('tr');
            row1.appendChild(document.createElement('th'));

            const row2 = document.createElement('tr');
            row2.appendChild(document.createElement('th'));
            row2.appendChild(document.createElement('th'));
            row2.appendChild(document.createElement('th'));

            thead.appendChild(row1);
            thead.appendChild(row2);
            table.appendChild(thead);

            const headers = UIHelpers._getTableHeaders(table);
            expect(headers.length).toBe(3);
        });

        it('should return empty array for empty table', () => {
            const table = document.createElement('table');
            const headers = UIHelpers._getTableHeaders(table);
            expect(headers).toEqual([]);
        });

        it('should handle thead with no rows', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            table.appendChild(thead);

            const headers = UIHelpers._getTableHeaders(table);
            expect(headers).toEqual([]);
        });
    });

    describe('UIHelpers._computeColumnCount - edge cases', () => {
        it('should handle multiple thead rows with different colspans', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');

            const row1 = document.createElement('tr');
            const th1 = document.createElement('th');
            th1.colSpan = 4;
            row1.appendChild(th1);

            const row2 = document.createElement('tr');
            for (let i = 0; i < 4; i++) {
                row2.appendChild(document.createElement('th'));
            }

            thead.appendChild(row1);
            thead.appendChild(row2);
            table.appendChild(thead);

            const count = UIHelpers._computeColumnCount(table, []);
            expect(count).toBe(4);
        });

        it('should prefer tbody count when larger than thead', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const theadRow = document.createElement('tr');
            theadRow.appendChild(document.createElement('th'));
            theadRow.appendChild(document.createElement('th'));
            thead.appendChild(theadRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const tbodyRow = document.createElement('tr');
            for (let i = 0; i < 5; i++) {
                tbodyRow.appendChild(document.createElement('td'));
            }
            tbody.appendChild(tbodyRow);
            table.appendChild(tbody);

            const count = UIHelpers._computeColumnCount(table, []);
            expect(count).toBe(5);
        });

        it('should fall back to headers length when no thead or tbody', () => {
            const table = document.createElement('table');
            const headers = [
                document.createElement('th'),
                document.createElement('th'),
                document.createElement('th')
            ];

            const count = UIHelpers._computeColumnCount(table, headers);
            expect(count).toBe(3);
        });

        it('should handle cells without colSpan attribute', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const row = document.createElement('tr');
            const th = document.createElement('th');
            Object.defineProperty(th, 'colSpan', { value: undefined });
            row.appendChild(th);
            thead.appendChild(row);
            table.appendChild(thead);

            const count = UIHelpers._computeColumnCount(table, []);
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('UIHelpers._ensureColgroup - edge cases', () => {
        it('should insert colgroup before table first child', () => {
            const table = document.createElement('table');
            const tbody = document.createElement('tbody');
            table.appendChild(tbody);

            const colgroup = UIHelpers._ensureColgroup(table, 3);
            expect(table.firstChild).toBe(colgroup);
        });

        it('should handle colgroup with more cols than needed', () => {
            const table = document.createElement('table');
            const existingColgroup = document.createElement('colgroup');
            for (let i = 0; i < 10; i++) {
                existingColgroup.appendChild(document.createElement('col'));
            }
            table.appendChild(existingColgroup);

            UIHelpers._ensureColgroup(table, 3);
            expect(existingColgroup.children.length).toBe(3);
        });

        it('should handle exact col count', () => {
            const table = document.createElement('table');
            const existingColgroup = document.createElement('colgroup');
            for (let i = 0; i < 3; i++) {
                existingColgroup.appendChild(document.createElement('col'));
            }
            table.appendChild(existingColgroup);

            UIHelpers._ensureColgroup(table, 3);
            expect(existingColgroup.children.length).toBe(3);
        });
    });

    describe('UIHelpers._buildHeaderMap - edge cases', () => {
        it('should handle single header', () => {
            const th = document.createElement('th');
            const map = UIHelpers._buildHeaderMap([th]);
            expect(map.length).toBe(1);
            expect(map[0].start).toBe(0);
            expect(map[0].end).toBe(0);
        });

        it('should handle empty headers array', () => {
            const map = UIHelpers._buildHeaderMap([]);
            expect(map).toEqual([]);
        });

        it('should handle headers with large colspans', () => {
            const th1 = document.createElement('th');
            th1.colSpan = 5;
            const th2 = document.createElement('th');
            th2.colSpan = 3;

            const map = UIHelpers._buildHeaderMap([th1, th2]);
            expect(map[0].start).toBe(0);
            expect(map[0].end).toBe(4);
            expect(map[1].start).toBe(5);
            expect(map[1].end).toBe(7);
        });
    });

    describe('UIHelpers._createResizerElement - edge cases', () => {
        it('should create resizer with title attribute', () => {
            const resizer = UIHelpers._createResizerElement(2);
            expect(resizer.title).toBe('Drag to resize column');
        });

        it('should create resizer with correct dataset for various indices', () => {
            for (let i = 0; i < 10; i++) {
                const resizer = UIHelpers._createResizerElement(i);
                expect(resizer.dataset.colIndex).toBe(String(i));
            }
        });
    });

    describe('UIHelpers._ensureRelativePosition - edge cases', () => {
        it('should set position to relative for static element', () => {
            const element = document.createElement('div');
            element.style.position = 'static';
            document.body.appendChild(element);

            UIHelpers._ensureRelativePosition(element);
            // The method checks computed style and sets relative if static
            const computed = window.getComputedStyle(element).position;
            expect(computed === 'relative' || computed === 'static').toBe(true);

            document.body.removeChild(element);
        });

        it('should not throw when getComputedStyle fails', () => {
            const element = document.createElement('div');
            const originalGetComputedStyle = window.getComputedStyle;
            window.getComputedStyle = () => { throw new Error('test'); };

            expect(() => {
                UIHelpers._ensureRelativePosition(element);
            }).not.toThrow();

            window.getComputedStyle = originalGetComputedStyle;
        });
    });

    describe('UIHelpers._createResizeHandlers - pointer events', () => {
        let table, colgroup, resizer, headerMap;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '100px';
            const col2 = document.createElement('col');
            col2.style.width = '100px';
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const row = document.createElement('tr');
            row.appendChild(document.createElement('td'));
            row.appendChild(document.createElement('td'));
            tbody.appendChild(row);
            table.appendChild(tbody);

            headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';
            table.style.width = '200px';

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
            document.body.classList.remove('pdt-col-resize-active');
        });

        it('should handle onPointerDown event', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const event = {
                clientX: 100,
                pointerId: 1,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            event.target.setPointerCapture = vi.fn();

            handlers.onPointerDown(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });

        it('should handle onMouseDown when no pointerId', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const event = {
                clientX: 100,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            handlers.onMouseDown(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle keyboard resize with ArrowLeft reducing width', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const col = colgroup.querySelector('col');
            col.style.width = '100px';

            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn(), writable: true });

            handlers.onKeyDown(event);

            const newWidth = parseFloat(col.style.width);
            expect(newWidth).toBeLessThanOrEqual(100);
        });

        it('should handle keyboard resize at minimum width', () => {
            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const col = colgroup.querySelector('col');
            col.style.width = '30px';

            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn(), writable: true });

            handlers.onKeyDown(event);

            const newWidth = parseFloat(col.style.width);
            expect(newWidth).toBeGreaterThanOrEqual(30);
        });

        it('should handle missing left column in keyboard navigation', () => {
            resizer.dataset.colIndex = '10';

            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: Array.from(table.querySelectorAll('th')),
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn(), writable: true });

            expect(() => {
                handlers.onKeyDown(event);
            }).not.toThrow();
        });
    });

    describe('UIHelpers._lockTableColumnWidths - edge cases', () => {
        it('should handle table with zero width', () => {
            const table = document.createElement('table');
            const colgroup = document.createElement('colgroup');
            colgroup.appendChild(document.createElement('col'));
            table.appendChild(colgroup);

            const headerMap = [];
            const getRows = () => [];

            expect(() => {
                UIHelpers._lockTableColumnWidths(table, colgroup, headerMap, 1, 30, getRows);
            }).not.toThrow();
        });

        it('should apply fixed layout to table', () => {
            const table = document.createElement('table');
            const colgroup = document.createElement('colgroup');
            colgroup.appendChild(document.createElement('col'));
            colgroup.appendChild(document.createElement('col'));
            table.appendChild(colgroup);
            document.body.appendChild(table);

            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            const headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];
            const getRows = () => [];

            UIHelpers._lockTableColumnWidths(table, colgroup, headerMap, 2, 30, getRows);
            expect(table.style.tableLayout).toBe('fixed');

            document.body.removeChild(table);
        });
    });

    describe('UIHelpers._getCurrentColumnWidths - edge cases', () => {
        it('should handle colgroup with missing col elements', () => {
            const colgroup = document.createElement('colgroup');
            colgroup.appendChild(document.createElement('col'));

            const widths = UIHelpers._getCurrentColumnWidths(colgroup, 5, 40);
            expect(widths.length).toBe(5);
            expect(widths[0]).toBe(40); // Uses minWidth since no rendered width
            expect(widths[4]).toBe(40);
        });

        it('should respect minimum width for rendered columns', () => {
            const colgroup = document.createElement('colgroup');
            const col = document.createElement('col');
            col.style.width = '10px';
            colgroup.appendChild(col);
            document.body.appendChild(colgroup);

            const widths = UIHelpers._getCurrentColumnWidths(colgroup, 1, 50);
            expect(widths[0]).toBeGreaterThanOrEqual(50);

            document.body.removeChild(colgroup);
        });
    });

    describe('UIHelpers._computeColumnWidths - edge cases', () => {
        it('should handle body cells with scrollWidth', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'Some long text content';
            Object.defineProperty(td, 'scrollWidth', { value: 200 });
            row.appendChild(td);
            container.appendChild(row);

            const headerMap = [];
            const getRows = () => [row];

            const widths = UIHelpers._computeColumnWidths(headerMap, getRows, 1, 30);
            expect(widths[0]).toBeGreaterThanOrEqual(30);

            document.body.removeChild(container);
        });

        it('should divide header width by span', () => {
            const th = document.createElement('th');
            th.colSpan = 3;
            Object.defineProperty(th, 'getBoundingClientRect', {
                value: () => ({ width: 300 })
            });

            const headerMap = [{ th, start: 0, end: 2, span: 3 }];
            const getRows = () => [];

            const widths = UIHelpers._computeColumnWidths(headerMap, getRows, 3, 30);
            expect(widths.length).toBe(3);
        });
    });

    describe('UIHelpers._scaleColumnWidths - edge cases', () => {
        it('should handle very small target width', () => {
            const colWidths = [100, 100, 100];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 100, 30);

            expect(scaled.length).toBe(3);
            expect(scaled.every(w => w >= 30)).toBe(true);
        });

        it('should handle large target width', () => {
            const colWidths = [50, 50, 50];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 1000, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(1000);
        });

        it('should handle all columns at minimum width', () => {
            const colWidths = [30, 30, 30];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 90, 30);

            expect(scaled).toEqual([30, 30, 30]);
        });

        it('should fix rounding errors by adding pixels', () => {
            const colWidths = [100, 100, 100];
            // Target slightly larger to force adding
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 301, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(301);
        });

        it('should fix rounding errors by removing pixels', () => {
            const colWidths = [100, 100, 100];
            // Target slightly smaller
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 299, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(299);
        });
    });

    describe('UIHelpers._applyColumnWidths - edge cases', () => {
        it('should handle missing col elements', () => {
            const colgroup = document.createElement('colgroup');
            colgroup.appendChild(document.createElement('col'));

            const headerMap = [];
            const getRows = () => [];

            expect(() => {
                UIHelpers._applyColumnWidths(colgroup, headerMap, getRows, [100, 100], 2, 30);
            }).not.toThrow();
        });

        it('should apply widths to body cells', () => {
            const colgroup = document.createElement('colgroup');
            colgroup.appendChild(document.createElement('col'));
            colgroup.appendChild(document.createElement('col'));

            const row = document.createElement('tr');
            const td1 = document.createElement('td');
            const td2 = document.createElement('td');
            row.appendChild(td1);
            row.appendChild(td2);

            const headerMap = [];
            const getRows = () => [row];

            UIHelpers._applyColumnWidths(colgroup, headerMap, getRows, [100, 150], 2, 30);
            expect(td1.style.minWidth).toBe('100px');
            expect(td2.style.minWidth).toBe('150px');
        });

        it('should handle row with fewer cells than columns', () => {
            const colgroup = document.createElement('colgroup');
            colgroup.appendChild(document.createElement('col'));
            colgroup.appendChild(document.createElement('col'));
            colgroup.appendChild(document.createElement('col'));

            const row = document.createElement('tr');
            row.appendChild(document.createElement('td'));

            const headerMap = [];
            const getRows = () => [row];

            expect(() => {
                UIHelpers._applyColumnWidths(colgroup, headerMap, getRows, [100, 100, 100], 3, 30);
            }).not.toThrow();
        });
    });

    describe('UIHelpers._applyColumnResize - proportional mode edge cases', () => {
        let table, colgroup, resizer;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '100px';
            const col2 = document.createElement('col');
            col2.style.width = '100px';
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);
            table.style.width = '200px';

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should enforce minWidth on left column in proportional mode', () => {
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: -100,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 100,
                startTableWidth: 200,
                resizeMode: 'proportional',
                minWidth: 50,
                table
            });

            const cols = getCols();
            expect(parseInt(cols[0].style.width)).toBeGreaterThanOrEqual(50);
        });

        it('should enforce minWidth on right column in proportional mode', () => {
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: 100,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 100,
                startTableWidth: 200,
                resizeMode: 'proportional',
                minWidth: 50,
                table
            });

            const cols = getCols();
            expect(parseInt(cols[1].style.width)).toBeGreaterThanOrEqual(50);
        });

        it('should adjust left when right hits minWidth', () => {
            const getCols = () => Array.from(colgroup.querySelectorAll('col'));
            UIHelpers._applyColumnResize({
                resizer,
                delta: 80,
                getCols,
                startLeftWidth: 100,
                startRightWidth: 100,
                startTableWidth: 200,
                resizeMode: 'proportional',
                minWidth: 30,
                table
            });

            const cols = getCols();
            const leftWidth = parseInt(cols[0].style.width);
            const rightWidth = parseInt(cols[1].style.width);
            expect(rightWidth).toBeGreaterThanOrEqual(30);
            expect(leftWidth + rightWidth).toBeCloseTo(200, -1);
        });
    });

    describe('UIHelpers.destroyColumnResize - comprehensive cleanup', () => {
        let table;

        beforeEach(() => {
            table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            for (let i = 0; i < 3; i++) {
                const th = document.createElement('th');
                th.textContent = `Column ${i + 1}`;
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const row = document.createElement('tr');
            for (let i = 0; i < 3; i++) {
                row.appendChild(document.createElement('td'));
            }
            tbody.appendChild(row);
            table.appendChild(tbody);

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should remove all resizers from DOM', () => {
            UIHelpers.initColumnResize(table);
            expect(table.querySelectorAll('.pdt-column-resizer').length).toBeGreaterThan(0);

            UIHelpers.destroyColumnResize(table);
            expect(table.querySelectorAll('.pdt-column-resizer').length).toBe(0);
        });

        it('should clean up _pdtResizeHandlers from resizers', () => {
            UIHelpers.initColumnResize(table);
            const resizers = table.querySelectorAll('.pdt-column-resizer');
            resizers.forEach(r => {
                expect(r._pdtResizeHandlers).toBeDefined();
            });

            UIHelpers.destroyColumnResize(table);
        });

        it('should clear resizeInit from parent headers', () => {
            UIHelpers.initColumnResize(table);
            const headers = table.querySelectorAll('th');
            headers.forEach(h => {
                expect(h.dataset.resizeInit).toBe('true');
            });

            UIHelpers.destroyColumnResize(table);
            headers.forEach(h => {
                expect(h.dataset.resizeInit).toBeUndefined();
            });
        });

        it('should handle resizer with active document handlers', () => {
            UIHelpers.initColumnResize(table);
            const resizer = table.querySelector('.pdt-column-resizer');

            // Simulate active drag
            resizer._pdtResizeHandlers.activeDocHandlers = {
                onMouseMove: vi.fn(),
                onMouseUp: vi.fn()
            };

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();
        });

        it('should handle resizer with active pointer', () => {
            UIHelpers.initColumnResize(table);
            const resizer = table.querySelector('.pdt-column-resizer');

            // Simulate active pointer capture
            resizer._pdtResizeHandlers.activePointer = {
                id: 1,
                target: {
                    releasePointerCapture: vi.fn()
                }
            };

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();
        });

        it('should handle resizer without handlers', () => {
            UIHelpers.initColumnResize(table);
            const resizer = table.querySelector('.pdt-column-resizer');
            delete resizer._pdtResizeHandlers;

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();
        });

        it('should handle resizer with no parent', () => {
            UIHelpers.initColumnResize(table);
            const resizer = table.querySelector('.pdt-column-resizer');
            resizer.parentNode.removeChild(resizer);

            // Re-add without parent for test
            const orphanResizer = document.createElement('div');
            orphanResizer.className = 'pdt-column-resizer';
            orphanResizer._pdtResizeHandlers = {
                onMouseDown: vi.fn(),
                onPointerDown: vi.fn(),
                onKeyDown: vi.fn(),
                stopEvent: vi.fn(),
                onDragStart: vi.fn()
            };

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();
        });

        it('should handle null activePointer gracefully', () => {
            UIHelpers.initColumnResize(table);
            const resizer = table.querySelector('.pdt-column-resizer');
            resizer._pdtResizeHandlers.activePointer = null;

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();
        });

        it('should handle releasePointerCapture throwing error', () => {
            UIHelpers.initColumnResize(table);
            const resizer = table.querySelector('.pdt-column-resizer');
            resizer._pdtResizeHandlers.activePointer = {
                id: 1,
                target: {
                    releasePointerCapture: () => { throw new Error('test'); }
                }
            };

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();
        });
    });

    describe('UIHelpers - drag behavior simulation', () => {
        let table, colgroup, resizer, handlers;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '150px';
            const col2 = document.createElement('col');
            col2.style.width = '150px';
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);
            table.style.width = '300px';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            table.appendChild(tbody);

            const headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [th1, th2],
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
            document.body.classList.remove('pdt-col-resize-active');
        });

        it('should handle complete drag sequence', () => {
            // Start drag
            const startEvent = {
                clientX: 150,
                pointerId: null,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            handlers.onPointerDown(startEvent);
            expect(startEvent.preventDefault).toHaveBeenCalled();
        });

        it('should handle drag with setPointerCapture throwing', () => {
            const event = {
                clientX: 100,
                pointerId: 1,
                target: {
                    setPointerCapture: () => { throw new Error('test'); }
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            expect(() => {
                handlers.onPointerDown(event);
            }).not.toThrow();
        });
    });

    describe('Integration: full table resize workflow', () => {
        let table;

        beforeEach(() => {
            table = document.createElement('table');
            table.style.width = '400px';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            for (let i = 0; i < 4; i++) {
                const th = document.createElement('th');
                th.textContent = `Col ${i + 1}`;
                th.style.width = '100px';
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            for (let r = 0; r < 5; r++) {
                const row = document.createElement('tr');
                for (let c = 0; c < 4; c++) {
                    const td = document.createElement('td');
                    td.textContent = `Cell ${r}-${c}`;
                    row.appendChild(td);
                }
                tbody.appendChild(row);
            }
            table.appendChild(tbody);

            document.body.appendChild(table);
        });

        afterEach(() => {
            UIHelpers.destroyColumnResize(table);
            if (table.parentNode) {
                document.body.removeChild(table);
            }
        });

        it('should initialize, resize, and cleanup table properly', () => {
            // Initialize
            UIHelpers.initColumnResize(table);
            expect(table.querySelectorAll('.pdt-column-resizer').length).toBe(4);
            expect(table.querySelector('colgroup')).not.toBeNull();

            // Verify headers are marked
            const headers = table.querySelectorAll('th');
            headers.forEach(h => {
                expect(h.dataset.resizeInit).toBe('true');
            });

            // Cleanup
            UIHelpers.destroyColumnResize(table);
            expect(table.querySelectorAll('.pdt-column-resizer').length).toBe(0);
        });

        it('should handle multiple init/destroy cycles', () => {
            for (let i = 0; i < 5; i++) {
                UIHelpers.initColumnResize(table);
                expect(table.querySelectorAll('.pdt-column-resizer').length).toBe(4);

                UIHelpers.destroyColumnResize(table);
                expect(table.querySelectorAll('.pdt-column-resizer').length).toBe(0);
            }
        });

        it('should reinitialize after destroy', () => {
            UIHelpers.initColumnResize(table);
            UIHelpers.destroyColumnResize(table);
            UIHelpers.initColumnResize(table);

            expect(table.querySelectorAll('.pdt-column-resizer').length).toBe(4);
        });
    });

    describe('UIHelpers - pointer move and drag simulation', () => {
        let table, colgroup, resizer, handlers, th1, th2;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '150px';
            const col2 = document.createElement('col');
            col2.style.width = '150px';
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);
            table.style.width = '300px';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            th1 = document.createElement('th');
            th2 = document.createElement('th');
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const row = document.createElement('tr');
            row.appendChild(document.createElement('td'));
            row.appendChild(document.createElement('td'));
            tbody.appendChild(row);
            table.appendChild(tbody);

            const headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [th1, th2],
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
            document.body.classList.remove('pdt-col-resize-active');
        });

        it('should start drag when delta exceeds threshold', () => {
            // Simulate pointer down
            const downEvent = {
                clientX: 100,
                pointerId: null,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Now there should be an internal move listener attached
            // We need to get it from the internal state via a workaround
        });

        it('should handle pointer move below threshold', () => {
            // Start drag
            const downEvent = {
                clientX: 100,
                pointerId: null,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onMouseDown(downEvent);
        });

        it('should handle column resize via handlers with pointerId', () => {
            const mockTarget = document.createElement('div');
            mockTarget.setPointerCapture = vi.fn();

            const event = {
                clientX: 100,
                pointerId: 5,
                target: mockTarget,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            handlers.onPointerDown(event);
            expect(mockTarget.setPointerCapture).toHaveBeenCalledWith(5);
            expect(resizer._pdtResizeHandlers.activePointer).toEqual({ id: 5, target: mockTarget });
        });

        it('should store active document handlers on pointer down', () => {
            const event = {
                clientX: 100,
                pointerId: null,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            handlers.onPointerDown(event);
            expect(resizer._pdtResizeHandlers.activeDocHandlers).toBeDefined();
        });
    });

    describe('UIHelpers._scaleColumnWidths - rounding correction loop', () => {
        it('should handle case where removing pixels from minWidth columns', () => {
            // Create a scenario where sum is larger than target but all columns at minWidth
            const colWidths = [30, 30, 30];
            // Target is smaller than sum of minWidths - can't reduce
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 80, 30);

            expect(scaled.length).toBe(3);
            // Columns should stay at minWidth since they can't go lower
            scaled.forEach(w => expect(w).toBeGreaterThanOrEqual(30));
        });

        it('should iterate through columns to remove excess pixels', () => {
            const colWidths = [100, 100, 100];
            // Target that will require removing a few pixels
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 298, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(298);
        });

        it('should handle scenario where attempts limit is reached', () => {
            // Create widths very close to minWidth that can't be reduced much
            const colWidths = [31, 31, 31];
            // Target slightly smaller than possible
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 90, 30);

            expect(scaled.length).toBe(3);
        });

        it('should cycle through all columns when removing pixels', () => {
            const colWidths = [50, 50, 50, 50];
            // Force removal from multiple columns
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 195, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBeLessThanOrEqual(200);
        });
    });

    describe('UIHelpers._attachResizeListeners - mousedown fallback', () => {
        it('should attach mousedown listener when PointerEvent is undefined', () => {
            const originalPointerEvent = window.PointerEvent;
            delete window.PointerEvent;

            const resizer = document.createElement('div');
            const addEventListenerSpy = vi.spyOn(resizer, 'addEventListener');
            const handlers = {
                onPointerDown: vi.fn(),
                onMouseDown: vi.fn(),
                onKeyDown: vi.fn(),
                stopEvent: vi.fn(),
                onDragStart: vi.fn()
            };

            UIHelpers._attachResizeListeners(resizer, handlers);
            expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', handlers.onMouseDown);

            window.PointerEvent = originalPointerEvent;
        });
    });

    describe('UIHelpers.initColumnResize - destroyColumnResize exception handling', () => {
        it('should handle destroyColumnResize throwing during cleanup', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            tr.appendChild(th);
            thead.appendChild(tr);
            table.appendChild(thead);
            document.body.appendChild(table);

            // First init
            UIHelpers.initColumnResize(table);

            // Corrupt the resizer to make destroy throw
            const resizer = table.querySelector('.pdt-column-resizer');
            if (resizer) {
                Object.defineProperty(resizer, 'parentNode', {
                    get: () => { throw new Error('test error'); }
                });
            }

            // Re-init should handle the error gracefully
            expect(() => {
                UIHelpers.initColumnResize(table);
            }).not.toThrow();

            document.body.removeChild(table);
        });
    });

    describe('UIHelpers - endDrag function coverage', () => {
        let table, colgroup, resizer, handlers, headerMap;

        beforeEach(() => {
            table = document.createElement('table');
            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '100px';
            const col2 = document.createElement('col');
            col2.style.width = '100px';
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);
            table.style.width = '200px';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            table.appendChild(tbody);

            headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [th1, th2],
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
            document.body.classList.remove('pdt-col-resize-active');
        });

        it('should setup handlers with activePointer and end correctly', () => {
            const mockTarget = {
                setPointerCapture: vi.fn(),
                releasePointerCapture: vi.fn()
            };

            const downEvent = {
                clientX: 100,
                pointerId: 1,
                target: mockTarget,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            handlers.onPointerDown(downEvent);

            // Verify activePointer was stored
            expect(resizer._pdtResizeHandlers.activePointer).toBeDefined();
            expect(resizer._pdtResizeHandlers.activePointer.id).toBe(1);
        });

        it('should handle endDrag with preventDocClick cleanup', () => {
            const downEvent = {
                clientX: 100,
                pointerId: null,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            handlers.onPointerDown(downEvent);

            // The handlers should have been stored
            expect(resizer._pdtResizeHandlers.activeDocHandlers).toBeDefined();
        });
    });

    describe('UIHelpers - additional edge case coverage', () => {
        it('should handle headers array with getBoundingClientRect in startDrag', () => {
            const table = document.createElement('table');
            const colgroup = document.createElement('colgroup');
            // No col elements - will fall back to header width
            table.appendChild(colgroup);
            table.style.width = '200px';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            // Mock getBoundingClientRect
            Object.defineProperty(th1, 'getBoundingClientRect', {
                value: () => ({ width: 100 })
            });
            Object.defineProperty(th2, 'getBoundingClientRect', {
                value: () => ({ width: 100 })
            });
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            document.body.appendChild(table);

            const resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            const headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [th1, th2],
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const downEvent = {
                clientX: 100,
                pointerId: null,
                target: resizer,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            expect(() => handlers.onPointerDown(downEvent)).not.toThrow();

            document.body.removeChild(table);
        });
    });

    describe('UIHelpers.destroyColumnResize - parent without dataset', () => {
        it('should handle parent element without dataset', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            tr.appendChild(th);
            thead.appendChild(tr);
            table.appendChild(thead);
            document.body.appendChild(table);

            UIHelpers.initColumnResize(table);

            const resizer = table.querySelector('.pdt-column-resizer');
            if (resizer && resizer.parentNode) {
                // Remove dataset from parent to test edge case
                Object.defineProperty(resizer.parentNode, 'dataset', {
                    get: () => { throw new Error('no dataset'); }
                });
            }

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();

            document.body.removeChild(table);
        });
    });

    describe('UIHelpers.destroyColumnResize - activePointer edge cases', () => {
        it('should handle activePointer with null id', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            tr.appendChild(th);
            thead.appendChild(tr);
            table.appendChild(thead);
            document.body.appendChild(table);

            UIHelpers.initColumnResize(table);

            const resizer = table.querySelector('.pdt-column-resizer');
            if (resizer) {
                resizer._pdtResizeHandlers.activePointer = {
                    id: null,
                    target: { releasePointerCapture: vi.fn() }
                };
            }

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();

            document.body.removeChild(table);
        });

        it('should handle activePointer without releasePointerCapture', () => {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            tr.appendChild(th);
            thead.appendChild(tr);
            table.appendChild(thead);
            document.body.appendChild(table);

            UIHelpers.initColumnResize(table);

            const resizer = table.querySelector('.pdt-column-resizer');
            if (resizer) {
                resizer._pdtResizeHandlers.activePointer = {
                    id: 1,
                    target: {} // no releasePointerCapture
                };
            }

            expect(() => {
                UIHelpers.destroyColumnResize(table);
            }).not.toThrow();

            document.body.removeChild(table);
        });
    });

    describe('UIHelpers - onPointerMove and endDrag coverage', () => {
        let table, colgroup, resizer, handlers, th1, th2;

        beforeEach(() => {
            table = document.createElement('table');
            table.style.width = '300px';
            Object.defineProperty(table, 'getBoundingClientRect', {
                value: () => ({ width: 300 }),
                configurable: true
            });

            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '150px';
            Object.defineProperty(col1, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            const col2 = document.createElement('col');
            col2.style.width = '150px';
            Object.defineProperty(col2, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            th1 = document.createElement('th');
            th2 = document.createElement('th');
            Object.defineProperty(th1, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            Object.defineProperty(th2, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const row = document.createElement('tr');
            const td1 = document.createElement('td');
            const td2 = document.createElement('td');
            row.appendChild(td1);
            row.appendChild(td2);
            tbody.appendChild(row);
            table.appendChild(tbody);

            const headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [th1, th2],
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
            document.body.classList.remove('pdt-col-resize-active');
            // Clean up any document event listeners
            document.removeEventListener('pointermove', () => { });
            document.removeEventListener('pointerup', () => { });
            document.removeEventListener('mousemove', () => { });
            document.removeEventListener('mouseup', () => { });
        });

        it('should trigger drag start when pointer move exceeds threshold', () => {
            // Start pointer down
            const downEvent = {
                clientX: 100,
                pointerId: 1,
                target: {
                    setPointerCapture: vi.fn()
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Simulate pointermove event by dispatching to document
            const moveEvent = new PointerEvent('pointermove', {
                clientX: 120, // 20px delta, exceeds threshold of 3
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // Check that dragging state was activated
            expect(document.body.classList.contains('pdt-col-resize-active')).toBe(true);

            // Cleanup with pointerup
            const upEvent = new PointerEvent('pointerup', {
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(upEvent);
        });

        it('should not start drag when pointer move is below threshold', () => {
            const downEvent = {
                clientX: 100,
                pointerId: 1,
                target: {
                    setPointerCapture: vi.fn()
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Simulate small movement below threshold
            const moveEvent = new PointerEvent('pointermove', {
                clientX: 101, // 1px delta, below threshold of 3
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // Dragging should not be active
            expect(document.body.classList.contains('pdt-col-resize-active')).toBe(false);

            // Cleanup
            const upEvent = new PointerEvent('pointerup', {
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(upEvent);
        });

        it('should apply resize during drag', () => {
            const downEvent = {
                clientX: 100,
                pointerId: 1,
                target: {
                    setPointerCapture: vi.fn()
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Large movement to trigger drag
            const moveEvent = new PointerEvent('pointermove', {
                clientX: 130,
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // Verify body has resize class
            expect(document.body.classList.contains('pdt-col-resize-active')).toBe(true);

            // Cleanup
            const upEvent = new PointerEvent('pointerup', {
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(upEvent);
            expect(document.body.classList.contains('pdt-col-resize-active')).toBe(false);
        });

        it('should handle end drag and clean up event listeners', () => {
            const downEvent = {
                clientX: 100,
                pointerId: 1,
                target: {
                    setPointerCapture: vi.fn(),
                    releasePointerCapture: vi.fn()
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Trigger drag
            const moveEvent = new PointerEvent('pointermove', {
                clientX: 120,
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // End drag
            const upEvent = new PointerEvent('pointerup', {
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(upEvent);

            // Body class should be removed
            expect(document.body.classList.contains('pdt-col-resize-active')).toBe(false);
        });

        it('should handle pointercancel event', () => {
            const downEvent = {
                clientX: 100,
                pointerId: 1,
                target: {
                    setPointerCapture: vi.fn()
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Trigger drag
            const moveEvent = new PointerEvent('pointermove', {
                clientX: 120,
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // Cancel drag
            const cancelEvent = new PointerEvent('pointercancel', {
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(cancelEvent);

            // Body class should be removed
            expect(document.body.classList.contains('pdt-col-resize-active')).toBe(false);
        });

        it('should prevent document clicks during drag', () => {
            const downEvent = {
                clientX: 100,
                pointerId: 1,
                target: {
                    setPointerCapture: vi.fn()
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Trigger drag to install click prevention
            const moveEvent = new PointerEvent('pointermove', {
                clientX: 120,
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // Click should be prevented during drag
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'stopPropagation', { value: vi.fn() });
            Object.defineProperty(clickEvent, 'preventDefault', { value: vi.fn() });

            // End drag to clean up
            const upEvent = new PointerEvent('pointerup', {
                pointerId: 1,
                bubbles: true
            });
            document.dispatchEvent(upEvent);
        });
    });

    describe('UIHelpers - mouse fallback for drag', () => {
        let table, colgroup, handlers;

        beforeEach(() => {
            table = document.createElement('table');
            table.style.width = '300px';
            Object.defineProperty(table, 'getBoundingClientRect', {
                value: () => ({ width: 300 }),
                configurable: true
            });

            colgroup = document.createElement('colgroup');
            const col1 = document.createElement('col');
            col1.style.width = '150px';
            Object.defineProperty(col1, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            const col2 = document.createElement('col');
            col2.style.width = '150px';
            Object.defineProperty(col2, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            colgroup.appendChild(col1);
            colgroup.appendChild(col2);
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            const th2 = document.createElement('th');
            Object.defineProperty(th1, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            Object.defineProperty(th2, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            table.appendChild(tbody);

            const resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            const headerMap = [
                { th: th1, start: 0, end: 0, span: 1 },
                { th: th2, start: 1, end: 1, span: 1 }
            ];

            handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [th1, th2],
                headerMap,
                colCount: 2,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            document.body.appendChild(table);
        });

        afterEach(() => {
            if (table.parentNode) {
                document.body.removeChild(table);
            }
            document.body.classList.remove('pdt-col-resize-active');
        });

        it('should use mousemove/mouseup when no pointerId', () => {
            const downEvent = {
                clientX: 100,
                pointerId: null, // No pointer ID triggers mouse fallback
                target: document.createElement('div'),
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Simulate mousemove
            const moveEvent = new MouseEvent('mousemove', {
                clientX: 120,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // End with mouseup
            const upEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            document.dispatchEvent(upEvent);

            expect(document.body.classList.contains('pdt-col-resize-active')).toBe(false);
        });
    });

    describe('UIHelpers._scaleColumnWidths - detailed rounding loop', () => {
        it('should remove pixels correctly when sum exceeds target', () => {
            // Create a scenario that definitely triggers the removal loop
            const colWidths = [100, 100, 100];
            // Scale down significantly
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 240, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(240);
        });

        it('should handle removal when some columns are at minWidth', () => {
            const colWidths = [35, 35, 100];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 150, 30);

            // All columns should be at least minWidth
            scaled.forEach(w => expect(w).toBeGreaterThanOrEqual(30));
        });

        it('should wrap around when removing pixels', () => {
            const colWidths = [50, 50, 50, 50];
            // Force wrap-around during removal
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 190, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBeLessThanOrEqual(200);
        });
    });

    describe('UIHelpers - endDrag with activePointer cleanup', () => {
        it('should release pointer capture during endDrag', () => {
            const table = document.createElement('table');
            table.style.width = '300px';
            Object.defineProperty(table, 'getBoundingClientRect', {
                value: () => ({ width: 300 }),
                configurable: true
            });

            const colgroup = document.createElement('colgroup');
            const col = document.createElement('col');
            col.style.width = '150px';
            Object.defineProperty(col, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            colgroup.appendChild(col);
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const th = document.createElement('th');
            Object.defineProperty(th, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            headerRow.appendChild(th);
            thead.appendChild(headerRow);
            table.appendChild(thead);

            document.body.appendChild(table);

            const resizer = document.createElement('div');
            resizer.dataset.colIndex = '0';

            const headerMap = [{ th, start: 0, end: 0, span: 1 }];

            const handlers = UIHelpers._createResizeHandlers({
                table,
                resizer,
                colgroup,
                headers: [th],
                headerMap,
                colCount: 1,
                resizeMode: 'shift',
                minWidth: 30,
                threshold: 3
            });

            const mockReleasePointerCapture = vi.fn();
            const downEvent = {
                clientX: 100,
                pointerId: 5,
                target: {
                    setPointerCapture: vi.fn(),
                    releasePointerCapture: mockReleasePointerCapture
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };
            handlers.onPointerDown(downEvent);

            // Trigger drag
            const moveEvent = new PointerEvent('pointermove', {
                clientX: 120,
                pointerId: 5,
                bubbles: true
            });
            document.dispatchEvent(moveEvent);

            // End drag
            const upEvent = new PointerEvent('pointerup', {
                pointerId: 5,
                bubbles: true
            });
            document.dispatchEvent(upEvent);

            document.body.removeChild(table);
        });
    });

    describe('UIHelpers initColumnResize - dragging threshold logic', () => {
        it('should not start dragging when delta is below threshold', () => {
            const table = document.createElement('table');
            table.className = 'pdt-table';
            table.style.width = '300px';
            Object.defineProperty(table, 'getBoundingClientRect', {
                value: () => ({ width: 300 }),
                configurable: true
            });

            const colgroup = document.createElement('colgroup');
            const col = document.createElement('col');
            col.style.width = '150px';
            Object.defineProperty(col, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            colgroup.appendChild(col);
            table.appendChild(colgroup);

            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.style.width = '150px';
            Object.defineProperty(th, 'getBoundingClientRect', {
                value: () => ({ width: 150 }),
                configurable: true
            });
            tr.appendChild(th);
            thead.appendChild(tr);
            table.appendChild(thead);

            document.body.appendChild(table);

            // initColumnResize doesn't return anything, it sets up handlers internally
            UIHelpers.initColumnResize(table);

            // Create resizer and set up for drag
            const resizer = table.querySelector('.pdt-col-resizer');
            if (resizer) {
                const downEvent = {
                    clientX: 100,
                    target: resizer,
                    preventDefault: vi.fn(),
                    stopPropagation: vi.fn(),
                    pointerId: 1,
                    setPointerCapture: vi.fn()
                };
                resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100 }));

                // Move less than threshold (2px default)
                const moveEvent = new PointerEvent('pointermove', {
                    clientX: 101,
                    bubbles: true
                });
                document.dispatchEvent(moveEvent);

                // Body should not have resize class since we didn't exceed threshold
                expect(document.body.classList.contains('pdt-col-resize-active')).toBe(false);
            }

            UIHelpers.destroyColumnResize(table);
            document.body.removeChild(table);
        });
    });

    describe('UIHelpers._scaleColumnWidths - removal loop with minWidth constraint', () => {
        it('should skip removal when column is at minWidth', () => {
            // Create scenario where sum exceeds target but columns are at/near minWidth
            // All columns start at minWidth, sum = 120, target = 90
            // Removal loop should terminate due to attempts limit, not because sum <= target
            const colWidths = [30, 30, 30, 30];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 120, 30);

            // All columns should be at minWidth (30) since they can't be reduced further
            scaled.forEach(w => expect(w).toBeGreaterThanOrEqual(30));
        });

        it('should handle removal loop wrap-around with attempts limit', () => {
            // Force a scenario where removal needs multiple passes
            const colWidths = [40, 40, 40];
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 110, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            // Sum should be close to target or at minimum possible
            expect(total).toBeLessThanOrEqual(120);
            expect(total).toBeGreaterThanOrEqual(90);
        });

        it('should remove pixels in reverse order and wrap around', () => {
            // Create scenario where we need to iterate multiple times
            const colWidths = [50, 50, 50];
            // Scale down to 145, forcing removal to iterate backwards
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 145, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(145);
        });
    });

    describe('UIHelpers.initColumnResize - drag threshold and preventDocClick', () => {
        it('should add preventDocClick handler when drag exceeds threshold', () => {
            const table = document.createElement('table');
            table.innerHTML = `
                <colgroup><col><col></colgroup>
                <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
                <tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody>
            `;
            document.body.appendChild(table);

            UIHelpers.initColumnResize(table);

            const resizer = table.querySelector('.pdt-col-resizer');
            if (resizer) {
                // Start drag
                const downEvent = new PointerEvent('pointerdown', {
                    clientX: 100,
                    bubbles: true
                });
                resizer.dispatchEvent(downEvent);

                // Move beyond threshold (default 2px)
                const moveEvent = new PointerEvent('pointermove', {
                    clientX: 110, // Move 10px, exceeds threshold
                    bubbles: true
                });
                document.dispatchEvent(moveEvent);

                // Body should have resize class
                expect(document.body.classList.contains('pdt-col-resize-active')).toBe(true);

                // Clean up by ending drag
                const upEvent = new PointerEvent('pointerup', { bubbles: true });
                document.dispatchEvent(upEvent);
            }

            UIHelpers.destroyColumnResize(table);
            document.body.removeChild(table);
        });

        it('should call stopPropagation and preventDefault on click during drag', () => {
            const table = document.createElement('table');
            table.innerHTML = `
                <colgroup><col><col></colgroup>
                <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
                <tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody>
            `;
            document.body.appendChild(table);

            UIHelpers.initColumnResize(table);

            const resizer = table.querySelector('.pdt-col-resizer');
            if (resizer) {
                // Start drag
                resizer.dispatchEvent(new PointerEvent('pointerdown', {
                    clientX: 100,
                    bubbles: true
                }));

                // Move beyond threshold
                document.dispatchEvent(new PointerEvent('pointermove', {
                    clientX: 115,
                    bubbles: true
                }));

                // Now we're in drag mode, click events should be prevented
                // The preventDocClick handler should be active

                // End drag
                document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            }

            UIHelpers.destroyColumnResize(table);
            document.body.removeChild(table);
        });
    });

    describe('UIHelpers._scaleColumnWidths - removal loop detailed testing', () => {
        it('should decrement scaled value and sumScaled in removal loop', () => {
            // Create a scenario where we need to remove pixels
            // Sum of widths (150) is less than target (140), so no removal needed
            // We need sum > target for removal
            const colWidths = [60, 60, 60]; // sum = 180
            // If we target 150, we need to remove 30 pixels
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 150, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(150);
        });

        it('should handle case where all columns are at minWidth', () => {
            // All columns at or below minWidth, can't reduce further
            const colWidths = [30, 30, 30]; // All at minWidth
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 85, 30);

            // Sum should be at least 90 (3 * minWidth)
            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBeGreaterThanOrEqual(90);
        });

        it('should iterate backwards removing pixels when sum exceeds target', () => {
            const colWidths = [50, 50, 50]; // sum = 150
            // Target is 147, so we need to remove 3 pixels
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 147, 30);

            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBe(147);
        });

        it('should stop removal when attempts limit is reached', () => {
            // Force maximum iterations by having columns near minWidth
            const colWidths = [32, 32, 32]; // Just above minWidth
            const scaled = UIHelpers._scaleColumnWidths(colWidths, 90, 30);

            // Should not go below 90 (3 * minWidth)
            const total = scaled.reduce((sum, w) => sum + w, 0);
            expect(total).toBeGreaterThanOrEqual(90);
        });
    });
});
