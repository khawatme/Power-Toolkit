/**
 * @file ErrorParser
 * @description Extract a human-readable error message from a variety of Web API error shapes
 * (Dataverse/OData v4, legacy OData, fetch/axios/XHR, Xrm.WebApi, raw JSON or plain text).
 * @module utils/parsers/ErrorParser
 */

export const ErrorParser = {
    /**
     * Extract a concise, helpful error string from many possible error shapes.
     * @param {any} e
     * @returns {string}
     */
    extract(e) {
        // status
        const status =
            e?.status ??
            e?.response?.status ??
            e?.httpStatus ??
            e?.statusCode ??
            null;

        // helpers
        const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;

        const tryParseJson = (raw) => {
            if (raw === null || raw === undefined || typeof raw !== 'string') {
                return raw;
            }
            const t = raw.trim();
            if (!(t.startsWith('{') || t.startsWith('['))) {
                return raw;
            } // plain text
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

        // Build a list of possible "payload" containers to probe
        const payloads = [
            // axios/fetch common locations
            tryParseJson(e?.response?.data),
            tryParseJson(e?.data),
            tryParseJson(e?.body),
            tryParseJson(e?.responseText),

            // vendor-ish spots
            e?.error,
            e?.detail,
            e?.originalError,

            // sometimes the thrown value itself is JSON or text
            tryParseJson(typeof e === 'string' ? e : null),

            // the whole error object
            e
        ].filter((v) => (v !== null && v !== undefined));

        // correlation id
        const headers = e?.response?.headers || e?.headers || null;
        const getHeader = (name) => {
            if (!headers) {
                return null;
            }
            if (typeof headers.get === 'function') {
                try {
                    return headers.get(name);
                } catch { /* ignore */ }
            }
            const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
            return key ? headers[key] : null;
        };

        const correlationId =
            getHeader?.('x-ms-correlation-request-id') ||
            getHeader?.('x-ms-request-id') ||
            getHeader?.('request-id') ||
            get(e, ['error', 'x-ms-correlation-request-id']) ||
            get(e, ['response', 'data', 'x-ms-correlation-request-id']) ||
            null;

        // probe for messages in order of likelihood
        let message = null;

        for (const p of payloads) {
            // If the payload is a plain string and looks useful, take it.
            if (isNonEmptyStr(p)) {
                message = p;
                break;
            }

            if (p && typeof p === 'object') {
                // OData v4 / Dataverse: { error: { message, innererror: { message }, details: [{message}] } }
                const odataV4 =
                    firstString(
                        get(p, ['error', 'innererror', 'internalexception', 'message']),
                        get(p, ['error', 'innererror', 'message']),
                        Array.isArray(get(p, ['error', 'details'])) ? get(p, ['error', 'details', 0, 'message']) : null,
                        get(p, ['error', 'message'])
                    );

                if (isNonEmptyStr(odataV4)) {
                    message = odataV4; break;
                }

                // Legacy OData v2/v3: { "odata.error": { "message": { "value": "..." }, innererror: {...} } }
                const legacy =
                    firstString(
                        get(p, ['odata.error', 'message', 'value']),
                        get(p, ['odata.error', 'innererror', 'message'])
                    );

                if (isNonEmptyStr(legacy)) {
                    message = legacy; break;
                }

                // Top-level Dataverse shape: { code, message }
                const topLevel =
                    firstString(
                        p.message,
                        p.Message
                    );

                if (isNonEmptyStr(topLevel)) {
                    message = topLevel; break;
                }

                // Nested common axios/fetch structures
                const nestedAxios =
                    firstString(
                        get(p, ['data', 'error', 'message']),
                        get(p, ['data', 'message'])
                    );

                if (isNonEmptyStr(nestedAxios)) {
                    message = nestedAxios; break;
                }
            }
        }

        // If still nothing, fall back to outer error text/statusText
        if (!isNonEmptyStr(message)) {
            message = firstString(
                e?.message,
                e?.statusText,
                e?.response?.statusText
            );
        }

        // As an absolute last resort, surface compact JSON so the user sees something
        if (!isNonEmptyStr(message)) {
            const firstObject = payloads.find(v => v && typeof v === 'object') || null;
            if (firstObject) {
                try {
                    const s = JSON.stringify(firstObject);
                    message = s.length > 900 ? `${s.slice(0, 900)}…` : s;
                } catch { /* ignore */ }
            }
        }

        if (!isNonEmptyStr(message)) {
            message = 'Request failed.';
        }
        if (status) {
            message = `(Status ${status}) ${message}`;
        }

        // If there is a raw string body and it adds info, append it
        const rawBody =
            (typeof e?.response?.data === 'string' ? e.response.data : null) ??
            (typeof e?.data === 'string' ? e.data : null) ??
            (typeof e?.body === 'string' ? e.body : null) ??
            null;

        if (isNonEmptyStr(rawBody) && !message.includes(rawBody)) {
            message += ` — ${rawBody}`;
        }

        if (correlationId) {
            message += ` [CorrelationId: ${correlationId}]`;
        }

        return message.replace(/\s+/g, ' ').trim();
    }
};
