/**
 * @file Tests for the agent templates catalog and its token helpers.
 * @module tests/constants/agentTemplates.test.js
 * @description Shape-validates every template (unique ids, category/subcategory membership,
 * non-empty fields, keyword hygiene), unit-tests the {Placeholder} token helpers, and dogfoods the
 * Evaluation templates through the tool's own evaluation parsers so the copy-ready YAML always
 * matches what the Components view renders.
 */

import { describe, it, expect } from 'vitest';
import {
    AGENT_TEMPLATES,
    AGENT_TEMPLATE_CATEGORIES,
    AGENT_TEMPLATE_SUBCATEGORIES,
    extractTemplateTokens,
    applyTemplateTokens,
    templateApplies,
    templateContent,
    templateUse
} from '../../src/constants/agentTemplates.js';
import { APPLIES_VALUES } from '../../src/constants/agentKinds.js';
import { parseEvaluationSet, parseEvaluationCase } from '../../src/services/AgentService.js';
import { reviewInstructions } from '../../src/constants/generatorBlocks.js';

describe('agentTemplates catalog', () => {
    it('should have a deep catalog (200+ templates)', () => {
        expect(AGENT_TEMPLATES.length).toBeGreaterThanOrEqual(200);
    });

    it('should have unique ids', () => {
        const ids = AGENT_TEMPLATES.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('should give every template a known category and a subcategory within it', () => {
        AGENT_TEMPLATES.forEach(t => {
            expect(AGENT_TEMPLATE_CATEGORIES, `${t.id} category`).toContain(t.category);
            expect(AGENT_TEMPLATE_SUBCATEGORIES[t.category], `${t.id} subcategory`).toContain(t.subcategory);
        });
    });

    it('should have non-empty title, description, and content on every template', () => {
        AGENT_TEMPLATES.forEach(t => {
            expect(t.title?.trim(), `${t.id} title`).toBeTruthy();
            expect(t.description?.trim(), `${t.id} description`).toBeTruthy();
            expect(t.content?.trim(), `${t.id} content`).toBeTruthy();
        });
    });

    it('should populate every declared subcategory with at least one template', () => {
        Object.entries(AGENT_TEMPLATE_SUBCATEGORIES).forEach(([category, subcats]) => {
            expect(AGENT_TEMPLATE_CATEGORIES, `${category} is a category`).toContain(category);
            subcats.forEach(sub => {
                const count = AGENT_TEMPLATES
                    .filter(t => t.category === category && t.subcategory === sub).length;
                expect(count, `${category} / ${sub}`).toBeGreaterThan(0);
            });
        });
    });

    it('should declare subcategories for every category', () => {
        AGENT_TEMPLATE_CATEGORIES.forEach(category => {
            expect(AGENT_TEMPLATE_SUBCATEGORIES[category]?.length, category).toBeGreaterThan(0);
        });
    });

    it('should only carry non-empty string keywords when present', () => {
        AGENT_TEMPLATES.filter(t => t.keywords !== undefined).forEach(t => {
            expect(Array.isArray(t.keywords), `${t.id} keywords array`).toBe(true);
            expect(t.keywords.length, `${t.id} keywords non-empty`).toBeGreaterThan(0);
            t.keywords.forEach(k => expect(typeof k === 'string' && k.trim().length > 0, `${t.id} keyword "${k}"`).toBe(true));
        });
    });

    it('should include an Evaluation category with test-set and test-case templates', () => {
        expect(AGENT_TEMPLATE_CATEGORIES).toContain('Evaluation');
        const evals = AGENT_TEMPLATES.filter(t => t.category === 'Evaluation');
        expect(evals.length).toBeGreaterThanOrEqual(4);
    });
});

describe('extractTemplateTokens', () => {
    it('should extract unique tokens in first-appearance order, including multi-word tokens', () => {
        const tokens = extractTemplateTokens('Hello {Company}! {topics, e.g. orders, billing} — bye {Company}.');
        expect(tokens).toEqual(['Company', 'topics, e.g. orders, billing']);
    });

    it('should NOT treat example JSON or quoted/colon content as tokens', () => {
        expect(extractTemplateTokens('Payload: {"name": "test"} and {key: value} and {"x"}')).toEqual([]);
    });

    it('should require tokens to start with a letter', () => {
        expect(extractTemplateTokens('a {1number} b {Real token} c')).toEqual(['Real token']);
    });

    it('should return an empty array for empty or token-free content', () => {
        expect(extractTemplateTokens('')).toEqual([]);
        expect(extractTemplateTokens('No placeholders here.')).toEqual([]);
        expect(extractTemplateTokens(null)).toEqual([]);
    });

    it('should find tokens in every real template without throwing', () => {
        AGENT_TEMPLATES.forEach(t => {
            expect(() => extractTemplateTokens(t.content), t.id).not.toThrow();
        });
    });
});

describe('applyTemplateTokens', () => {
    it('should replace ALL occurrences of a filled token', () => {
        const result = applyTemplateTokens('{Company} helps. Contact {Company}.', { Company: 'Contoso' });
        expect(result).toBe('Contoso helps. Contact Contoso.');
    });

    it('should leave unfilled and empty-valued tokens in place', () => {
        const result = applyTemplateTokens('{Company} and {Product}', { Company: '', Other: 'x' });
        expect(result).toBe('{Company} and {Product}');
    });

    it('should handle replacement values containing regex metacharacters', () => {
        const result = applyTemplateTokens('Call {Team} now.', { Team: 'A/B ($pecial) [Team]' });
        expect(result).toBe('Call A/B ($pecial) [Team] now.');
    });

    it('should trim replacement values', () => {
        expect(applyTemplateTokens('{A}', { A: '  Contoso  ' })).toBe('Contoso');
    });
});

describe('Evaluation templates dogfooding (parse with the tool\'s own parsers)', () => {
    const byId = (id) => AGENT_TEMPLATES.find(t => t.id === id);

    it('should parse the PromptGrader test set as one grader with three labels', () => {
        const parsed = parseEvaluationSet(byId('eval-test-set-promptgrader').content);
        expect(parsed).toBeTruthy();
        expect(parsed.graders).toHaveLength(1);
        expect(parsed.graders[0].kind).toBe('PromptGrader');
        expect(parsed.graders[0].labels).toHaveLength(3);
        expect(parsed.graders[0].labels.map(l => l.outcome)).toEqual(['Pass', 'Fail', 'Fail']);
    });

    it('should parse the holistic set as one label-less GeneralQualityGrader', () => {
        const parsed = parseEvaluationSet(byId('eval-test-set-quality').content);
        expect(parsed).toBeTruthy();
        expect(parsed.graders).toHaveLength(1);
        expect(parsed.graders[0].kind).toBe('GeneralQualityGrader');
        expect(parsed.graders[0].labels).toHaveLength(0);
    });

    it('should parse the multi-turn case as four alternating user/agent turns', () => {
        const parsed = parseEvaluationCase(byId('eval-multiturn-case').content);
        expect(parsed).toBeTruthy();
        expect(parsed.turns).toHaveLength(4);
        expect(parsed.turns.map(t => t.role)).toEqual(['user', 'agent', 'user', 'agent']);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT EXPERIENCE — the classic/modern split
// ═══════════════════════════════════════════════════════════════════════════════

describe('agent-experience tagging', () => {
    const byApplies = (scope) => AGENT_TEMPLATES.filter(t => templateApplies(t) === scope).map(t => t.id);

    it('should resolve a scope for every template, defaulting to both', () => {
        AGENT_TEMPLATES.forEach(t => {
            expect(APPLIES_VALUES, t.id).toContain(templateApplies(t));
        });
        expect(templateApplies({})).toBe('both');
        expect(templateApplies(null)).toBe('both');
    });

    // Assert the reason rather than a count, so the rule survives the catalog growing.
    it('should tag every Topic template classic — modern agents have no topics', () => {
        const untagged = AGENT_TEMPLATES
            .filter(t => t.category === 'Topic' && templateApplies(t) !== 'classic')
            .map(t => t.id);
        expect(untagged).toEqual([]);
    });

    it('should scope exactly one non-Topic template to classic, and one to modern', () => {
        const classicOutsideTopic = AGENT_TEMPLATES
            .filter(t => templateApplies(t) === 'classic' && t.category !== 'Topic')
            .map(t => t.id);
        expect(classicOutsideTopic).toEqual(['pattern-generative-orchestration']);
        expect(byApplies('modern')).toEqual(['instr-m365-declarative']);
    });

    it('should keep the classic-only set from silently shrinking', () => {
        expect(byApplies('classic').length).toBeGreaterThanOrEqual(23);
    });
});

describe('templateContent', () => {
    const withVariant = AGENT_TEMPLATES.find(t => t.contentModern);
    const noVariant = AGENT_TEMPLATES.find(t => !t.contentModern && t.content.includes('/{'));

    it('should return the classic content untouched for classic and any', () => {
        AGENT_TEMPLATES.forEach(t => {
            expect(templateContent(t, 'classic'), t.id).toBe(t.content);
            expect(templateContent(t, 'any'), t.id).toBe(t.content);
            expect(templateContent(t), t.id).toBe(t.content);
        });
    });

    it('should prefer the hand-written variant for modern', () => {
        expect(templateContent(withVariant, 'modern')).toContain(withVariant.contentModern.slice(0, 40));
        expect(templateContent(withVariant, 'modern')).not.toBe(withVariant.content);
    });

    it('should rewrite slash references when there is no hand-written variant', () => {
        const modern = templateContent(noVariant, 'modern');
        expect(modern).not.toBe(noVariant.content);
        expect(modern).toContain('`{');
    });

    it('should tolerate a missing template', () => {
        expect(templateContent(null, 'modern')).toBe('');
        expect(templateContent({}, 'modern')).toBe('');
    });
});

describe('catalog invariants for modern agents', () => {
    const modernReachable = AGENT_TEMPLATES.filter(t => templateApplies(t) !== 'classic');

    it('should leave no classic slash reference in anything a modern maker can copy', () => {
        modernReachable.forEach(t => {
            const modern = templateContent(t, 'modern');
            expect(/(^|[\s(])\/\{/m.test(modern), `${t.id} has a /{Token} reference`).toBe(false);
            expect(/(^|[\s(])\/[A-Za-z]/m.test(modern), `${t.id} has a bare /Name reference`).toBe(false);
        });
    });

    it('should never double up backticks', () => {
        modernReachable.forEach(t => {
            expect(/``/.test(templateContent(t, 'modern')), t.id).toBe(false);
        });
    });

    it('should not invent placeholders the classic content does not have', () => {
        modernReachable.forEach(t => {
            const base = new Set(extractTemplateTokens(t.content));
            extractTemplateTokens(templateContent(t, 'modern')).forEach(token => {
                expect(base.has(token), `${t.id} gained the token {${token}} in its modern variant`).toBe(true);
            });
        });
    });

    it('should write variants that actually differ and drop the classic vocabulary', () => {
        const CLASSIC_ONLY = /(Adaptive Card|trigger phrase|Fallback topic|system topic|Allow ungrounded responses|authentication node|transfer node|Classic orchestration|leading slash)/i;
        AGENT_TEMPLATES.filter(t => t.contentModern).forEach(t => {
            expect(t.contentModern.trim(), t.id).toBeTruthy();
            expect(t.contentModern, t.id).not.toBe(t.content);
            expect(CLASSIC_ONLY.test(t.contentModern), `${t.id} variant still mentions a classic-only feature`).toBe(false);
        });
    });

    // The canary: a shared template that still talks about classic-only features either needs a
    // modern variant or a classic tag. It catches keyword regressions; the variant set is the
    // authority for the cases keywords can't see.
    it('should leave no shared template describing a feature modern agents do not have', () => {
        const CLASSIC_VOCAB = /(Adaptive Card|trigger phrase|Fallback topic|system topic|Allow ungrounded responses|a new topic|a dedicated topic|the topic itself|authentication node|transfer node|Classic orchestration|leading slash|slash reference)/i;
        const needsAttention = AGENT_TEMPLATES
            .filter(t => templateApplies(t) === 'both' && !t.contentModern && CLASSIC_VOCAB.test(t.content))
            .map(t => t.id);
        expect(needsAttention).toEqual([]);
    });
});

/**
 * Dogfooding: a maker copies a template out of the Library and pastes it into Review. The
 * Instructions templates are complete agent instruction sets, so they must not trip any rule that
 * reports something actually WRONG with the text.
 *
 * Excluded are the rules that ask for a section a compact starting point legitimately leaves to the
 * author (scope, escalation, grounding, response format, tone, examples) and `placeholders`, which
 * fires on the {tokens} that make a template a template.
 */
describe('Instructions templates survive the Review checker', () => {
    const DEFECT_RULES = [
        'citations', 'char-limit', 'knowledge-offload', 'secrets', 'payment-collection',
        'search-retrieval', 'document-sharing', 'multilingual', 'ambiguous-ui', 'non-atomic-steps',
        'domain-vocabulary', 'write-confirmation', 'trigger-hardening', 'tone-conflict',
        'negativity', 'default-politeness', 'slash-reference', 'backtick-reference', 'length-structure'
    ];

    const filled = (template, kind) => {
        const content = templateContent(template, kind);
        const values = Object.fromEntries(extractTemplateTokens(content).map(token => [token, 'Contoso']));
        return applyTemplateTokens(content, values);
    };

    it('should report no defect for any Instructions template, in either experience', () => {
        AGENT_TEMPLATES.filter(t => t.category === 'Instructions').forEach(template => {
            const kinds = templateApplies(template) === 'both'
                ? ['classic', 'modern']
                : [templateApplies(template)];
            kinds.forEach(kind => {
                const found = reviewInstructions(filled(template, kind), { kind })
                    .map(f => f.id)
                    .filter(id => DEFECT_RULES.includes(id));
                expect(found, `${template.id} (${kind})`).toEqual([]);
            });
        });
    });

    /**
     * The promise the Library makes is "copy-ready scaffolds", so the bar is the whole checker, not
     * just the defect rules: paste any Instructions template into Review and it comes back clean.
     * A new template that omits a scope constraint, an escalation path, a grounding rule or a
     * response format fails the build rather than shipping half-finished.
     */
    it('should pass the whole Review checker — nothing to fix after pasting one in', () => {
        AGENT_TEMPLATES.filter(t => t.category === 'Instructions').forEach(template => {
            const kinds = templateApplies(template) === 'both'
                ? ['classic', 'modern']
                : [templateApplies(template)];
            kinds.forEach(kind => {
                const found = reviewInstructions(filled(template, kind), { kind }).map(f => f.id);
                expect(found, `${template.id} (${kind})`).toEqual([]);
            });
        });
    });

    it('should keep every Instructions template inside the platform length limit', () => {
        AGENT_TEMPLATES.filter(t => t.category === 'Instructions').forEach(template => {
            expect(templateContent(template, 'modern').length, template.id).toBeLessThan(8000);
        });
    });
});

describe('templateUse', () => {
    it('should classify every template as instruction text, a maker checklist, or a definition', () => {
        AGENT_TEMPLATES.forEach(t => {
            expect(['instructions', 'guidance', 'config'], t.id).toContain(templateUse(t));
        });
    });

    it('should treat every Instructions template as text to paste into an agent', () => {
        AGENT_TEMPLATES.filter(t => t.category === 'Instructions').forEach(t => {
            expect(templateUse(t), t.id).toBe('instructions');
        });
    });

    it('should treat Tool and Knowledge templates as maker checklists, and Topic ones as definitions', () => {
        expect(templateUse(AGENT_TEMPLATES.find(t => t.id === 'tool-mcp'))).toBe('guidance');
        expect(templateUse(AGENT_TEMPLATES.find(t => t.id === 'knowledge-freshness'))).toBe('guidance');
        expect(templateUse(AGENT_TEMPLATES.find(t => t.id === 'topic-fallback'))).toBe('config');
    });

    // The rule that motivated the field: a template teaching what NOT to write is not paste-able.
    it('should mark the templates that teach authoring as guidance, not instruction text', () => {
        expect(templateUse(AGENT_TEMPLATES.find(t => t.id === 'pattern-citations'))).toBe('guidance');
        expect(templateUse(AGENT_TEMPLATES.find(t => t.id === 'pattern-generative-orchestration'))).toBe('guidance');
    });

    it('should default sensibly for an unknown or missing category', () => {
        expect(templateUse({})).toBe('instructions');
        expect(templateUse(null)).toBe('instructions');
        expect(templateUse({ category: 'Tool' })).toBe('guidance');
        expect(templateUse({ category: 'Tool', use: 'instructions' })).toBe('instructions');
    });
});
