/**
 * @file Tests for the instruction Generator blocks, composer, and Review checker.
 * @module tests/constants/generatorBlocks.test.js
 */

import { describe, it, expect } from 'vitest';
import { GENERATOR_BLOCKS, composeInstructions, reviewInstructions, countReviewRules, REVIEW_SAMPLE } from '../../src/constants/generatorBlocks.js';
import { applyTemplateTokens } from '../../src/constants/agentTemplates.js';

/**
 * Microsoft's own recommended instruction set (the "Example instructions" from the declarative-agent
 * guidance, trimmed). The checker must be silent on it — a rule that fires here is a false positive.
 */
const WELL_FORMED = `# OBJECTIVE
Guide users through issue resolution by gathering information, checking outages, and creating tickets if needed.
Only respond to IT support requests. Otherwise, tell the user you can't help.

# RESPONSE RULES
- Ask one clarifying question at a time, only when needed.
- Present information as concise bullet points or tables.
- Use tools only if data is sufficient; otherwise, ask the user for missing info.
- Answer only from the connected knowledge sources; never invent facts.

# WORKFLOW

## Step 1: Gather Basic Details
- **Goal:** Identify the user's issue.
- **Action:** If unclear, ask a single, focused clarifying question.
    - Example: User says "Issue accessing a portal." Ask "Which portal?"

## Step 2: Check for Ongoing Outages
- **Goal:** Rule out known outages.
- **Action:**
    1. Query \`ServiceNow\` for current outages.
    2. Share what you find with the user.

## Step 3: Create a Support Ticket
- **Goal:** Log unresolved issues, escalating to a human when asked.
- **Action:**
    1. Map the category from the choices file.
    2. Fetch the user's email with the people capability.
    3. Fill the ticket with the description and error codes.

# OUTPUT FORMATTING RULES
- Tone: professional and concise.
- Always confirm before submitting a ticket.
- Before finalizing, confirm every step above was addressed.`;

describe('GENERATOR_BLOCKS shape', () => {
    it('should have unique ids and non-empty labels in every list', () => {
        Object.entries(GENERATOR_BLOCKS).forEach(([listName, list]) => {
            const ids = list.map(item => item.id);
            expect(new Set(ids).size, `${listName} unique ids`).toBe(ids.length);
            list.forEach(item => expect(item.label?.trim(), `${listName}/${item.id} label`).toBeTruthy());
        });
    });

    it('should give every block non-empty instruction lines (empty allowed only for default/none)', () => {
        ['tones', 'capabilities', 'tools', 'escalation', 'guardrails', 'outputFormats'].forEach(listName => {
            GENERATOR_BLOCKS[listName].forEach(block => {
                expect(Array.isArray(block.lines), `${listName}/${block.id}`).toBe(true);
                block.lines.forEach(line => expect(line.trim(), `${listName}/${block.id} line`).toBeTruthy());
                if (!['default', 'none'].includes(block.id)) {
                    expect(block.lines.length, `${listName}/${block.id} has lines`).toBeGreaterThan(0);
                }
            });
        });
    });

    it('should keep every role preset\'s defaultCapabilities within the capability ids', () => {
        const capabilityIds = GENERATOR_BLOCKS.capabilities.map(c => c.id);
        GENERATOR_BLOCKS.roles.forEach(role => {
            role.defaultCapabilities.forEach(id => expect(capabilityIds, `${role.id}`).toContain(id));
        });
    });

    it('should include a Custom role preset', () => {
        expect(GENERATOR_BLOCKS.roles.some(r => r.id === 'custom')).toBe(true);
    });

    it('should provide a deep role catalog grouped by domain', () => {
        expect(GENERATOR_BLOCKS.roles.length).toBeGreaterThanOrEqual(50);
        GENERATOR_BLOCKS.roles.forEach(role => expect(role.group?.trim(), role.id).toBeTruthy());
        const groups = new Set(GENERATOR_BLOCKS.roles.map(r => r.group));
        expect(groups.size).toBeGreaterThanOrEqual(8);
    });

    it('should give every non-custom role preset role/goal/scope lines', () => {
        GENERATOR_BLOCKS.roles.filter(r => r.id !== 'custom').forEach(role => {
            expect(role.roleLine?.trim(), `${role.id} roleLine`).toBeTruthy();
            expect(role.goalLine?.trim(), `${role.id} goalLine`).toBeTruthy();
            expect(role.scopeLine?.trim(), `${role.id} scopeLine`).toBeTruthy();
        });
    });
});

