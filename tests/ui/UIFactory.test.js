/**
 * @file Tests for UIFactory
 * @module tests/ui/UIFactory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIFactory } from '../../src/ui/UIFactory.js';
import * as helpers from '../../src/helpers/index.js';

// Spy on helper functions
vi.spyOn(helpers, 'escapeHtml');
vi.spyOn(helpers, 'highlightCode');
vi.spyOn(helpers, 'formatXml');
vi.spyOn(helpers, 'copyToClipboard');

describe('UIFactory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createCopyableCodeBlock', () => {
        it('should create code block with string input', () => {
            const code = 'console.log("test");';
            const element = UIFactory.createCopyableCodeBlock(code, 'javascript');

            expect(element).toBeInstanceOf(HTMLDivElement);
            expect(element.className).toBe('copyable-code-block');
        });

        it('should create code block with object input', () => {
            const code = { name: 'test', value: 123 };
            const element = UIFactory.createCopyableCodeBlock(code, 'json');

            expect(element).toBeInstanceOf(HTMLDivElement);
            const codeElement = element.querySelector('code');
            expect(codeElement).toBeTruthy();
        });

        it('should include copy button', () => {
            const code = 'test code';
            const element = UIFactory.createCopyableCodeBlock(code);

            const button = element.querySelector('button');
            expect(button).toBeTruthy();
        });

        it('should handle JSON language', () => {
            const code = '{"test": "value"}';
            const element = UIFactory.createCopyableCodeBlock(code, 'json');

            expect(element.querySelector('code')).toBeTruthy();
        });

        it('should handle invalid JSON gracefully', () => {
            const code = '{invalid json}';
            expect(() => UIFactory.createCopyableCodeBlock(code, 'json')).not.toThrow();
        });

        it('should handle XML language and format XML', () => {
            const xmlCode = '<root><child>value</child></root>';
            const element = UIFactory.createCopyableCodeBlock(xmlCode, 'xml');

            expect(helpers.formatXml).toHaveBeenCalledWith(xmlCode);
            expect(helpers.escapeHtml).toHaveBeenCalled();
            expect(element.querySelector('code')).toBeTruthy();
        });

        it('should handle csharp language with escaped HTML', () => {
            const csharpCode = 'public class Test<T> { }';
            const element = UIFactory.createCopyableCodeBlock(csharpCode, 'csharp');

            expect(helpers.escapeHtml).toHaveBeenCalledWith(csharpCode);
            expect(element.querySelector('code')).toBeTruthy();
        });

        it('should handle text language with escaped HTML', () => {
            const textContent = 'Plain <text> with special & characters';
            const element = UIFactory.createCopyableCodeBlock(textContent, 'text');

            expect(helpers.escapeHtml).toHaveBeenCalledWith(textContent);
            expect(element.querySelector('code')).toBeTruthy();
        });

        it('should use JavaScript highlighting for unknown languages', () => {
            const code = 'some code';
            UIFactory.createCopyableCodeBlock(code, 'unknown-lang');

            expect(helpers.highlightCode).toHaveBeenCalledWith(code, 'javascript');
        });

        it('should default to json language when not specified', () => {
            const code = '{"key": "value"}';
            UIFactory.createCopyableCodeBlock(code);

            expect(helpers.highlightCode).toHaveBeenCalledWith(expect.any(String), 'json');
        });

        it('should call copyToClipboard when button is clicked', () => {
            const code = 'test code to copy';
            const element = UIFactory.createCopyableCodeBlock(code, 'text');

            const button = element.querySelector('button');
            const stopPropagationSpy = vi.fn();
            const event = { stopPropagation: stopPropagationSpy };
            button.onclick(event);

            expect(helpers.copyToClipboard).toHaveBeenCalled();
        });

        it('should stop propagation on copy button click', () => {
            const code = 'test code';
            const element = UIFactory.createCopyableCodeBlock(code, 'text');

            const button = element.querySelector('button');
            const stopPropagationSpy = vi.fn();
            const event = { stopPropagation: stopPropagationSpy };
            button.onclick(event);

            expect(stopPropagationSpy).toHaveBeenCalled();
        });

        it('should handle empty string input', () => {
            const element = UIFactory.createCopyableCodeBlock('', 'text');

            expect(element).toBeInstanceOf(HTMLDivElement);
            expect(element.querySelector('code')).toBeTruthy();
        });

        it('should handle special characters in code', () => {
            const code = '<script>alert("XSS")</script>';
            UIFactory.createCopyableCodeBlock(code, 'text');

            expect(helpers.escapeHtml).toHaveBeenCalledWith(code);
        });

        it('should create pre element containing code element', () => {
            const code = 'test';
            const element = UIFactory.createCopyableCodeBlock(code);

            const pre = element.querySelector('pre');
            expect(pre).toBeTruthy();
            expect(pre.querySelector('code')).toBeTruthy();
        });

        it('should handle deeply nested object input', () => {
            const code = {
                level1: {
                    level2: {
                        level3: { value: 'deep' }
                    }
                }
            };
            const element = UIFactory.createCopyableCodeBlock(code, 'json');

            expect(element).toBeInstanceOf(HTMLDivElement);
        });

        it('should handle array input', () => {
            const code = [1, 2, 3, { nested: true }];
            const element = UIFactory.createCopyableCodeBlock(code, 'json');

            expect(element).toBeInstanceOf(HTMLDivElement);
            expect(element.querySelector('code')).toBeTruthy();
        });

        it('should apply JavaScript highlighting for javascript language', () => {
            const code = 'function test() { return true; }';
            UIFactory.createCopyableCodeBlock(code, 'javascript');

            expect(helpers.highlightCode).toHaveBeenCalledWith(code, 'javascript');
        });

        it('should have button and pre as children of container', () => {
            const code = 'test';
            const element = UIFactory.createCopyableCodeBlock(code);

            const children = element.children;
            expect(children[0].tagName).toBe('BUTTON');
            expect(children[1].tagName).toBe('PRE');
        });

        it('should handle multiline code strings', () => {
            const code = `line 1
line 2
line 3`;
            const element = UIFactory.createCopyableCodeBlock(code, 'text');

            expect(element).toBeInstanceOf(HTMLDivElement);
        });

        it('should have button with copy text', () => {
            const code = 'test';
            const element = UIFactory.createCopyableCodeBlock(code);

            const button = element.querySelector('button');
            expect(button.textContent).toBeTruthy();
        });

        it('should handle null values in object', () => {
            const code = { key: null, value: undefined };
            const element = UIFactory.createCopyableCodeBlock(code, 'json');

            expect(element).toBeInstanceOf(HTMLDivElement);
        });

        it('should handle boolean values in object', () => {
            const code = { isActive: true, isDisabled: false };
            const element = UIFactory.createCopyableCodeBlock(code, 'json');

            expect(element).toBeInstanceOf(HTMLDivElement);
        });

        it('should handle numeric values in object', () => {
            const code = { count: 42, price: 19.99 };
            const element = UIFactory.createCopyableCodeBlock(code, 'json');

            expect(element).toBeInstanceOf(HTMLDivElement);
        });

        it('should handle string with unicode characters', () => {
            const code = 'const greeting = "Hello 🌍 World! こんにちは";';
            const element = UIFactory.createCopyableCodeBlock(code, 'javascript');

            expect(element).toBeInstanceOf(HTMLDivElement);
        });

        it('should handle very long single line code', () => {
            const code = 'a'.repeat(1000);
            const element = UIFactory.createCopyableCodeBlock(code, 'text');

            expect(element).toBeInstanceOf(HTMLDivElement);
        });
    });

    describe('createFormDisabledMessage', () => {
        it('should create form disabled message element', () => {
            const element = UIFactory.createFormDisabledMessage();

            expect(element).toBeInstanceOf(HTMLDivElement);
            expect(element.className).toBe('pdt-form-disabled-message');
        });

        it('should include icon, title, and message', () => {
            const element = UIFactory.createFormDisabledMessage();

            expect(element.querySelector('.icon')).toBeTruthy();
            expect(element.querySelector('h3')).toBeTruthy();
            expect(element.querySelector('p')).toBeTruthy();
        });

        it('should have correct structure with icon div first', () => {
            const element = UIFactory.createFormDisabledMessage();

            const firstChild = element.firstElementChild;
            expect(firstChild.className).toBe('icon');
        });

        it('should contain h3 title element', () => {
            const element = UIFactory.createFormDisabledMessage();

            const h3 = element.querySelector('h3');
            expect(h3).toBeTruthy();
            expect(h3.textContent).toBeTruthy();
        });

        it('should contain p message element', () => {
            const element = UIFactory.createFormDisabledMessage();

            const p = element.querySelector('p');
            expect(p).toBeTruthy();
            expect(p.textContent).toBeTruthy();
        });

        it('should return a new element on each call', () => {
            const element1 = UIFactory.createFormDisabledMessage();
            const element2 = UIFactory.createFormDisabledMessage();

            expect(element1).not.toBe(element2);
        });
    });
});
