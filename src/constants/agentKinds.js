/**
 * @file The agent-experience vocabulary shared by the template catalog, the Generator, and Review.
 * @module constants/agentKinds
 * @description Copilot Studio has two agent experiences and Microsoft's instruction guidance
 * diverges between them. **Classic** is topic-based: Topics and system topics (Fallback,
 * Conversation Start), trigger phrases, Adaptive Cards configured in a topic, an orchestration
 * toggle, and `/Tool_Name` slash references inserted by the instruction editor. **Modern** (the
 * `cliagent-*` experience) has no topics at all and follows the M365 declarative-agent guidance:
 * backticked tool names, an explicit tone/verbosity/output-format statement, atomic steps, an
 * output contract, and a self-evaluation step.
 *
 * This module holds only the vocabulary and the two pure predicates/transforms that all three
 * workbench segments need, so the catalog does not have to import the Generator (or vice versa).
 */

/** @typedef {'any'|'classic'|'modern'} AgentKind */

/** The agent experiences a user can scope to. `any` means "don't scope" — show and check everything. */
export const AGENT_KINDS = ['any', 'classic', 'modern'];

/** Which experiences a piece of guidance applies to. */
export const APPLIES_VALUES = ['both', 'classic', 'modern'];

/**
 * Coerces any input to a known agent experience, falling back to the unscoped `any`.
 * @param {string} [kind] - The candidate kind.
 * @returns {AgentKind} A valid kind.
 */
export function normalizeAgentKind(kind) {
    return AGENT_KINDS.includes(kind) ? kind : 'any';
}

/**
 * Whether a piece of guidance is in scope for the experience being viewed. The single predicate
 * behind the review rules, the Library filter, and the subcategory counts — one rule, no drift.
 * @param {'both'|'classic'|'modern'} [applies='both'] - What the guidance is about.
 * @param {AgentKind} [kind='any'] - The experience being viewed.
 * @returns {boolean} True when the guidance should be shown/run.
 */
export function appliesToKind(applies = 'both', kind = 'any') {
    return kind === 'any' || applies === 'both' || applies === kind;
}

/**
 * A classic `/{Tool}` slash reference. The inner grammar deliberately mirrors `TOKEN_REGEX` in
 * `agentTemplates.js` so the two can never disagree about what a placeholder is. The optional
 * backticks make the rewrite idempotent, and the left boundary keeps URLs (`https://…`) and
 * `and/{or}`-style prose out of it.
 * @private
 */
const SLASH_TOOL_REF_RE = /(^|[\s(])`?\/(\{[A-Za-z][^{}"'\n:]*\})`?/gm;

/**
 * Rewrites classic `/{Tool}` slash references as modern `` `{Tool}` `` backtick references, and
 * changes nothing else. The braces are kept so `extractTemplateTokens` still finds the placeholder
 * and the Customize grid still offers a field for it.
 *
 * Bare references (`/Order_Lookup`, with no braces) are deliberately out of scope: real tool names
 * are usually multi-word, so a bare-name pattern would emit `` `Refund` Processor``. Anywhere a
 * bare name is generated, it is wrapped at the point of emission instead.
 * @param {string} text - The text to rewrite.
 * @returns {string} The text with slash references backticked. Pure and idempotent.
 * @example
 * toModernSyntax('run /{Flow name} and relay');   // 'run `{Flow name}` and relay'
 * toModernSyntax('https://learn.microsoft.com');  // unchanged
 */
export function toModernSyntax(text) {
    return String(text || '').replace(SLASH_TOOL_REF_RE, '$1`$2`');
}
