/**
 * @file Tests for the shared agent-experience vocabulary.
 * @module tests/constants/agentKinds.test.js
 */

import { describe, it, expect } from 'vitest';
import { AGENT_KINDS, APPLIES_VALUES, normalizeAgentKind, appliesToKind, toModernSyntax } from '../../src/constants/agentKinds.js';

describe('AGENT_KINDS / APPLIES_VALUES', () => {
    it('should expose the three experiences and the three scopes', () => {
        expect(AGENT_KINDS).toEqual(['any', 'classic', 'modern']);
        expect(APPLIES_VALUES).toEqual(['both', 'classic', 'modern']);
    });
});

describe('normalizeAgentKind', () => {
    it('should pass through a known kind', () => {
        AGENT_KINDS.forEach(kind => expect(normalizeAgentKind(kind)).toBe(kind));
    });

    it('should fall back to "any" for anything else', () => {
        [undefined, null, '', 'nonsense', 'Classic', 0].forEach(input => {
            expect(normalizeAgentKind(input)).toBe('any');
        });
    });
});

describe('appliesToKind', () => {
    it('should let everything through when the experience is unknown', () => {
        APPLIES_VALUES.forEach(applies => expect(appliesToKind(applies, 'any')).toBe(true));
    });

    it('should always allow guidance that applies to both', () => {
        expect(appliesToKind('both', 'classic')).toBe(true);
        expect(appliesToKind('both', 'modern')).toBe(true);
    });

    it('should scope experience-specific guidance to its own experience', () => {
        expect(appliesToKind('classic', 'classic')).toBe(true);
        expect(appliesToKind('classic', 'modern')).toBe(false);
        expect(appliesToKind('modern', 'modern')).toBe(true);
        expect(appliesToKind('modern', 'classic')).toBe(false);
    });

    it('should default to "both" scope and "any" kind', () => {
        expect(appliesToKind()).toBe(true);
        expect(appliesToKind(undefined, 'modern')).toBe(true);
    });
});

describe('toModernSyntax', () => {
    it('should backtick a slash token reference', () => {
        expect(toModernSyntax('run /{Flow name} and relay its result'))
            .toBe('run `{Flow name}` and relay its result');
    });

    it('should keep trailing punctuation outside the reference', () => {
        expect(toModernSyntax('via /{Billing tool};')).toBe('via `{Billing tool}`;');
    });

    it('should accept an opening parenthesis as a boundary', () => {
        expect(toModernSyntax('(/{Status tool} or the record)')).toBe('(`{Status tool}` or the record)');
    });

    it('should rewrite a reference at the start of a line', () => {
        expect(toModernSyntax('- /{Ticket tool} creates the case.\n- /{Order tool} reads it.'))
            .toBe('- `{Ticket tool}` creates the case.\n- `{Order tool}` reads it.');
    });

    it('should be idempotent', () => {
        const once = toModernSyntax('use /{Order tool} first');
        expect(toModernSyntax(once)).toBe(once);
        expect(toModernSyntax('already `{Order tool}` here')).toBe('already `{Order tool}` here');
    });

    it('should absorb backticks already wrapping a slash reference', () => {
        expect(toModernSyntax('use `/{Order tool}` now')).toBe('use `{Order tool}` now');
    });

    it('should leave URLs and mid-word slashes alone', () => {
        expect(toModernSyntax('see https://learn.microsoft.com/copilot-studio/x'))
            .toBe('see https://learn.microsoft.com/copilot-studio/x');
        expect(toModernSyntax('and/{or} stays')).toBe('and/{or} stays');
        expect(toModernSyntax('the 24/7 rota')).toBe('the 24/7 rota');
    });

    it('should leave bare slash references alone, by design', () => {
        expect(toModernSyntax('use /Order_Lookup for status')).toBe('use /Order_Lookup for status');
    });

    it('should not touch JSON-ish braces that are not placeholders', () => {
        expect(toModernSyntax('emit /{"name": "x"} verbatim')).toBe('emit /{"name": "x"} verbatim');
    });

    it('should handle empty and nullish input', () => {
        expect(toModernSyntax('')).toBe('');
        expect(toModernSyntax(null)).toBe('');
        expect(toModernSyntax(undefined)).toBe('');
    });
});
