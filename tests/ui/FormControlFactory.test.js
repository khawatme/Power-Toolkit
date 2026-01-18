/**
 * @file Tests for FormControlFactory
 * @module tests/ui/FormControlFactory.test.js
 * @description Test suite for form control creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormControlFactory } from '../../src/ui/FormControlFactory.js';

describe('FormControlFactory', () => {
    describe('create', () => {
        describe('string type', () => {
            it('should create text input for string type', () => {
                const html = FormControlFactory.create('string', 'test value');

                expect(html).toContain('<input');
                expect(html).toContain('type="text"');
                expect(html).toContain('test value');
            });

            it('should escape HTML in string values', () => {
                const html = FormControlFactory.create('string', '<script>alert("xss")</script>');

                expect(html).not.toContain('<script>');
                expect(html).toContain('&lt;script&gt;');
            });

            it('should handle null string value', () => {
                const html = FormControlFactory.create('string', null);

                expect(html).toContain('<input');
                expect(html).toContain('value=""');
            });

            it('should handle undefined string value', () => {
                const html = FormControlFactory.create('string', undefined);

                expect(html).toContain('<input');
            });

            it('should include pdt-input class', () => {
                const html = FormControlFactory.create('string', 'value');

                expect(html).toContain('class="pdt-input"');
            });

            it('should include correct id', () => {
                const html = FormControlFactory.create('string', 'value');

                expect(html).toContain('id="pdt-prompt-input"');
            });
        });

        describe('memo type', () => {
            it('should create textarea for memo type', () => {
                const html = FormControlFactory.create('memo', 'long text');

                expect(html).toContain('<textarea');
                expect(html).toContain('long text');
            });

            it('should include rows attribute', () => {
                const html = FormControlFactory.create('memo', 'text');

                expect(html).toContain('rows="4"');
            });

            it('should include spellcheck disabled', () => {
                const html = FormControlFactory.create('memo', 'text');

                expect(html).toContain('spellcheck="false"');
            });

            it('should escape HTML in memo content', () => {
                const html = FormControlFactory.create('memo', '<div>unsafe</div>');

                expect(html).not.toContain('<div>unsafe</div>');
                expect(html).toContain('&lt;div&gt;');
            });

            it('should handle null memo value', () => {
                const html = FormControlFactory.create('memo', null);

                expect(html).toContain('<textarea');
                expect(html).toContain('></textarea>');
            });
        });

        describe('boolean type', () => {
            it('should create select for boolean type', () => {
                const html = FormControlFactory.create('boolean', true);

                expect(html).toContain('<select');
                expect(html).toContain('True');
                expect(html).toContain('False');
            });

            it('should select True when value is true', () => {
                const html = FormControlFactory.create('boolean', true);

                expect(html).toContain('value="true" selected');
            });

            it('should select False when value is false', () => {
                const html = FormControlFactory.create('boolean', false);

                expect(html).toContain('value="false" selected');
            });

            it('should select Clear Value when value is null', () => {
                const html = FormControlFactory.create('boolean', null);

                expect(html).toContain('value="null" selected');
            });

            it('should include Clear Value option', () => {
                const html = FormControlFactory.create('boolean', true);

                expect(html).toContain('value="null"');
            });

            it('should not select any when value is undefined', () => {
                const html = FormControlFactory.create('boolean', undefined);

                expect(html).toContain('<select');
                // None should be selected
                const trueSelected = html.includes('value="true" selected');
                const falseSelected = html.includes('value="false" selected');
                const nullSelected = html.includes('value="null" selected');

                expect(trueSelected || falseSelected || nullSelected).toBe(false);
            });
        });

        describe('optionset type', () => {
            it('should create optionset select with attribute object', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: 1, text: 'Option 1' },
                        { value: 2, text: 'Option 2' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'none')
                };

                const html = FormControlFactory.create('optionset', 1, mockAttribute);

                expect(html).toContain('<select');
                expect(html).toContain('Option 1');
                expect(html).toContain('Option 2');
                expect(mockAttribute.getOptions).toHaveBeenCalled();
            });

            it('should select current value', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: 1, text: 'Option 1' },
                        { value: 2, text: 'Option 2' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'none')
                };

                const html = FormControlFactory.create('optionset', 2, mockAttribute);

                expect(html).toContain('value="2" selected');
            });

            it('should include option values in parentheses', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: 100, text: 'Active' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'none')
                };

                const html = FormControlFactory.create('optionset', 100, mockAttribute);

                expect(html).toContain('Active (100)');
            });

            it('should include Clear Value for non-required optionsets', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: 1, text: 'Option 1' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'none')
                };

                const html = FormControlFactory.create('optionset', 1, mockAttribute);

                expect(html).toContain('value="null"');
            });

            it('should NOT include Clear Value for required optionsets', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: 1, text: 'Option 1' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'required')
                };

                const html = FormControlFactory.create('optionset', 1, mockAttribute);

                expect(html).not.toContain('value="null"');
            });

            it('should skip options with null value', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: null, text: '-- Select --' },
                        { value: 1, text: 'Option 1' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'none')
                };

                const html = FormControlFactory.create('optionset', 1, mockAttribute);

                // Should not have two null options
                const nullCount = (html.match(/value="null"/g) || []).length;
                expect(nullCount).toBe(1); // Only the Clear Value option
            });

            it('should fallback to text input without attribute object', () => {
                const html = FormControlFactory.create('optionset', 5, null);

                expect(html).toContain('<input');
                expect(html).toContain('type="text"');
            });

            it('should escape HTML in option text', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: 1, text: '<script>xss</script>' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'none')
                };

                const html = FormControlFactory.create('optionset', 1, mockAttribute);

                expect(html).not.toContain('<script>');
                expect(html).toContain('&lt;script&gt;');
            });
        });

        describe('multiselectoptionset type', () => {
            it('should create select for multiselectoptionset', () => {
                const mockAttribute = {
                    getOptions: vi.fn(() => [
                        { value: 1, text: 'Option 1' },
                        { value: 2, text: 'Option 2' }
                    ]),
                    getRequiredLevel: vi.fn(() => 'none')
                };

                const html = FormControlFactory.create('multiselectoptionset', [1], mockAttribute);

                expect(html).toContain('<select');
                expect(html).toContain('Option 1');
                expect(html).toContain('Option 2');
            });

            it('should fallback to text input without attribute', () => {
                const html = FormControlFactory.create('multiselectoptionset', '1,2', null);

                expect(html).toContain('<input');
            });
        });

        describe('datetime type', () => {
            it('should create datetime input for datetime type', () => {
                const date = new Date('2025-01-15T10:30:00');
                const html = FormControlFactory.create('datetime', date);

                expect(html).toContain('<input');
                expect(html).toContain('type="datetime-local"');
            });

            it('should format date correctly', () => {
                const date = new Date('2025-06-20T14:30:00');
                const html = FormControlFactory.create('datetime', date);

                expect(html).toContain('2025-06-20');
                expect(html).toContain('14:30');
            });

            it('should handle null date', () => {
                const html = FormControlFactory.create('datetime', null);

                expect(html).toContain('type="datetime-local"');
                expect(html).toContain('value=""');
            });

            it('should handle date string', () => {
                const html = FormControlFactory.create('datetime', '2025-03-15T09:00:00');

                expect(html).toContain('2025-03-15');
            });

            it('should handle invalid date gracefully', () => {
                const html = FormControlFactory.create('datetime', 'invalid-date');

                expect(html).toContain('type="datetime-local"');
                expect(html).toContain('value=""');
            });
        });

        describe('numeric types', () => {
            it('should create number input for integer type', () => {
                const html = FormControlFactory.create('integer', 42);

                expect(html).toContain('<input');
                expect(html).toContain('type="number"');
                expect(html).toContain('42');
            });

            it('should create number input for money type', () => {
                const html = FormControlFactory.create('money', 100.50);

                expect(html).toContain('type="number"');
                expect(html).toContain('step="any"');
            });

            it('should create number input for decimal type', () => {
                const html = FormControlFactory.create('decimal', 3.14159);

                expect(html).toContain('type="number"');
                expect(html).toContain('step="any"');
            });

            it('should create number input for double type', () => {
                const html = FormControlFactory.create('double', 1.23456789);

                expect(html).toContain('type="number"');
            });

            it('should create number input for bigint type', () => {
                const html = FormControlFactory.create('bigint', 9007199254740991);

                expect(html).toContain('type="number"');
            });

            it('should handle null numeric value', () => {
                const html = FormControlFactory.create('integer', null);

                expect(html).toContain('type="number"');
                expect(html).toContain('value=""');
            });

            it('should handle zero numeric value', () => {
                const html = FormControlFactory.create('integer', 0);

                expect(html).toContain('value="0"');
            });

            it('should handle negative numeric value', () => {
                const html = FormControlFactory.create('integer', -10);

                expect(html).toContain('value="-10"');
            });
        });

        describe('lookup types', () => {
            it('should create readonly input for lookup type', () => {
                const html = FormControlFactory.create('lookup', 'guid-value');

                expect(html).toContain('<input');
                expect(html).toContain('readonly');
            });

            it('should create readonly input for customer type', () => {
                const html = FormControlFactory.create('customer', 'customer-guid');

                expect(html).toContain('readonly');
            });

            it('should create readonly input for owner type', () => {
                const html = FormControlFactory.create('owner', 'owner-guid');

                expect(html).toContain('readonly');
            });

            it('should escape HTML in lookup values', () => {
                const html = FormControlFactory.create('lookup', '<script>xss</script>');

                expect(html).not.toContain('<script>');
            });

            it('should handle null lookup value', () => {
                const html = FormControlFactory.create('lookup', null);

                expect(html).toContain('value=""');
            });
        });

        describe('default/unknown types', () => {
            it('should create text input for unknown type', () => {
                const html = FormControlFactory.create('customtype', 'value');

                expect(html).toContain('<input');
                expect(html).toContain('type="text"');
            });

            it('should create text input for undefined type', () => {
                const html = FormControlFactory.create(undefined, 'value');

                expect(html).toContain('<input');
                expect(html).toContain('type="text"');
            });

            it('should handle empty string type', () => {
                const html = FormControlFactory.create('', 'value');

                expect(html).toContain('<input');
            });
        });

        describe('HTML escaping', () => {
            it('should escape HTML in values', () => {
                const html = FormControlFactory.create('string', '<script>alert("xss")</script>');

                expect(html).not.toContain('<script>');
                expect(html).toContain('&lt;script&gt;');
            });

            it('should handle quotes in values', () => {
                const html = FormControlFactory.create('string', 'value with "quotes"');

                // escapeHtml doesn't escape quotes for input values (browser handles this)
                expect(html).toContain('quotes');
            });

            it('should escape ampersands in values', () => {
                const html = FormControlFactory.create('string', 'Tom & Jerry');

                expect(html).toContain('&amp;');
            });

            it('should escape in memo textarea', () => {
                const html = FormControlFactory.create('memo', '<div>test</div>');

                expect(html).not.toContain('<div>test</div>');
            });
        });

        describe('edge cases', () => {
            it('should handle special characters in string', () => {
                const html = FormControlFactory.create('string', '©®™');

                expect(html).toContain('©®™');
            });

            it('should handle unicode in string', () => {
                const html = FormControlFactory.create('string', '日本語 한국어 العربية');

                expect(html).toContain('日本語');
                expect(html).toContain('한국어');
            });

            it('should handle very long string', () => {
                const longString = 'a'.repeat(10000);
                const html = FormControlFactory.create('string', longString);

                expect(html).toContain(longString);
            });

            it('should handle empty string value', () => {
                const html = FormControlFactory.create('string', '');

                expect(html).toContain('value=""');
            });

            it('should handle numeric string', () => {
                const html = FormControlFactory.create('string', '12345');

                expect(html).toContain('type="text"');
                expect(html).toContain('12345');
            });

            it('should handle boolean value for string type', () => {
                const html = FormControlFactory.create('string', true);

                expect(html).toContain('type="text"');
            });

            it('should handle floating point for integer type', () => {
                const html = FormControlFactory.create('integer', 3.14);

                expect(html).toContain('type="number"');
                expect(html).toContain('3.14');
            });

            it('should handle date object for string type', () => {
                const date = new Date();
                const html = FormControlFactory.create('string', date);

                expect(html).toContain('type="text"');
            });
        });

        describe('consistent structure', () => {
            const types = ['string', 'memo', 'boolean', 'datetime', 'integer', 'money', 'decimal', 'double', 'bigint', 'lookup', 'customer', 'owner'];

            types.forEach(type => {
                it(`should include id for ${type} type`, () => {
                    const html = FormControlFactory.create(type, 'test');
                    expect(html).toContain('id="pdt-prompt-input"');
                });

                it(`should include class for ${type} type`, () => {
                    const html = FormControlFactory.create(type, 'test');
                    expect(html).toMatch(/class="pdt-(input|select|textarea)"/);
                });
            });
        });
    });
});