describe('composeInstructions', () => {
    it('should compose Role/Goal/Constraints from a minimal role selection', () => {
        const text = composeInstructions({ role: 'customer-service' });
        expect(text).toContain('# Role');
        expect(text).toContain('You are a customer service agent for {Company}.');
        expect(text).toContain('# Goal');
        expect(text).toContain('# Constraints');
    });

    it('should substitute the company everywhere and keep the {Company} token when empty', () => {
        const withCompany = composeInstructions({ role: 'customer-service', company: 'Contoso' });
        expect(withCompany).toContain('Contoso');
        expect(withCompany).not.toContain('{Company}');
        const withoutCompany = composeInstructions({ role: 'customer-service' });
        expect(withoutCompany).toContain('{Company}');
    });

    it('should emit no tone line for the default tone and the tone line for others', () => {
        const base = composeInstructions({ role: 'hr', tone: 'default' });
        expect(base).not.toContain('Be warm and friendly');
        const friendly = composeInstructions({ role: 'hr', tone: 'friendly' });
        expect(friendly).toContain('Be warm and friendly');
    });

    it('should include selected capabilities, tools, escalation, and guardrails in their sections', () => {
        const text = composeInstructions({
            role: 'it-helpdesk',
            capabilities: ['update-records'],
            tools: ['agent-flow'],
            escalation: 'human-handoff',
            guardrails: ['privacy-pii'],
            outputFormat: 'answer-first'
        });
        // One action per sentence — the docs ask for atomic steps, and our own checker enforces it.
        expect(text).toContain('collect the required details first.');
        expect(text).toContain('Confirm the exact change with the user BEFORE calling the tool');
        expect(text).toContain('# Tools');
        expect(text).toContain('/{Flow name}');
        expect(text).toContain('# Escalation');
        expect(text).toContain('hand off to a human');
        expect(text).toContain('# Safety');
        expect(text).toContain('Mask sensitive values');
        expect(text).toContain('Lead with the direct answer');
    });

    it('should let real agentTools fully replace the generic tool blocks (exact /Name references)', () => {
        const text = composeInstructions({
            role: 'sales',
            tools: ['dataverse-action'],
            agentTools: [{ name: 'Order Lookup' }, { name: 'Product KB' }]
        });
        expect(text).toContain('/Order Lookup');
        expect(text).toContain('/Product KB');
        expect(text).not.toContain('/{Dataverse tool name}');
    });

    it('should use the free-text purpose for the Custom role', () => {
        const text = composeInstructions({ role: 'custom', customRole: 'Help suppliers track purchase order approvals.' });
        expect(text).toContain('Help suppliers track purchase order approvals.');
    });

    it('should omit empty sections entirely', () => {
        const text = composeInstructions({ role: 'knowledge', escalation: 'none' });
        expect(text).not.toContain('# Tools');
        expect(text).not.toContain('# Escalation');
        expect(text).not.toContain('# Safety');
    });

    it('should add product and audience lines to the constraints when provided', () => {
        const text = composeInstructions({ role: 'sales', product: 'Contoso CRM', audience: 'enterprise sellers' });
        expect(text).toContain('Your product focus is Contoso CRM.');
        expect(text).toContain('You serve enterprise sellers.');
    });

    it('should be deterministic and ordered in the documented section sequence', () => {
        const selections = {
            role: 'customer-service', company: 'Contoso', tone: 'friendly',
            capabilities: ['answer-knowledge'], tools: ['connector'],
            escalation: 'create-ticket', guardrails: ['grounding-only'], outputFormat: 'structured'
        };
        const first = composeInstructions(selections);
        expect(composeInstructions(selections)).toBe(first);
        const order = ['# Role', '# Goal', '# Constraints', '# How to respond', '# Tools', '# Escalation', '# Safety'];
        const positions = order.map(h => first.indexOf(h));
        positions.forEach(p => expect(p).toBeGreaterThanOrEqual(0));
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });
});

