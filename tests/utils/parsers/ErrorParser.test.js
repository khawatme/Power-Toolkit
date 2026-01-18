/**
 * @file Tests for ErrorParser utility
 * @module tests/utils/parsers/ErrorParser
 */

import { describe, it, expect } from 'vitest';
import { ErrorParser } from '../../../src/utils/parsers/ErrorParser.js';

describe('ErrorParser', () => {
    describe('extract', () => {
        it('should extract message from simple string error', () => {
            const result = ErrorParser.extract('Simple error message');
            expect(result).toContain('Simple error message');
        });

        it('should extract message from axios error response', () => {
            const error = {
                response: {
                    status: 400,
                    data: {
                        error: {
                            message: 'Bad request error'
                        }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Bad request error');
            expect(result).toContain('400');
        });

        it('should extract message from OData error format', () => {
            const error = {
                status: 500,
                response: {
                    data: {
                        'error': {
                            'code': '0x80040265',
                            'message': 'The user does not have the necessary permissions'
                        }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('permissions');
        });

        it('should extract correlation ID when available', () => {
            const error = {
                status: 400,
                response: {
                    headers: {
                        'x-ms-correlation-request-id': '12345-abcde-67890'
                    },
                    data: {
                        error: {
                            message: 'Error with correlation'
                        }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('12345-abcde-67890');
        });

        it('should handle JSON string in responseText', () => {
            const error = {
                responseText: JSON.stringify({
                    error: {
                        message: 'JSON error message'
                    }
                })
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('JSON error message');
        });

        it('should handle errors with nested error objects', () => {
            const error = {
                error: {
                    originalError: {
                        message: 'Nested error message'
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Nested error message');
        });

        it('should handle Dataverse innererror structure', () => {
            const error = {
                status: 400,
                response: {
                    data: {
                        error: {
                            message: 'Outer message',
                            innererror: {
                                message: 'Inner detailed message'
                            }
                        }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Inner detailed message');
        });

        it('should handle errors without status code', () => {
            const error = {
                message: 'Network error'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Network error');
        });

        it('should handle null and undefined errors gracefully', () => {
            expect(() => ErrorParser.extract(null)).not.toThrow();
            expect(() => ErrorParser.extract(undefined)).not.toThrow();
            expect(ErrorParser.extract(null)).toBeTruthy();
        });

        it('should extract from error detail property', () => {
            const error = {
                detail: 'Detailed error information'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Detailed error information');
        });

        it('should handle fetch API error format', () => {
            const error = {
                body: JSON.stringify({
                    error: {
                        message: 'Fetch API error'
                    }
                })
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Fetch API error');
        });

        it('should extract status code from various locations', () => {
            const error1 = { httpStatus: 404 };
            expect(ErrorParser.extract(error1)).toContain('404');

            const error2 = { statusCode: 500 };
            expect(ErrorParser.extract(error2)).toContain('500');
        });

        it('should handle plain text error responses', () => {
            const error = {
                responseText: 'Plain text error without JSON'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Plain text error');
        });

        it('should prioritize more specific error messages', () => {
            const error = {
                response: {
                    data: {
                        error: {
                            message: 'Specific error',
                            innererror: {
                                message: 'Very specific error'
                            }
                        }
                    }
                },
                message: 'Generic error'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Very specific error');
        });

        it('should handle errors with Headers object', () => {
            const headers = new Map();
            headers.set('x-ms-correlation-request-id', 'test-correlation-id');

            const error = {
                headers,
                response: {
                    data: {
                        error: {
                            message: 'Error with Headers'
                        }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Error with Headers');
        });

        it('should handle empty error objects', () => {
            const result = ErrorParser.extract({});
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        // NEW TESTS TO REACH 100% COVERAGE

        it('should handle malformed JSON strings that fail to parse (line 37)', () => {
            const error = {
                responseText: '{invalid json that starts with brace but fails parsing'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('invalid json');
        });

        it('should handle get helper when path reduction throws (line 47)', () => {
            const error = {
                response: {
                    data: {
                        error: {
                            get innererror() {
                                throw new Error('Getter throws');
                            }
                        }
                    }
                },
                message: 'Fallback message'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Fallback message');
        });

        it('should extract message from legacy OData v2/v3 format (line 126)', () => {
            const error = {
                status: 400,
                'odata.error': {
                    message: {
                        value: 'Legacy OData error message'
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Legacy OData error message');
        });

        it('should extract message from legacy OData innererror', () => {
            const error = {
                'odata.error': {
                    innererror: {
                        message: 'Legacy innererror message'
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Legacy innererror message');
        });

        it('should truncate very long JSON objects to 900 chars (line 148)', () => {
            // Create an error with only numeric arrays so no string message is extracted
            // and the JSON serialization exceeds 900 characters
            const largeData = {};
            for (let i = 0; i < 200; i++) {
                largeData[`longFieldName${i}WithExtraChars`] = [i, i + 1, i + 2, i + 3, i + 4];
            }
            const error = largeData;
            const result = ErrorParser.extract(error);
            expect(result).toContain('…');
        });

        it('should use full JSON when object serializes to less than 900 chars', () => {
            // Object with only numeric values that serializes to less than 900 chars
            const smallData = { code: 123, value: 456 };
            const result = ErrorParser.extract(smallData);
            expect(result).not.toContain('…');
            expect(result).toContain('123');
            expect(result).toContain('456');
        });

        it('should handle circular references in error objects gracefully', () => {
            const circularError = { id: 1 };
            circularError.self = circularError; // Creates circular reference
            const result = ErrorParser.extract(circularError);
            // Should return default message since JSON.stringify will throw
            expect(result).toBe('Request failed.');
        });

        it('should handle Headers with get function that throws', () => {
            const headers = {
                get: () => { throw new Error('Header access failed'); }
            };
            const error = {
                headers,
                message: 'Error with broken headers'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Error with broken headers');
        });

        it('should extract correlation ID from x-ms-request-id header', () => {
            const headers = new Map();
            headers.set('x-ms-request-id', 'request-id-12345');

            const error = {
                response: {
                    headers,
                    data: {
                        error: { message: 'Error with request-id' }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('request-id-12345');
        });

        it('should extract correlation ID from request-id header', () => {
            const headers = new Map();
            headers.set('request-id', 'simple-request-id');

            const error = {
                response: {
                    headers,
                    data: { error: { message: 'Error message' } }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('simple-request-id');
        });

        it('should extract correlation ID from nested error object', () => {
            const error = {
                error: {
                    'x-ms-correlation-request-id': 'nested-correlation-id',
                    message: 'Nested error'
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('nested-correlation-id');
        });

        it('should extract correlation ID from response.data', () => {
            const error = {
                response: {
                    data: {
                        'x-ms-correlation-request-id': 'response-data-correlation',
                        error: { message: 'Error in response data' }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('response-data-correlation');
        });

        it('should handle error.data directly for axios responses', () => {
            const error = {
                data: {
                    error: {
                        message: 'Direct data error message'
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Direct data error message');
        });

        it('should handle OData error with details array', () => {
            const error = {
                status: 400,
                response: {
                    data: {
                        error: {
                            message: 'General error',
                            details: [
                                { message: 'First detail message' },
                                { message: 'Second detail message' }
                            ]
                        }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('First detail message');
        });

        it('should extract message from internalexception in innererror', () => {
            const error = {
                response: {
                    data: {
                        error: {
                            innererror: {
                                internalexception: {
                                    message: 'Deep internal exception message'
                                }
                            }
                        }
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Deep internal exception message');
        });

        it('should fall back to statusText when no message found', () => {
            const error = {
                statusText: 'Not Found',
                status: 404
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Not Found');
            expect(result).toContain('404');
        });

        it('should fall back to response.statusText', () => {
            const error = {
                response: {
                    statusText: 'Internal Server Error',
                    status: 500
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Internal Server Error');
        });

        it('should append raw string body if different from message', () => {
            const error = {
                status: 500,
                response: {
                    data: {
                        error: { message: 'Main error from OData' }
                    }
                },
                data: 'Additional raw context'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Main error from OData');
            expect(result).toContain('Additional raw context');
        });

        it('should handle originalError property', () => {
            const error = {
                originalError: {
                    message: 'Original error message'
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Original error message');
        });

        it('should handle Message property with capital M', () => {
            const error = {
                Message: 'Capital M message'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Capital M message');
        });

        it('should return default message when error has no useful info', () => {
            const error = {
                someRandomProp: 123,
                anotherProp: true
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('someRandomProp');
        });

        it('should handle JSON array string in response', () => {
            const error = {
                responseText: '[{"error": "Array error message"}]'
            };
            const result = ErrorParser.extract(error);
            expect(result).toBeTruthy();
        });

        it('should normalize whitespace in final message', () => {
            const error = {
                message: 'Error   with   multiple   spaces\n\tand tabs'
            };
            const result = ErrorParser.extract(error);
            expect(result).not.toMatch(/\s{2,}/);
        });

        it('should handle headers as plain object with case-insensitive lookup', () => {
            const error = {
                headers: {
                    'X-MS-CORRELATION-REQUEST-ID': 'case-insensitive-id'
                },
                message: 'Error with header object'
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('case-insensitive-id');
        });

        it('should extract from nested axios data.message', () => {
            const error = {
                data: {
                    message: 'Nested data message'
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Nested data message');
        });

        it('should extract from nested axios data.error.message', () => {
            const error = {
                data: {
                    error: {
                        message: 'Nested data error message'
                    }
                }
            };
            const result = ErrorParser.extract(error);
            expect(result).toContain('Nested data error message');
        });
    });
});
