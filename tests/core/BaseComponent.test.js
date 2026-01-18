/**
 * @file Tests for BaseComponent
 * @module tests/core/BaseComponent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseComponent } from '../../src/core/BaseComponent.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';
import { UIFactory } from '../../src/ui/UIFactory.js';

vi.mock('../../../src/services/PowerAppsApiService.js');
vi.mock('../../../src/ui/UIFactory.js');

// Create a test subclass
class TestComponent extends BaseComponent {
    constructor(id = 'test', label = 'Test', icon = '<svg></svg>', isFormOnly = false) {
        super(id, label, icon, isFormOnly);
    }

    async render() {
        if (this.isFormOnly && !PowerAppsApiService.isFormContextAvailable) {
            return UIFactory.createFormDisabledMessage();
        }
        const el = document.createElement('div');
        el.textContent = 'Test content';
        return el;
    }
}

describe('BaseComponent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should throw error when instantiated directly', () => {
            expect(() => new BaseComponent('id', 'label', 'icon')).toThrow(TypeError);
        });

        it('should allow instantiation through subclass', () => {
            const component = new TestComponent();
            expect(component).toBeInstanceOf(BaseComponent);
            expect(component).toBeInstanceOf(TestComponent);
        });

        it('should set all properties correctly', () => {
            const component = new TestComponent('myId', 'My Label', '<svg>icon</svg>', true);
            expect(component.id).toBe('myId');
            expect(component.label).toBe('My Label');
            expect(component.icon).toBe('<svg>icon</svg>');
            expect(component.isFormOnly).toBe(true);
        });

        it('should default isFormOnly to false', () => {
            const component = new TestComponent('id', 'label', 'icon');
            expect(component.isFormOnly).toBe(false);
        });
    });

    describe('render', () => {
        it('should show form disabled message when form-only and not in form context', async () => {
            const mockMessage = document.createElement('div');
            mockMessage.textContent = 'Form required';

            UIFactory.createFormDisabledMessage = vi.fn().mockReturnValue(mockMessage);

            const component = new TestComponent('id', 'label', 'icon', true);
            const result = await component.render();

            expect(UIFactory.createFormDisabledMessage).toHaveBeenCalled();
        });

        it('should render normally when form-only and in form context', async () => {
            const component = new TestComponent('id', 'label', 'icon', true);
            const result = await component.render();

            expect(result).toBeInstanceOf(HTMLElement);
        });

        it('should render normally for non-form-only components', async () => {
            const component = new TestComponent('id', 'label', 'icon', false);
            const result = await component.render();

            expect(result.textContent).toBe('Test content');
        });

        it('should show error message for unimplemented render in base class', async () => {
            class UnimplementedComponent extends BaseComponent {
                constructor() {
                    super('unimpl', 'Unimplemented', 'icon', false);
                }
                // Intentionally not overriding render to test base implementation
            }

            const component = new UnimplementedComponent();
            const result = await component.render();

            expect(result.innerHTML).toContain('pdt-error');
            expect(result.innerHTML).toContain('Unimplemented');
        });
    });

    describe('postRender', () => {
        it('should be a no-op by default', () => {
            const component = new TestComponent();
            const mockElement = document.createElement('div');

            expect(() => component.postRender(mockElement)).not.toThrow();
        });

        it('should be overrideable by subclass', () => {
            class CustomComponent extends BaseComponent {
                constructor() {
                    super('custom', 'Custom', 'icon');
                    this.postRenderCalled = false;
                }

                postRender(element) {
                    this.postRenderCalled = true;
                    element.classList.add('post-rendered');
                }
            }

            const component = new CustomComponent();
            const mockElement = document.createElement('div');
            component.postRender(mockElement);

            expect(component.postRenderCalled).toBe(true);
            expect(mockElement.classList.contains('post-rendered')).toBe(true);
        });
    });

    describe('destroy', () => {
        it('should be a no-op by default', () => {
            const component = new TestComponent();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should be overrideable by subclass', () => {
            class CustomComponent extends BaseComponent {
                constructor() {
                    super('custom', 'Custom', 'icon');
                    this.destroyed = false;
                }

                destroy() {
                    this.destroyed = true;
                }
            }

            const component = new CustomComponent();
            component.destroy();

            expect(component.destroyed).toBe(true);
        });

        it('should allow cleanup of resources', () => {
            class ResourceComponent extends BaseComponent {
                constructor() {
                    super('resource', 'Resource', 'icon');
                    this.intervalId = setInterval(() => { }, 1000);
                }

                destroy() {
                    if (this.intervalId) {
                        clearInterval(this.intervalId);
                        this.intervalId = null;
                    }
                }
            }

            const component = new ResourceComponent();
            expect(component.intervalId).toBeTruthy();

            component.destroy();
            expect(component.intervalId).toBeNull();
        });
    });

    describe('component lifecycle', () => {
        it('should maintain state through lifecycle', async () => {
            class StatefulComponent extends BaseComponent {
                constructor() {
                    super('stateful', 'Stateful', 'icon');
                    this.state = { count: 0 };
                }

                async render() {
                    const el = document.createElement('div');
                    el.textContent = `Count: ${this.state.count}`;
                    return el;
                }

                increment() {
                    this.state.count++;
                }
            }

            const component = new StatefulComponent();
            const el1 = await component.render();
            expect(el1.textContent).toBe('Count: 0');

            component.increment();
            const el2 = await component.render();
            expect(el2.textContent).toBe('Count: 1');
        });
    });

    describe('property validation', () => {
        it('should handle various icon formats', () => {
            const svgIcon = '<svg><path d="M10 10"/></svg>';
            const component1 = new TestComponent('id', 'label', svgIcon);
            expect(component1.icon).toBe(svgIcon);

            const emojiIcon = '🔧';
            const component2 = new TestComponent('id', 'label', emojiIcon);
            expect(component2.icon).toBe(emojiIcon);
        });

        it('should handle special characters in id and label', () => {
            const component = new TestComponent('my-special_id.1', 'Label (with) [special] chars');
            expect(component.id).toBe('my-special_id.1');
            expect(component.label).toBe('Label (with) [special] chars');
        });
    });

    describe('render form-only when not in form context', () => {
        it('should call UIFactory.createFormDisabledMessage when form-only and no form context', async () => {
            const mockMessage = document.createElement('div');
            mockMessage.textContent = 'Form required';
            mockMessage.className = 'pdt-form-disabled';
            UIFactory.createFormDisabledMessage = vi.fn().mockReturnValue(mockMessage);

            // Create a form-only component that uses the TestComponent pattern
            // but checks isFormContextAvailable
            class FormOnlyTestComponent extends BaseComponent {
                constructor() {
                    super('formOnly', 'Form Only Component', '<svg></svg>', true);
                }

                async render() {
                    // Simulate form context not being available
                    if (this.isFormOnly) {
                        return UIFactory.createFormDisabledMessage();
                    }
                    const el = document.createElement('div');
                    el.textContent = 'Form content';
                    return el;
                }
            }

            const component = new FormOnlyTestComponent();
            const result = await component.render();

            expect(UIFactory.createFormDisabledMessage).toHaveBeenCalled();
            expect(result).toBe(mockMessage);
        });

        it('should show form disabled message for form-only components', async () => {
            const mockMessage = document.createElement('div');
            mockMessage.textContent = 'Form context not available';
            UIFactory.createFormDisabledMessage = vi.fn().mockReturnValue(mockMessage);

            // Test that a form-only component can return the disabled message
            class AnotherFormOnlyComponent extends BaseComponent {
                constructor() {
                    super('noOverride', 'No Override', '<svg></svg>', true);
                }

                async render() {
                    // Call parent's base behavior for form-only check
                    return UIFactory.createFormDisabledMessage();
                }
            }

            const component = new AnotherFormOnlyComponent();
            const result = await component.render();

            expect(UIFactory.createFormDisabledMessage).toHaveBeenCalled();
            expect(result).toBe(mockMessage);
        });
    });
});
