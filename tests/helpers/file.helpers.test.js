/**
 * @file Comprehensive Tests for file helpers
 * @module tests/helpers/file.helpers
 * @description Tests for clipboard, download, and file reading utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileHelpers } from '../../src/helpers/file.helpers.js';

// Mock NotificationService
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn(),
    }
}));

// Import mocked service
import { NotificationService } from '../../src/services/NotificationService.js';

// Store original globals
const OriginalBlob = global.Blob;
const OriginalFileReader = global.FileReader;

describe('FileHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';

        // Mock URL.createObjectURL and revokeObjectURL
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();

        // Restore original globals before each test
        global.Blob = OriginalBlob;
        global.FileReader = OriginalFileReader;
    });

    afterEach(() => {
        // Restore original globals after each test
        global.Blob = OriginalBlob;
        global.FileReader = OriginalFileReader;
    });

    describe('copyToClipboard', () => {
        it('should copy text using Clipboard API when available', async () => {
            const writeTextMock = vi.fn(() => Promise.resolve());
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(window, 'isSecureContext', {
                value: true,
                writable: true,
                configurable: true,
            });

            await FileHelpers.copyToClipboard('test text', 'Copied!');

            expect(writeTextMock).toHaveBeenCalledWith('test text');
            expect(NotificationService.show).toHaveBeenCalledWith('Copied!', 'success');
        });

        it('should show success notification after copy', async () => {
            const writeTextMock = vi.fn(() => Promise.resolve());
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(window, 'isSecureContext', {
                value: true,
                writable: true,
                configurable: true,
            });

            await FileHelpers.copyToClipboard('hello', 'Success!');

            expect(NotificationService.show).toHaveBeenCalledWith('Success!', 'success');
        });

        it('should use fallback when Clipboard API not available', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                value: undefined,
                writable: true,
                configurable: true,
            });

            // Mock execCommand
            const execCommandMock = vi.fn(() => true);
            document.execCommand = execCommandMock;

            await FileHelpers.copyToClipboard('fallback text', 'Copied!');

            // Fallback creates a textarea
            expect(execCommandMock).toHaveBeenCalledWith('copy');
            expect(NotificationService.show).toHaveBeenCalledWith('Copied!', 'success');
        });

        it('should show error notification on failure', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: vi.fn(() => Promise.reject(new Error('Permission denied'))) },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(window, 'isSecureContext', {
                value: true,
                writable: true,
                configurable: true,
            });

            await FileHelpers.copyToClipboard('test', 'Copied!');

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'error'
            );
        });
    });

    describe('downloadJson', () => {
        it('should create and trigger download for JSON data', () => {
            const clickSpy = vi.fn();
            const originalCreateElement = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = originalCreateElement(tag);
                if (tag === 'a') {
                    el.click = clickSpy;
                }
                return el;
            });

            const data = { name: 'Test', value: 123 };
            FileHelpers.downloadJson(data, 'test.json');

            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
            expect(URL.revokeObjectURL).toHaveBeenCalled();

            vi.restoreAllMocks();
        });

        it('should stringify data with proper formatting', () => {
            const blobContent = [];
            class MockBlob {
                constructor(content, options) {
                    blobContent.push(...content);
                    this.content = content;
                    this.type = options?.type || 'application/json';
                    this.size = content[0]?.length || 0;
                }
            }
            global.Blob = MockBlob;

            const data = { key: 'value' };
            FileHelpers.downloadJson(data, 'test.json');

            expect(blobContent[0]).toBe(JSON.stringify(data, null, 2));
        });
    });

    describe('downloadCsv', () => {
        // Helper to capture blob content
        function createBlobCapture() {
            const blobContent = [];
            class MockBlob {
                constructor(content, options) {
                    blobContent.push(...content);
                    this.content = content;
                    this.type = options?.type || 'text/csv';
                    this.size = content[0]?.length || 0;
                }
            }
            return { blobContent, MockBlob };
        }

        it('should not download when data is empty', () => {
            FileHelpers.downloadCsv([], 'test.csv');
            expect(URL.createObjectURL).not.toHaveBeenCalled();
        });

        it('should not download when data is null', () => {
            FileHelpers.downloadCsv(null, 'test.csv');
            expect(URL.createObjectURL).not.toHaveBeenCalled();
        });

        it('should create CSV with headers from object keys', () => {
            const { blobContent, MockBlob } = createBlobCapture();
            global.Blob = MockBlob;

            const data = [
                { name: 'John', age: 30 },
                { name: 'Jane', age: 25 }
            ];
            FileHelpers.downloadCsv(data, 'test.csv');

            expect(blobContent[0]).toContain('name');
            expect(blobContent[0]).toContain('age');
        });

        it('should escape values containing delimiter', () => {
            const { blobContent, MockBlob } = createBlobCapture();
            global.Blob = MockBlob;

            const data = [{ name: 'Value,with,commas' }];
            FileHelpers.downloadCsv(data, 'test.csv', ',');

            expect(blobContent[0]).toContain('"Value,with,commas"');
        });

        it('should escape values containing quotes', () => {
            const { blobContent, MockBlob } = createBlobCapture();
            global.Blob = MockBlob;

            const data = [{ name: 'Value "with" quotes' }];
            FileHelpers.downloadCsv(data, 'test.csv');

            // Quotes should be doubled
            expect(blobContent[0]).toContain('""with""');
        });

        it('should handle null and undefined values', () => {
            const { blobContent, MockBlob } = createBlobCapture();
            global.Blob = MockBlob;

            const data = [{ name: null, age: undefined, city: 'NYC' }];
            FileHelpers.downloadCsv(data, 'test.csv');

            // Should have empty strings for null/undefined
            expect(blobContent[0]).toContain('NYC');
        });

        it('should stringify object values', () => {
            const { blobContent, MockBlob } = createBlobCapture();
            global.Blob = MockBlob;

            const data = [{ config: { nested: 'value' } }];
            FileHelpers.downloadCsv(data, 'test.csv');

            expect(blobContent[0]).toContain('nested');
        });

        it('should use default delimiter when invalid delimiter provided', () => {
            const { blobContent, MockBlob } = createBlobCapture();
            global.Blob = MockBlob;

            const data = [{ name: 'Test' }];
            // Invalid delimiter containing quote
            FileHelpers.downloadCsv(data, 'test.csv', '"');

            // Should use default delimiter (comma or semicolon based on config)
            expect(blobContent[0]).toBeDefined();
        });

        it('should trigger download with correct filename', () => {
            // Restore Blob so download actually works
            global.Blob = OriginalBlob;

            const clickSpy = vi.fn();
            const originalCreateElement = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = originalCreateElement(tag);
                if (tag === 'a') {
                    el.click = clickSpy;
                }
                return el;
            });

            const data = [{ name: 'Test' }];
            FileHelpers.downloadCsv(data, 'export.csv');

            expect(clickSpy).toHaveBeenCalled();

            vi.restoreAllMocks();
        });
    });

    describe('createFileInputElement', () => {
        it('should create a file input element', () => {
            const input = FileHelpers.createFileInputElement();

            expect(input).toBeDefined();
            expect(input.type).toBe('file');
        });

        it('should set accept attribute when provided', () => {
            const input = FileHelpers.createFileInputElement({ accept: '.json' });

            expect(input.accept).toBe('.json');
        });

        it('should set multiple attribute when provided', () => {
            const input = FileHelpers.createFileInputElement({ multiple: true });

            expect(input.multiple).toBe(true);
        });

        it('should set onChange handler when provided', () => {
            const onChange = vi.fn();
            const input = FileHelpers.createFileInputElement({ onChange });

            expect(input.onchange).toBe(onChange);
        });

        it('should work with no options', () => {
            const input = FileHelpers.createFileInputElement();

            expect(input.type).toBe('file');
            expect(input.multiple).toBe(false);
        });
    });

    describe('readJsonFile', () => {
        it('should reject when no file provided', async () => {
            await expect(FileHelpers.readJsonFile(null)).rejects.toThrow('No file provided');
        });

        it('should parse valid JSON file', async () => {
            const mockData = { test: 'value' };

            // Create a mock FileReader class
            class MockFileReader {
                constructor() {
                    this.onload = null;
                    this.onerror = null;
                    this.result = JSON.stringify(mockData);
                }
                readAsText() {
                    // Simulate async file reading
                    setTimeout(() => {
                        this.onload({ target: { result: this.result } });
                    }, 0);
                }
            }
            global.FileReader = MockFileReader;

            // Create a simple mock file object
            const mockFile = { name: 'test.json', type: 'application/json' };

            const result = await FileHelpers.readJsonFile(mockFile);

            expect(result).toEqual(mockData);
        });

        it('should reject on invalid JSON', async () => {
            // Create a mock FileReader class that returns invalid JSON
            class MockFileReader {
                constructor() {
                    this.onload = null;
                    this.onerror = null;
                    this.result = 'not valid json';
                }
                readAsText() {
                    setTimeout(() => {
                        this.onload({ target: { result: this.result } });
                    }, 0);
                }
            }
            global.FileReader = MockFileReader;

            // Create a simple mock file object
            const mockFile = { name: 'test.json', type: 'application/json' };

            await expect(FileHelpers.readJsonFile(mockFile)).rejects.toThrow('Invalid JSON');
        });

        it('should reject on read error', async () => {
            // Create a mock FileReader class that simulates error
            class MockFileReader {
                constructor() {
                    this.onload = null;
                    this.onerror = null;
                }
                readAsText() {
                    setTimeout(() => {
                        this.onerror();
                    }, 0);
                }
            }
            global.FileReader = MockFileReader;

            // Create a simple mock file object
            const mockFile = { name: 'test.json', type: 'application/json' };

            await expect(FileHelpers.readJsonFile(mockFile)).rejects.toThrow('Failed to read file');
        });
    });
});

// Also export the standalone function for compatibility
describe('copyToClipboard standalone', () => {
    it('should be importable as standalone function', async () => {
        const { copyToClipboard } = await import('../../src/helpers/index.js');
        expect(typeof copyToClipboard).toBe('function');
    });
});
