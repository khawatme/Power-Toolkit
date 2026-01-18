/**
 * @file Tests for FileUploadService
 * @module tests/services/FileUploadService.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileUploadService } from '../../src/services/FileUploadService.js';

// Mock NotificationService
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn(),
        error: vi.fn()
    }
}));

// Mock globalThis.Xrm
global.Xrm = {
    WebApi: {
        online: {
            execute: vi.fn()
        }
    },
    Utility: {
        getGlobalContext: vi.fn(() => ({
            getClientUrl: vi.fn(() => 'https://test.crm.dynamics.com')
        }))
    }
};

describe('FileUploadService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock globalContext
        global.window = {
            atob: vi.fn((str) => Buffer.from(str, 'base64').toString('binary')),
            btoa: vi.fn((str) => Buffer.from(str, 'binary').toString('base64')),
            Xrm: {
                Utility: {
                    getGlobalContext: vi.fn(() => ({
                        getClientUrl: vi.fn(() => 'https://test.crm.dynamics.com')
                    }))
                }
            }
        };

        // Mock fetch
        global.fetch = vi.fn();
    });

    describe('uploadFile', () => {
        it('should upload file successfully', async () => {
            // Mock successful responses
            global.fetch = vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ FileContinuationToken: 'token-123' }))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve('')
                })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ FileId: 'file-123', FileSizeInBytes: 1024 }))
                });

            const result = await FileUploadService.uploadFile(
                'account',
                'acc-123',
                'new_file',
                'YmFzZTY0ZGF0YQ==',
                'test.txt',
                'text/plain'
            );

            expect(result).toBeDefined();
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should handle upload errors', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('Upload failed')
            });

            await expect(
                FileUploadService.uploadFile('account', 'acc-123', 'new_file', 'data', 'test.txt', 'text/plain')
            ).rejects.toThrow();
        });

        it('should use default mime type when not provided', async () => {
            global.fetch = vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ FileContinuationToken: 'token-123' }))
                })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve('')
                })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ FileId: 'file-123', FileSizeInBytes: 512 }))
                });

            await FileUploadService.uploadFile(
                'account',
                'acc-123',
                'new_file',
                'dGVzdA==',
                'test.txt',
                null // no mime type
            );

            const commitCall = global.fetch.mock.calls[2];
            const commitBody = JSON.parse(commitCall[1].body);
            expect(commitBody.MimeType).toBe('application/octet-stream');
        });

        it('should log error and rethrow on upload failure', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            global.fetch.mockRejectedValue(new Error('Network error'));

            await expect(
                FileUploadService.uploadFile('account', 'acc-123', 'new_file', 'dGVzdA==', 'test.txt', 'text/plain')
            ).rejects.toThrow('Network error');

            expect(consoleSpy).toHaveBeenCalledWith('[FileUploadService] Upload failed:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('_callAction', () => {
        it('should call Dataverse action successfully', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ result: 'success' }))
            });

            const result = await FileUploadService._callAction('TestAction', { param: 'value' });

            expect(result).toEqual({ result: 'success' });
            expect(global.fetch).toHaveBeenCalledWith(
                'https://test.crm.dynamics.com/api/data/v9.2/TestAction',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ param: 'value' })
                })
            );
        });

        it('should return empty object when response has no body', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('')
            });

            const result = await FileUploadService._callAction('TestAction', {});

            expect(result).toEqual({});
        });

        it('should throw error when globalContext is not available', async () => {
            global.window.Xrm = null;
            global.window.parent = { Xrm: null };

            await expect(
                FileUploadService._callAction('TestAction', {})
            ).rejects.toThrow('Unable to get global context');
        });

        it('should use parent window Xrm when main window Xrm is unavailable', async () => {
            global.window.Xrm = null;
            global.window.parent = {
                Xrm: {
                    Utility: {
                        getGlobalContext: vi.fn(() => ({
                            getClientUrl: vi.fn(() => 'https://parent.crm.dynamics.com')
                        }))
                    }
                }
            };

            global.fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('{}')
            });

            await FileUploadService._callAction('TestAction', {});

            expect(global.fetch).toHaveBeenCalledWith(
                'https://parent.crm.dynamics.com/api/data/v9.2/TestAction',
                expect.any(Object)
            );
        });

        it('should throw error when action fails with error response', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('Bad Request: Invalid parameters')
            });

            await expect(
                FileUploadService._callAction('TestAction', {})
            ).rejects.toThrow('Action TestAction failed: Bad Request: Invalid parameters');
        });
    });

    describe('_uploadBlocks', () => {
        it('should upload file in single block when smaller than block size', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('')
            });

            const smallData = window.btoa('small file content');
            const blockIds = await FileUploadService._uploadBlocks(smallData, 'token-123');

            expect(blockIds.length).toBe(1);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should handle block upload failure and show notification', async () => {
            const { NotificationService } = await import('../../src/services/NotificationService.js');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            global.fetch.mockRejectedValue(new Error('Block upload failed'));

            const smallData = window.btoa('test data');

            await expect(
                FileUploadService._uploadBlocks(smallData, 'token-123')
            ).rejects.toThrow(/File upload failed at block \d+: Block upload failed/);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('File upload failed at block'),
                'error'
            );
            expect(consoleSpy).toHaveBeenCalledWith('[FileUploadService] Block upload failed:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('_base64ToUint8Array', () => {
        it('should convert base64 to Uint8Array correctly', () => {
            const base64 = window.btoa('Hello World');
            const result = FileUploadService._base64ToUint8Array(base64);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(11);
            expect(String.fromCharCode(...result)).toBe('Hello World');
        });

        it('should handle empty string', () => {
            const base64 = window.btoa('');
            const result = FileUploadService._base64ToUint8Array(base64);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(0);
        });

        it('should handle binary data correctly', () => {
            const binaryString = String.fromCharCode(0, 128, 255);
            const base64 = window.btoa(binaryString);
            const result = FileUploadService._base64ToUint8Array(base64);

            expect(result[0]).toBe(0);
            expect(result[1]).toBe(128);
            expect(result[2]).toBe(255);
        });
    });

    describe('_uint8ArrayToBase64', () => {
        it('should convert Uint8Array to base64 correctly', () => {
            const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
            const result = FileUploadService._uint8ArrayToBase64(bytes);

            expect(result).toBe(window.btoa('Hello'));
        });

        it('should handle empty array', () => {
            const bytes = new Uint8Array([]);
            const result = FileUploadService._uint8ArrayToBase64(bytes);

            expect(result).toBe(window.btoa(''));
        });

        it('should handle large arrays in chunks', () => {
            // Create array larger than 8192 chunk size
            const size = 10000;
            const bytes = new Uint8Array(size);
            for (let i = 0; i < size; i++) {
                bytes[i] = i % 256;
            }

            const result = FileUploadService._uint8ArrayToBase64(bytes);

            // Verify round-trip
            const decoded = FileUploadService._base64ToUint8Array(result);
            expect(decoded.length).toBe(size);
            expect(decoded[0]).toBe(0);
            expect(decoded[255]).toBe(255);
            expect(decoded[256]).toBe(0);
        });
    });

    describe('_stringToUint8Array', () => {
        it('should convert string to Uint8Array correctly', () => {
            const result = FileUploadService._stringToUint8Array('ABC');

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(3);
            expect(result[0]).toBe(65); // 'A'
            expect(result[1]).toBe(66); // 'B'
            expect(result[2]).toBe(67); // 'C'
        });

        it('should handle empty string', () => {
            const result = FileUploadService._stringToUint8Array('');

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(0);
        });

        it('should mask characters to 0xFF', () => {
            // Character with code > 255
            const str = String.fromCharCode(256, 257, 512);
            const result = FileUploadService._stringToUint8Array(str);

            expect(result[0]).toBe(0);   // 256 & 0xFF = 0
            expect(result[1]).toBe(1);   // 257 & 0xFF = 1
            expect(result[2]).toBe(0);   // 512 & 0xFF = 0
        });
    });

    describe('_generateGuid', () => {
        it('should generate valid GUID format', () => {
            const guid = FileUploadService._generateGuid();

            // GUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
            expect(guid).toMatch(guidRegex);
        });

        it('should generate unique GUIDs', () => {
            const guid1 = FileUploadService._generateGuid();
            const guid2 = FileUploadService._generateGuid();
            const guid3 = FileUploadService._generateGuid();

            expect(guid1).not.toBe(guid2);
            expect(guid2).not.toBe(guid3);
            expect(guid1).not.toBe(guid3);
        });

        it('should always have 4 as version number', () => {
            for (let i = 0; i < 10; i++) {
                const guid = FileUploadService._generateGuid();
                expect(guid.charAt(14)).toBe('4');
            }
        });

        it('should have valid variant bits (8, 9, a, or b)', () => {
            for (let i = 0; i < 10; i++) {
                const guid = FileUploadService._generateGuid();
                expect(['8', '9', 'a', 'b']).toContain(guid.charAt(19));
            }
        });
    });

    describe('_formatFileSize', () => {
        it('should format 0 bytes correctly', () => {
            const result = FileUploadService._formatFileSize(0);
            expect(result).toBe('0 Bytes');
        });

        it('should format bytes correctly', () => {
            const result = FileUploadService._formatFileSize(500);
            expect(result).toBe('500 Bytes');
        });

        it('should format kilobytes correctly', () => {
            const result = FileUploadService._formatFileSize(1024);
            expect(result).toBe('1 KB');
        });

        it('should format megabytes correctly', () => {
            const result = FileUploadService._formatFileSize(1024 * 1024);
            expect(result).toBe('1 MB');
        });

        it('should format gigabytes correctly', () => {
            const result = FileUploadService._formatFileSize(1024 * 1024 * 1024);
            expect(result).toBe('1 GB');
        });

        it('should round to 2 decimal places', () => {
            const result = FileUploadService._formatFileSize(1536); // 1.5 KB
            expect(result).toBe('1.5 KB');
        });

        it('should handle fractional values', () => {
            const result = FileUploadService._formatFileSize(2560); // 2.5 KB
            expect(result).toBe('2.5 KB');
        });
    });
});