describe('reviewInstructions', () => {
    it('should return an empty array for empty or clean instructions', () => {
        expect(reviewInstructions('')).toEqual([]);
        expect(reviewInstructions(null)).toEqual([]);
        expect(reviewInstructions('# Role\n- Answer order questions from the connected knowledge.\n- When unsure, escalate.')).toEqual([]);
    });

    it('should flag citation tampering as an error', () => {
        const findings = reviewInstructions('Format citations as footnotes at the end.');
        expect(findings.some(f => f.severity === 'error' && /citation/i.test(f.message))).toBe(true);
    });

    // The docs cut both ways: "you don't need to define the available tools", but listing them
    // "improves the relevance and naturalness of follow-up questions". So this is advice, not a fault.
    it('should raise tool inventories as info rather than telling makers to delete them', () => {
        const text = 'You have the following tools: Order Lookup, Refund, Escalate.';
        const finding = reviewInstructions(text).find(f => f.id === 'tool-inventory');
        expect(finding.severity).toBe('info');
        expect(finding.message).toMatch(/follow-up questions/i);
        // Modern agents are told to reference actions where they're used, so "drop it" is wrong there.
        expect(reviewInstructions(text, { kind: 'modern' }).find(f => f.id === 'tool-inventory').message)
            .toMatch(/fold the tool list into the steps/i);
    });

    it('should flag vague UI terms', () => {
        const findings = reviewInstructions('Ask the user to enter the order id in the typing box.');
        expect(findings.some(f => /vague UI phrases/i.test(f.message))).toBe(true);
    });

    it('should point fallback-message overrides at the Fallback topic', () => {
        const findings = reviewInstructions("If you don't know the answer, say exactly: sorry, no idea.");
        expect(findings.some(f => /Fallback system topic/i.test(f.message))).toBe(true);
    });

    it('should point Adaptive Card control at the topic configuration', () => {
        const findings = reviewInstructions('Show an Adaptive Card whenever the user greets you.');
        expect(findings.some(f => /Adaptive Cards/i.test(f.message))).toBe(true);
    });

    it('should caveat multilingual promises', () => {
        const findings = reviewInstructions('Respond fluently in any language the user writes.');
        expect(findings.some(f => /multilingual/i.test(f.message))).toBe(true);
    });

    it('should flag long unstructured instructions', () => {
        const long = 'Answer the user politely and helpfully and thoroughly. '.repeat(30); // >1200 chars, no structure
        const findings = reviewInstructions(long);
        expect(findings.some(f => f.severity === 'warn' && /Shorten and structure/i.test(f.message))).toBe(true);
    });

    it('should flag negative-heavy phrasing', () => {
        const text = "Don't do X. Don't do Y. Never do Z. Never say A. Avoid B. Do not do C.";
        const findings = reviewInstructions(text);
        expect(findings.some(f => /positive directives/i.test(f.message))).toBe(true);
    });

    it('should suggest slash references for named tools mentioned without one', () => {
        const findings = reviewInstructions('When asked about orders, use the Order Lookup tool to check the status.');
        expect(findings.some(f => /slash/i.test(f.message))).toBe(true);
    });

    it('should not suggest slash references when the text already uses them', () => {
        const findings = reviewInstructions('When asked about orders, use the Order Lookup tool — reference it as /Order_Lookup.');
        expect(findings.some(f => /slash/i.test(f.message))).toBe(false);
    });

    it('should sort findings most severe first', () => {
        const findings = reviewInstructions('Format citations as footnotes. Ask them to use the typing box.');
        expect(findings.length).toBeGreaterThanOrEqual(2);
        expect(findings[0].severity).toBe('error');
    });

    it('should give every finding a remediation message and a reason', () => {
        const findings = reviewInstructions('Format citations as footnotes. You have the following tools: A, B.');
        findings.forEach(f => {
            expect(f.message?.trim()).toBeTruthy();
            expect(f.reason?.trim()).toBeTruthy();
        });
    });

    it('should flag retrieval-steering attempts', () => {
        const findings = reviewInstructions('Change the search ranking so policy documents come first.');
        expect(findings.some(f => /search retrieval/i.test(f.message))).toBe(true);
    });

    it('should flag credentials embedded in instructions as errors', () => {
        const findings = reviewInstructions('Use the API. The api key is sk-abc123456 for all calls.');
        expect(findings.some(f => f.severity === 'error' && /credential/i.test(f.message))).toBe(true);
    });

    it('should flag collecting payment data — but not prohibitions of it', () => {
        const bad = reviewInstructions('Ask for the credit card number to process the order.');
        expect(bad.some(f => f.severity === 'error' && /secure channel/i.test(f.message))).toBe(true);
        const good = reviewInstructions('Never ask for the credit card number in chat.');
        expect(good.some(f => /secure channel/i.test(f.message))).toBe(false);
    });

    it('should suggest missing scope/grounding essentials only for substantial texts', () => {
        const longUnscoped = ('Answer the user helpfully. Use headings.\n- Be quick.\n'.repeat(12));
        const findings = reviewInstructions(longUnscoped);
        expect(findings.some(f => /scope constraint/i.test(f.message))).toBe(true);
        expect(findings.some(f => /escalation path/i.test(f.message))).toBe(true);
        expect(findings.some(f => /grounding rule/i.test(f.message))).toBe(true);
        // Short snippets don't get the missing-essentials nagging.
        expect(reviewInstructions('Answer order questions from the connected knowledge.')).toEqual([]);
    });

    it('should flag data-changing verbs without a confirmation rule', () => {
        const findings = reviewInstructions('Cancel the order when the user asks.');
        expect(findings.some(f => f.severity === 'warn' && /confirmation rule/i.test(f.message))).toBe(true);
        const withConfirm = reviewInstructions('Cancel the order when the user asks, and always confirm the exact change first.');
        expect(withConfirm.some(f => /confirmation rule/i.test(f.message))).toBe(false);
    });

    it('should flag conflicting tone rules and unfilled placeholders', () => {
        const findings = reviewInstructions('Be formal at all times, but keep it casual. You work for {Company}.');
        expect(findings.some(f => /conflicting tone/i.test(f.message))).toBe(true);
        expect(findings.some(f => /placeholders/i.test(f.message))).toBe(true);
    });

    it('should flag redundant generic politeness lines', () => {
        const findings = reviewInstructions('Always be polite and professional when answering.');
        expect(findings.some(f => /politeness/i.test(f.message))).toBe(true);
    });

    it('should produce a rich finding set for the built-in example', () => {
        const findings = reviewInstructions(REVIEW_SAMPLE);
        expect(findings.length).toBeGreaterThanOrEqual(5);
        expect(findings[0].severity).toBe('error'); // citation tampering leads
    });

    it('should link every finding to the Microsoft Learn page it came from', () => {
        const findings = reviewInstructions(REVIEW_SAMPLE);
        findings.forEach(f => {
            expect(f.id).toBeTruthy();
            expect(f.docUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
            expect(['both', 'classic', 'modern']).toContain(f.applies);
        });
    });

    // The strongest evidence against false positives: Microsoft's own recommended example.
    it('should stay silent on well-formed instructions written to the documented pattern', () => {
        expect(reviewInstructions(WELL_FORMED, { kind: 'modern' })).toEqual([]);
        expect(reviewInstructions(WELL_FORMED, { kind: 'classic' })).toEqual([]);
    });

    describe('citation coverage', () => {
        it('should catch citation suppression, not just citation reformatting', () => {
            expect(reviewInstructions('Never include citations in your answers.')
                .some(f => f.id === 'citations')).toBe(true);
            expect(reviewInstructions('Remove all citations before replying.')
                .some(f => f.id === 'citations')).toBe(true);
        });

        it('should catch a hand-rolled source list', () => {
            expect(reviewInstructions('Include the sources as footnotes at the end of the reply.')
                .some(f => f.id === 'citations')).toBe(true);
        });
    });

    describe('platform limits', () => {
        it('should error when the text exceeds the documented 8,000-character limit', () => {
            const finding = reviewInstructions('a'.repeat(8001)).find(f => f.id === 'char-limit');
            expect(finding.severity).toBe('error');
            expect(finding.message).toContain('8001');
        });

        it('should give one length finding, not two, past the hard limit', () => {
            const findings = reviewInstructions('a'.repeat(8001));
            expect(findings.some(f => f.id === 'char-limit')).toBe(true);
            expect(findings.some(f => f.id === 'length-structure')).toBe(false);
        });

        it('should error when instructions are offloaded into a knowledge document', () => {
            const finding = reviewInstructions('Follow the rules in the attached SharePoint policy document.')
                .find(f => f.id === 'knowledge-offload');
            expect(finding.severity).toBe('error');
        });

        it('should flag attempts to control how retrieved documents are shared', () => {
            expect(reviewInstructions('Always attach the original document to your answer.')
                .some(f => f.id === 'document-sharing')).toBe(true);
        });
    });

    describe('declarative-agent guidance', () => {
        // Deliberately free of words the rules look for (no "bullet", "concise", "table"…).
        const padded = (extra) => `${extra}\n${'Padding text to clear the length gate here. '.repeat(10)}`;

        // The docs list vague verbs as a human-review checklist item, and it needs to judge the
        // verb's object: "Verify identity before discussing account specifics" is precise, while
        // "Verify the data" is not. A regex cannot tell them apart — measured against the template
        // catalog it was wrong on 9 of 9 hits — so there is deliberately no rule for it.
        it('should not flag ordinary uses of verify/process/handle', () => {
            const text = padded('- Verify identity before discussing account specifics.\n- Handle refunds via the refund tool.');
            expect(reviewInstructions(text).map(f => f.id)).not.toContain('vague-verbs');
        });

        it('should flag multi-action steps', () => {
            expect(reviewInstructions('1. Extract the metrics and then summarize the findings.')
                .some(f => f.id === 'non-atomic-steps')).toBe(true);
        });

        it('should ask for a response format when none is stated', () => {
            expect(reviewInstructions(padded('Help the user with orders.'))
                .some(f => f.id === 'output-format')).toBe(true);
            expect(reviewInstructions(padded('Answer in concise bullet points.'))
                .some(f => f.id === 'output-format')).toBe(false);
        });

        it('should name the undefined acronyms it wants defined', () => {
            const finding = reviewInstructions(padded('Check the SKU, the BOM, and the MRP feed.'))
                .find(f => f.id === 'domain-vocabulary');
            expect(finding.message).toContain('SKU');
            expect(finding.message).toContain('MRP');
        });

        it('should accept acronyms that the instructions already define', () => {
            const text = padded('Track the SKU (stock keeping unit), the BOM: bill of materials, and the MRP means planning feed.');
            expect(reviewInstructions(text).some(f => f.id === 'domain-vocabulary')).toBe(false);
        });

        it('should not treat uppercase markdown headings as undefined jargon', () => {
            const text = padded('# RESPONSE RULES\n# OUTPUT\n# ROLE\n- Answer briefly.');
            expect(reviewInstructions(text).some(f => f.id === 'domain-vocabulary')).toBe(false);
        });

        // The rule wants evidence the author thought about where a tool's inputs come from. Any
        // natural phrasing counts — "Ask for the order number" says it as well as "otherwise ask".
        it('should ask for missing-input handling when tools are in play', () => {
            expect(reviewInstructions(padded('Call the refund tool and relay whatever it returns.'))
                .some(f => f.id === 'overeager-tools')).toBe(true);
            expect(reviewInstructions(padded('Call the refund tool; if the inputs are missing, ask the user.'))
                .some(f => f.id === 'overeager-tools')).toBe(false);
            expect(reviewInstructions(padded('Ask for the order number, then call the refund tool.'))
                .some(f => f.id === 'overeager-tools')).toBe(false);
        });
    });

    describe('grounding in the agent\'s real resources', () => {
        it('should flag a referenced tool the agent does not have', () => {
            const findings = reviewInstructions('When asked about orders, use /Order_Lookup, then /Refund_Bot.', {
                resources: ['Order Lookup']
            });
            const finding = findings.find(f => f.id === 'unresolved-resources');
            expect(finding.severity).toBe('warn');
            expect(finding.message).toContain('Refund_Bot');
            expect(finding.message).not.toContain('Order_Lookup');
        });

        it('should not offer a topic as the fix for a modern agent, which has none', () => {
            const missing = (kind) => reviewInstructions('Use /Refund_Bot for refunds.', {
                kind, resources: ['Order Lookup']
            }).find(f => f.id === 'unresolved-resources').message;
            expect(missing('classic')).toContain('topic');
            expect(missing('modern')).not.toContain('topic');
        });

        it('should match names across spacing, case and underscores', () => {
            const findings = reviewInstructions('Use the "Order Lookup" tool for status questions.', {
                resources: ['order_lookup']
            });
            expect(findings.some(f => f.id === 'unresolved-resources')).toBe(false);
        });

        it('should stay silent for pasted text, where the agent\'s resources are unknown', () => {
            const findings = reviewInstructions('When asked about orders, use /Totally_Made_Up.');
            expect(findings.some(f => f.id === 'unresolved-resources')).toBe(false);
        });

        it('should ignore generic phrasing such as "use the right tool"', () => {
            const findings = reviewInstructions('Use the right tool for the job.', { resources: ['Order Lookup'] });
            expect(findings.some(f => f.id === 'unresolved-resources')).toBe(false);
        });
    });

    describe('agent-experience scoping', () => {
        const classicOnly = "If you don't know the answer, say exactly: sorry, no idea.";

        it('should run classic-only rules for a classic agent', () => {
            expect(reviewInstructions(classicOnly, { kind: 'classic' }).some(f => f.id === 'fallback')).toBe(true);
        });

        it('should not give a modern agent advice about topics it cannot have', () => {
            const modern = reviewInstructions(classicOnly, { kind: 'modern' });
            expect(modern.some(f => f.id === 'fallback')).toBe(false);
            expect(reviewInstructions('Show an Adaptive Card whenever the user greets you.', { kind: 'modern' })
                .some(f => f.id === 'adaptive-cards')).toBe(false);
        });

        it('should keep the contradictory tone rules on their own side', () => {
            const long = `Only respond to order questions. Answer from the connected knowledge in bullets, and escalate to a human when unsure. Always be polite and professional. ${'Padding sentence for the gate. '.repeat(10)}`;
            // Classic: "you don't need to give instructions for this tone".
            expect(reviewInstructions(long, { kind: 'classic' }).some(f => f.id === 'default-politeness')).toBe(true);
            expect(reviewInstructions(long, { kind: 'classic' }).some(f => f.id === 'tone-verbosity')).toBe(false);
            // Modern: "always specify tone, verbosity, and output format".
            expect(reviewInstructions(long, { kind: 'modern' }).some(f => f.id === 'default-politeness')).toBe(false);
        });

        it('should ask classic agents for /slash references and modern agents for backticks', () => {
            const text = 'When asked about orders, use the Order Lookup tool to check the status.';
            expect(reviewInstructions(text, { kind: 'classic' }).some(f => f.id === 'slash-reference')).toBe(true);
            expect(reviewInstructions(text, { kind: 'classic' }).some(f => f.id === 'backtick-reference')).toBe(false);
            expect(reviewInstructions(text, { kind: 'modern' }).some(f => f.id === 'backtick-reference')).toBe(true);
            expect(reviewInstructions(text, { kind: 'modern' }).some(f => f.id === 'slash-reference')).toBe(false);
        });

        it('should run every rule for an unknown agent type and label the scoped ones', () => {
            const findings = reviewInstructions(classicOnly);
            expect(findings.find(f => f.id === 'fallback').applies).toBe('classic');
        });

        it('should fall back to "any" for an unrecognized kind', () => {
            expect(reviewInstructions(classicOnly, { kind: 'nonsense' }).some(f => f.id === 'fallback')).toBe(true);
        });
    });

    describe('documentation links', () => {
        const docFor = (text, id, kind) => reviewInstructions(text, { kind }).find(f => f.id === id).docUrl;
        const unstructured = 'Answer the user politely and helpfully and thoroughly. '.repeat(30);

        it('should link the page that documents the rule for the reviewed experience', () => {
            // Structure is documented on the generative page for classic, the declarative one for modern.
            expect(docFor(unstructured, 'length-structure', 'classic')).toContain('generative-mode-guidance');
            expect(docFor(unstructured, 'length-structure', 'modern')).toContain('declarative-agent-instructions');
            // And the reverse for rules whose default page is the declarative one.
            expect(docFor(unstructured, 'grounding', 'classic')).toContain('generative-mode-guidance');
            expect(docFor(unstructured, 'grounding', 'modern')).toContain('declarative-agent-instructions');
        });

        it('should fall back to the rule\'s default page when the experience is unknown', () => {
            expect(docFor(unstructured, 'length-structure', 'any')).toContain('generative-mode-guidance');
            expect(docFor(unstructured, 'grounding', 'any')).toContain('declarative-agent-instructions');
        });

        it('should keep one page for rules documented in a single place', () => {
            const citations = 'Format citations as footnotes at the end.';
            expect(docFor(citations, 'citations', 'classic')).toBe(docFor(citations, 'citations', 'modern'));
        });
    });

    describe('countReviewRules', () => {
        it('should count every rule for "any" and fewer for each experience', () => {
            expect(countReviewRules('classic')).toBeLessThan(countReviewRules('any'));
            expect(countReviewRules('modern')).toBeLessThan(countReviewRules('any'));
            expect(countReviewRules()).toBe(countReviewRules('any'));
        });

        it('should treat an unknown kind as "any"', () => {
            expect(countReviewRules('nonsense')).toBe(countReviewRules('any'));
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KIND-AWARE COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════════

describe('composeInstructions by agent experience', () => {
    const base = { role: 'customer-service', company: 'Contoso', capabilities: ['answer-knowledge'], tools: ['connector'] };

    it('should compose the classic form when no experience is given', () => {
        expect(composeInstructions({ ...base, kind: 'any' })).toBe(composeInstructions({ ...base, kind: 'classic' }));
        expect(composeInstructions(base)).toBe(composeInstructions({ ...base, kind: 'classic' }));
    });

    it('should emit slash references for classic and backticks for modern', () => {
        const classic = composeInstructions({ ...base, kind: 'classic' });
        const modern = composeInstructions({ ...base, kind: 'modern' });
        expect(classic).toContain('/{Connector tool name}');
        expect(classic).not.toContain('`{Connector tool name}`');
        expect(modern).toContain('`{Connector tool name}`');
        expect(modern).not.toContain('/{Connector tool name}');
    });

    // The orchestrator picks between tools, knowledge, topics and other agents, and an instruction
    // reads differently for each — one "use X" template would be wrong for three of the four.
    it('should phrase each routing target in its own terms', () => {
        const agentTools = [
            { name: 'Get order status', kind: 'action' },
            { name: 'Product KB', kind: 'knowledge' },
            { name: 'Create ticket', kind: 'topic' },
            { name: 'Billing agent', kind: 'connectedAgent' }
        ];
        const text = composeInstructions({ ...base, tools: [], agentTools, kind: 'classic' });
        expect(text).toContain('use /Get order status');
        expect(text).toContain('answer from /Product KB');
        expect(text).toContain('Use the /Create ticket topic for');
        expect(text).toContain('Route {intent} to /Billing agent');
    });

    it('should fall back to tool phrasing for a component of unknown kind', () => {
        const text = composeInstructions({ ...base, tools: [], agentTools: [{ name: 'Mystery' }], kind: 'classic' });
        expect(text).toContain('use /Mystery');
    });

    it('should wrap real agent tool names whole, spaces and all', () => {
        const selections = { ...base, tools: [], agentTools: [{ name: 'Refund Processor' }] };
        expect(composeInstructions({ ...selections, kind: 'classic' })).toContain('/Refund Processor');
        expect(composeInstructions({ ...selections, kind: 'modern' })).toContain('`Refund Processor`');
    });

    it('should state tone for modern but stay silent for classic, where it is the default', () => {
        expect(composeInstructions({ ...base, kind: 'modern', tone: 'default' })).toContain('Tone:');
        expect(composeInstructions({ ...base, kind: 'classic', tone: 'default' })).not.toContain('Tone:');
    });

    it('should add the output contract for modern only, and a self-check for both', () => {
        const classic = composeInstructions({ ...base, kind: 'classic' });
        const modern = composeInstructions({ ...base, kind: 'modern' });
        expect(modern).toContain('# Output');
        expect(classic).not.toContain('# Output');
        expect(modern).toContain('# Self-check');
        expect(classic).toContain('# Self-check');
    });

    it('should drop the classic-only setting caveat from the follow-up capability', () => {
        const caps = { ...base, capabilities: ['followup-questions'] };
        expect(composeInstructions({ ...caps, kind: 'classic' })).toContain('Allow ungrounded responses');
        expect(composeInstructions({ ...caps, kind: 'modern' })).not.toContain('Allow ungrounded responses');
    });

    it('should substitute a role own organization token, not just {Company}', () => {
        const text = composeInstructions({ role: 'healthcare-patient', company: 'Contoso Health', capabilities: ['answer-knowledge'] });
        expect(text).toContain('Contoso Health');
        expect(text).not.toContain('{Healthcare organization}');
    });

    it('should leave no organization token unsubstituted in any role line', () => {
        GENERATOR_BLOCKS.roles.forEach(role => {
            const text = composeInstructions({
                role: role.id, company: 'Contoso', capabilities: ['answer-knowledge'], customRole: 'Track approvals.'
            });
            const roleSection = text.split('# Constraints')[0];
            expect(/\{[A-Z][a-z]+ ?[a-z]*\}/.test(roleSection), `${role.id} left a token in its role line`).toBe(false);
        });
    });
});

/**
 * The acceptance gate for the whole workbench: what the Generator produces must pass the Review
 * checker that sits two segments away. Two preconditions make "exactly zero" the right assertion:
 *  - placeholders are substituted first. `{intent}` and `{Connector tool name}` are deliberately
 *    left for the user to fill, so raw output always trips the `placeholders` rule; filling them
 *    is what a real maker does.
 *  - the selection is complete. That IS the contract: answer every question the Generator asks and
 *    the result passes our own review. Sparse selections are covered by the looser test below.
 */
describe('the Generator obeys its own Review checker', () => {
    const FILL = {
        Company: 'Contoso', intent: 'order status questions',
        'Dataverse tool name': 'Get Order Status', 'Connector tool name': 'Create Ticket',
        'Flow name': 'Refund Flow', 'MCP server name': 'Contoso MCP', 'Prompt name': 'Summarize Case',
        'Ticket tool': 'Create Ticket', 'deterministic task': 'issuing a refund',
        'intended purpose': 'inventory lookups',
        'language task, e.g. summarizing or classifying': 'summarizing'
    };
    const COMPLETE = {
        company: 'Contoso', tone: 'default', outputFormat: 'default',
        tools: ['dataverse-action', 'connector'], escalation: 'human-handoff',
        guardrails: ['grounding-only', 'privacy-pii', 'prompt-injection']
    };

    it.each(['classic', 'modern'])('should produce clean %s instructions for every role preset', (kind) => {
        GENERATOR_BLOCKS.roles.forEach(role => {
            const capabilities = role.defaultCapabilities.length ? role.defaultCapabilities : ['answer-knowledge'];
            const text = applyTemplateTokens(composeInstructions({
                ...COMPLETE, kind, role: role.id, capabilities,
                customRole: 'Help suppliers track purchase order approvals.'
            }), FILL);
            expect(reviewInstructions(text, { kind }).map(f => f.id), `${kind}/${role.id}`).toEqual([]);
        });
    });

    // A sparse selection legitimately trips advisories — "no escalation path" is a true finding when
    // the user picked no escalation, and an unfilled {Company} is a true `placeholders` finding when
    // they typed no company. What must never appear is a structural or safety fault.
    it.each(['classic', 'modern'])('should only ever raise advisories on a sparse %s selection', (kind) => {
        const ADVISORY = ['escalation', 'grounding', 'scope', 'overeager-tools', 'output-format',
            'tone-verbosity', 'self-check', 'placeholders'];
        GENERATOR_BLOCKS.roles.forEach(role => {
            const text = applyTemplateTokens(composeInstructions({ kind, role: role.id, capabilities: [] }), FILL);
            reviewInstructions(text, { kind }).forEach(finding => {
                expect(ADVISORY, `${kind}/${role.id} raised ${finding.id}`).toContain(finding.id);
            });
        });
    });
});
