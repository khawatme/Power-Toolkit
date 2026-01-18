/**
 * @file ErrorParser
 * @description Extract a human-readable error message from a variety of Web API error shapes
 * (Dataverse/OData v4, legacy OData, fetch/axios/XHR, Xrm.WebApi, raw JSON or plain text).
 * @module utils/parsers/ErrorParser
 */

/**
 * Helper functions for error parsing
 * @private
 */
const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;

const tryParseJson = (raw) => {
    if (raw === null || raw === undefined || typeof raw !== 'string') {
        return raw;
    }
    const t = raw.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) {
        return raw;
    }
    try {
        return JSON.parse(t);
    } catch {
        return raw;
    }
};

const firstString = (...vals) => vals.find(isNonEmptyStr) || null;

const get = (obj, pathArr) => {
    try {
        return pathArr.reduce((acc, k) => ((acc === null || acc === undefined) ? acc : acc[k]), obj);
    } catch {
        return undefined;
    }
};

/**
 * Extract status code from error
 * @private
 */
const extractStatus = (e) => {
    return e?.status ??
        e?.response?.status ??
        e?.httpStatus ??
        e?.statusCode ??
        null;
};

/**
 * Build payloads array from error
 * @private
 */
const buildPayloads = (e) => {
    return [
        tryParseJson(e?.response?.data),
        tryParseJson(e?.data),
        tryParseJson(e?.body),
        tryParseJson(e?.responseText),
        e?.error,
        e?.detail,
        e?.originalError,
        tryParseJson(typeof e === 'string' ? e : null),
        e
    ].filter((v) => (v !== null && v !== undefined));
};

/**
 * Extract correlation ID from headers
 * @private
 */
const extractCorrelationId = (e) => {
    const headers = e?.response?.headers || e?.headers || null;

    const getHeader = (name) => {
        if (!headers) {
            return null;
        }
        if (typeof headers.get === 'function') {
            try {
                return headers.get(name);
            } catch {
                return null;
            }
        }
        const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
    };

    return getHeader('x-ms-correlation-request-id') ||
        getHeader('x-ms-request-id') ||
        getHeader('request-id') ||
        get(e, ['error', 'x-ms-correlation-request-id']) ||
        get(e, ['response', 'data', 'x-ms-correlation-request-id']) ||
        null;
};

/**
 * Extract OData v4 error message
 * @private
 */
const extractODataV4Message = (p) => {
    return firstString(
        get(p, ['error', 'innererror', 'internalexception', 'message']),
        get(p, ['error', 'innererror', 'message']),
        Array.isArray(get(p, ['error', 'details'])) ? get(p, ['error', 'details', 0, 'message']) : null,
        get(p, ['error', 'message'])
    );
};

/**
 * Extract legacy OData error message
 * @private
 */
const extractLegacyODataMessage = (p) => {
    return firstString(
        get(p, ['odata.error', 'message', 'value']),
        get(p, ['odata.error', 'innererror', 'message'])
    );
};

/**
 * Extract top-level error message
 * @private
 */
const extractTopLevelMessage = (p) => {
    return firstString(p.message, p.Message);
};

/**
 * Extract nested axios/fetch message
 * @private
 */
const extractNestedMessage = (p) => {
    return firstString(
        get(p, ['data', 'error', 'message']),
        get(p, ['data', 'message'])
    );
};

/**
 * Extract message from payload
 * @private
 */
const extractMessageFromPayload = (p) => {
    if (isNonEmptyStr(p)) {
        return p;
    }

    if (p && typeof p === 'object') {
        return extractODataV4Message(p) ||
            extractLegacyODataMessage(p) ||
            extractTopLevelMessage(p) ||
            extractNestedMessage(p);
    }

    return null;
};

/**
 * Find message in payloads
 * @private
 */
const findMessageInPayloads = (payloads) => {
    for (const p of payloads) {
        const msg = extractMessageFromPayload(p);
        if (isNonEmptyStr(msg)) {
            return msg;
        }
    }
    return null;
};

/**
 * Get fallback message from error
 * @private
 */
const getFallbackMessage = (e) => {
    return firstString(
        e?.message,
        e?.statusText,
        e?.response?.statusText
    );
};

/**
 * Get last resort JSON message
 * @private
 */
const getLastResortMessage = (payloads) => {
    const firstObject = payloads.find(v => v && typeof v === 'object') || null;
    if (firstObject) {
        try {
            const s = JSON.stringify(firstObject);
            return s.length > 900 ? `${s.slice(0, 900)}…` : s;
        } catch {
            return null;
        }
    }
    return null;
};

/**
 * Extract raw body from error
 * @private
 */
const extractRawBody = (e) => {
    return (typeof e?.response?.data === 'string' ? e.response.data : null) ??
        (typeof e?.data === 'string' ? e.data : null) ??
        (typeof e?.body === 'string' ? e.body : null) ??
        null;
};

/**
 * Build final error message
 * @private
 */
const buildFinalMessage = (message, status, rawBody, correlationId) => {
    let result = message;

    if (status) {
        result = `(Status ${status}) ${result}`;
    }

    if (isNonEmptyStr(rawBody) && !result.includes(rawBody)) {
        result += ` — ${rawBody}`;
    }

    if (correlationId) {
        result += ` [CorrelationId: ${correlationId}]`;
    }

    return result.replace(/\s+/g, ' ').trim();
};

export const ErrorParser = {
    /**
     * Extract a concise, helpful error string from many possible error shapes.
     * @param {any} e - The error object
     * @returns {string} Formatted error message
     */
    extract(e) {
        const status = extractStatus(e);
        const payloads = buildPayloads(e);
        const correlationId = extractCorrelationId(e);

        // Try to extract message from payloads
        let message = findMessageInPayloads(payloads);

        // Fallback to outer error text
        if (!isNonEmptyStr(message)) {
            message = getFallbackMessage(e);
        }

        // Last resort: show JSON
        if (!isNonEmptyStr(message)) {
            message = getLastResortMessage(payloads);
        }

        // Absolute fallback
        if (!isNonEmptyStr(message)) {
            message = 'Request failed.';
        }

        // Extract raw body for additional context
        const rawBody = extractRawBody(e);

        // Build and return final message
        return buildFinalMessage(message, status, rawBody, correlationId);
    }
};

