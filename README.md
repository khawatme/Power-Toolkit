# Power-Toolkit for Power Apps & Dynamics 365

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

**Power-Toolkit** is a comprehensive, client-side developer tool designed to accelerate the development and debugging of Power Apps Model-Driven Apps. Built as a browser extension, it provides a suite of powerful features to inspect, debug, and manipulate form data, metadata, and server-side processes in real-time, directly within your browser.

---

## ✨ Key Features

The toolkit is organized into a clear, tab-based interface, with each tab providing a distinct and powerful capability:

### 🔍 Live Form Inspection & Editing
* **Inspector:** Real-time tree view of the form's UI hierarchy (Tabs → Sections → Controls)
* **Form Columns:** Interactive grid of all form attributes with live editing capabilities
* **Event Monitor:** Live console that logs `OnLoad`, `OnSave`, and `OnChange` events as they happen

### ⚙️ Automation & Logic Debugging
* **Automation:** View, manage, activate, and deactivate Business Rules for any table. Inspect the underlying JavaScript logic. Lists static `OnLoad`/`OnSave` event handlers
* **Plugin Context:** Simulate the `Target`, `PreEntityImage`, and `PostEntityImage` sent to server-side plugins. Includes a C# unit test generator for FakeXrmEasy
* **Plugin Trace Logs:** Real-time viewer for server-side Plugin Trace Logs with live polling, powerful filtering, and search capabilities

### 📊 Data & API Interaction
* **WebAPI Explorer:** Full-featured client to execute GET, POST, PATCH, and DELETE requests against the Dataverse Web API with intelligent query building
* **FetchXML Tester:** Powerful builder and editor to write, format, and execute FetchXML queries with syntax highlighting
* **Metadata Browser:** Complete, searchable dictionary of all tables and columns in the environment

### 🔐 Security & Configuration
* **Impersonate:** Test security roles by executing all tool operations as another user (requires impersonation privileges)
* **User Context:** Detailed breakdown of the current (or impersonated) user's security roles, including those inherited from teams, with organization and session details
* **Environment Variables:** View, create, and edit all Environment Variables and their current values with schema name validation
* **Solution Layers:** View and manage solution layers for customizations, delete active layer customizations

### 🚀 Performance & Development
* **Performance:** Analyze form load times with breakdown by network, server, and client processing
* **Code Hub:** Library of modern JavaScript code snippets for common Dataverse operations
* **Settings:** Customizable dark/light themes, adjustable font sizes, and preference management

---

## 🚀 Installation

### Option 1: Browser Extension (Recommended)

Install directly from your browser's extension store:

#### Microsoft Edge
[Install from Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/powertoolkit-for-power-a/bcdhpcgnalcckffananlnedhcedfadhg)

#### Google Chrome
[Install from Chrome Web Store](https://chromewebstore.google.com/detail/power-toolkit-for-power-a/pohgckfkhjeahcjnmihobcoccpccgpca)

### Option 2: Load Unpacked (Development)

1. Download or clone this repository
2. Run `npm install` and `npm run build`
3. Open your browser's extension management page:
   - **Edge:** `edge://extensions/`
   - **Chrome:** `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the `extension/` folder

---

## 💡 Quick Tips

- **Dark/Light Theme:** Toggle in Settings tab or use the theme icon
- **Hide System Fields:** Enable in WebAPI Explorer and FetchXML Tester to filter out OData properties
- **Impersonation:** Set a user in the Impersonate tab to test their security context across all features
- **Copy Results:** Use copy buttons in result panels to quickly grab data

---

## 💻 Development & Contribution

Contributions are welcome! Whether you want to fix a bug, add a new feature, or create a new tab, this guide will help you get started.

### Prerequisites
* [Node.js](https://nodejs.org/) (v14 or higher, includes npm)
* [Git](https://git-scm.com/)
* A code editor (VS Code recommended)

### Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/khawatme/Power-Toolkit.git
   cd Power-Toolkit
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Development Mode:**
   Watch for changes and auto-rebuild:
   ```bash
   npm run dev
   ```

4. **Build for Production:**
   Create optimized bundle:
   ```bash
   npm run build
   ```

### Project Structure

```
Power-Toolkit/
├── src/
│   ├── components/        # Tab components (e.g., InspectorTab.js)
│   ├── services/          # Business logic services
│   ├── helpers/           # Utility functions (modular)
│   ├── ui/                # UI factories and controls
│   ├── utils/             # Utilities
│   │   ├── builders/      # ODataQueryBuilder
│   │   ├── parsers/       # ErrorParser
│   │   ├── resolvers/     # EntityContextResolver
│   │   ├── testing/       # Testing utilities
│   │   └── ui/            # BusyIndicator, PreferencesHelper, ResultPanel
│   ├── constants/         # Configuration and constants
│   ├── core/              # Base classes and core infrastructure
│   ├── data/              # Static data (code snippets, etc.)
│   ├── assets/            # Styles, icons, and static assets
│   ├── App.js             # Main application entry point
│   └── Main.js            # Bootstrap and initialization
├── extension/
│   ├── manifest.json      # Extension manifest
│   ├── background.cjs      # Service worker
│   └── icons/             # Extension icons
├── webpack.config.js      # Webpack configuration
└── package.json           # Dependencies and scripts
```

---

## 🛠️ How to Implement a New Tab

Adding a new tab to Power-Toolkit is straightforward thanks to the modular architecture. Follow these steps:

### Step 1: Create Your Tab Component

Create a new file in `src/components/` (e.g., `MyCustomTab.js`):

```javascript
/**
 * @file MyCustomTab - Description of what your tab does
 * @module components/MyCustomTab
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { escapeHtml } from '../helpers/dom.helpers.js';

export class MyCustomTab extends BaseComponent {
    constructor() {
        super('mycustomtab', 'My Custom', ICONS.myIcon); // id, label, icon

        this.ui = {}; // Store DOM references

        // Handler references for cleanup (IMPORTANT: Prevents memory leaks)
        /** @private {Function|null} */ this._executeHandler = null;
        /** @private {Function|null} */ this._inputKeydownHandler = null;
    }

    /**
     * Render the tab's UI
     * @returns {Promise<HTMLElement>} The root element
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="pdt-section">
                <div class="pdt-section-header">
                    <h3>My Custom Feature</h3>
                    <p class="pdt-note">Description of what this tab does</p>
                </div>
                
                <div class="pdt-card">
                    <div class="pdt-input-group">
                        <label for="my-input">Input Label:</label>
                        <input type="text" id="my-input" placeholder="Enter something...">
                    </div>
                    
                    <div class="pdt-button-group">
                        <button id="my-execute-btn" class="pdt-button primary">
                            Execute
                        </button>
                    </div>
                </div>
                
                <div id="my-result-container"></div>
            </div>
        `;
        
        return container;
    }

    /**
     * Post-render lifecycle hook - called after DOM is attached
     * IMPORTANT: Store handlers as instance properties for cleanup in destroy()
     * @param {HTMLElement} element - The root element
     */
    postRender(element) {
        // Cache DOM references
        this.ui = {
            executeBtn: element.querySelector('#my-execute-btn'),
            inputField: element.querySelector('#my-input'),
            resultContainer: element.querySelector('#my-result-container')
        };
        
        // Store handlers for cleanup
        this._executeHandler = () => this._handleExecute();
        this._inputKeydownHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleExecute();
            }
        };
        
        // Attach listeners
        this.ui.executeBtn?.addEventListener('click', this._executeHandler);
        this.ui.inputField?.addEventListener('keydown', this._inputKeydownHandler);
    }

    /**
     * Handle execute button click
     * @private
     */
    async _handleExecute() {
        const input = this.ui.inputField?.value?.trim();
        
        if (!input) {
            NotificationService.show('Please enter a value', 'error');
            return;
        }

        try {
            // Show loading state
            this.ui.executeBtn.disabled = true;
            this.ui.executeBtn.textContent = 'Processing...';
            
            // Your business logic here
            const result = await DataService.retrieveRecord('account', input);
            
            // Display results
            this.ui.resultContainer.innerHTML = '';
            this.ui.resultContainer.appendChild(
                UIFactory.createCopyableCodeBlock(
                    JSON.stringify(result, null, 2),
                    'json'
                )
            );
            
            NotificationService.show('Operation completed successfully', 'success');
            
        } catch (error) {
            NotificationService.show(`Error: ${error.message}`, 'error');
            this.ui.resultContainer.innerHTML = `
                <div class="pdt-card error">
                    <p><strong>Error:</strong> ${escapeHtml(error.message)}</p>
                </div>
            `;
        } finally {
            // Reset button state
            this.ui.executeBtn.disabled = false;
            this.ui.executeBtn.textContent = 'Execute';
        }
    }

    /**
     * Lifecycle hook for cleaning up event listeners
     * CRITICAL: Always implement this to prevent memory leaks
     */
    destroy() {
        if (this.ui.executeBtn) {
            this.ui.executeBtn.removeEventListener('click', this._executeHandler);
        }
        if (this.ui.inputField) {
            this.ui.inputField.removeEventListener('keydown', this._inputKeydownHandler);
        }
    }
}
```

### Step 2: Register Your Tab

Open `src/App.js` and import your component:

```javascript
import { MyCustomTab } from './components/MyCustomTab.js';
```

Then add it to the `_registerComponents()` method:

```javascript
_registerComponents() {
    // Existing components...
    ComponentRegistry.register(new MyCustomTab());
    // ... other components
}
```

**Note:** The tab metadata (id, label, icon) is defined in your component's constructor via `super()`. The `UIManager` automatically discovers all registered components, so no separate tab array is needed.

### Step 3: Update Constants (Optional)

If your tab needs custom messages or configuration, add them to `src/constants/`:

**messages.js:**
```javascript
export const MESSAGES = {
    // ... existing messages
    MY_CUSTOM_TAB: {
        successMessage: 'Operation completed successfully',
        errorMessage: 'Failed to process request',
        validationError: 'Invalid input provided'
    }
};
```

### Step 4: Add Styles (Optional)

If you need custom styles, add them to `src/assets/style.css`:

```css
/* My Custom Tab Styles */
#my-result-container {
    margin-top: 1rem;
    max-height: 400px;
    overflow-y: auto;
}

.my-custom-class {
    /* Your custom styles */
}
```

### Step 5: Test Your Tab

1. Run `npm run dev` to start development mode
2. Reload the extension in your browser
3. Open Power-Toolkit and navigate to your new tab
4. Test all functionality and error handling

### Best Practices for Tab Development

#### 1. **Memory Leak Prevention (CRITICAL)**
**Always implement proper cleanup to prevent memory leaks!**

```javascript
// ✅ CORRECT Pattern
constructor() {
    super('mytab', 'My Tab', ICONS.myIcon);
    this.ui = {};
    // Initialize ALL handler properties to null
    /** @private {Function|null} */ this._myHandler = null;
}

postRender(element) {
    // Store handler as instance property
    this._myHandler = () => { /* handler code */ };
    element.addEventListener('click', this._myHandler);
}

destroy() {
    // Remove listener using stored reference
    if (element) {
        element.removeEventListener('click', this._myHandler);
    }
}

// ❌ WRONG - Memory leak!
postRender(element) {
    // Anonymous function - can't be removed later
    element.addEventListener('click', () => { /* handler code */ });
}
```

**Key Rules:**
- ✅ Always store event handlers as instance properties
- ✅ Always implement `destroy()` method
- ✅ Remove ALL event listeners in `destroy()`
- ✅ Initialize handler properties in constructor with JSDoc
- ✅ Use instance properties, avoid closures that capture scope
- ❌ Never use anonymous functions with addEventListener
- ❌ Never use inline onclick assignments

#### 2. Follow the BaseComponent Pattern
- Extend `BaseComponent` for automatic lifecycle management
- Constructor: Call `super(id, label, icon)` with tab metadata
- Use `async render()` to create and return HTMLElement
- Use `postRender(element)` to cache DOM refs and attach event listeners
- Use `destroy()` for cleanup (memory leak prevention)
- Store DOM references in `this.ui = {}` during postRender

#### 3. Use Existing Services
- **DataService:** All Dataverse CRUD operations
- **NotificationService:** User notifications (success/error/info/warn)
- **MetadataService:** Entity and attribute metadata
- **PowerAppsApiService:** Xrm.Page and context operations

#### 4. Lifecycle Management
- **Constructor:** Call `super(id, label, icon)`, initialize `this.ui = {}` and handler properties to `null`
- **render():** Create DOM structure, return HTMLElement (can be async)
- **postRender(element):** Cache DOM refs in `this.ui`, store handlers as instance properties, attach listeners
- **destroy():** Remove ALL event listeners using cached refs

#### 5. Error Handling
- Always wrap async operations in try-catch
- Use `NotificationService` for user-facing errors
- Provide helpful error messages
- Reset UI state in `finally` blocks

#### 6. UI Consistency
- Use existing CSS classes from `style.css`:
  - `.pdt-section` for main containers
  - `.pdt-card` for content cards
  - `.pdt-button` for buttons (add `primary` for primary actions)
  - `.pdt-input-group` for form inputs
  - `.pdt-note` for helper text
- Follow the established color scheme (use CSS custom properties)
- Use `UIFactory` for common UI elements (code blocks, info grids, etc.)

#### 7. Accessibility
- Use semantic HTML
- Add ARIA labels where appropriate
- Ensure keyboard navigation works
- Test with screen readers

#### 8. Performance
- Debounce expensive operations (use `PerformanceHelpers.debounce()`)
- Cache results when appropriate
- Use pagination for large datasets
- Show loading indicators for async operations

### Example: Using Helper Functions

Power-Toolkit provides many helper utilities in `src/helpers/`:

```javascript
import { escapeHtml, createElement } from '../helpers/dom.helpers.js';
import { isValidGuid, normalizeGuid } from '../helpers/index.js';
import { formatDisplayValue } from '../helpers/formatting.helpers.js';
import { copyToClipboard } from '../helpers/file.helpers.js';

// Usage
const safeText = escapeHtml(userInput);
const isValid = isValidGuid(recordId);
const displayText = formatDisplayValue(attribute.getValue(), attribute);
```

### Memory Leak Prevention Patterns

Power-Toolkit follows strict memory management patterns. Here are common patterns:

#### Pattern 1: Simple Event Handlers
```javascript
constructor() {
    super('mytab', 'My Tab', ICONS.myIcon);
    this.ui = {};
    /** @private {Function|null} */ this._clickHandler = null;
}

postRender(element) {
    this.ui.button = element.querySelector('#my-button');
    this._clickHandler = () => { /* code */ };
    this.ui.button?.addEventListener('click', this._clickHandler);
}

destroy() {
    if (this.ui.button) {
        this.ui.button.removeEventListener('click', this._clickHandler);
    }
}
```

#### Pattern 2: Delegated Event Handlers
```javascript
constructor() {
    super('mytab', 'My Tab', ICONS.myIcon);
    this.ui = {};
    /** @private {Function|null} */ this._delegatedHandler = null;
}

postRender(element) {
    this.ui.container = element.querySelector('#container');
    this._delegatedHandler = (e) => {
        const target = e.target.closest('.my-item');
        if (target) { /* handle */ }
    };
    this.ui.container?.addEventListener('click', this._delegatedHandler);
}

destroy() {
    if (this.ui.container) {
        this.ui.container.removeEventListener('click', this._delegatedHandler);
    }
}
```

#### Pattern 3: Debounced Handlers
```javascript
import { debounce } from '../helpers/index.js';

constructor() {
    super('mytab', 'My Tab', ICONS.myIcon);
    this.ui = {};
    /** @private {Function|null} */ this._debouncedSearch = null;
}

postRender(element) {
    this.ui.searchInput = element.querySelector('#search-input');
    this._debouncedSearch = debounce(() => {
        // Search logic
    }, 250);
    this.ui.searchInput?.addEventListener('input', this._debouncedSearch);
}

destroy() {
    if (this.ui.searchInput) {
        this.ui.searchInput.removeEventListener('input', this._debouncedSearch);
    }
}
```

#### Pattern 4: Document-Level Events
```javascript
constructor() {
    super('mytab', 'My Tab', ICONS.myIcon);
    this.ui = {};
    /** @private {Function|null} */ this._globalHandler = null;
}

postRender(element) {
    this._globalHandler = (e) => { /* code */ };
    document.addEventListener('pdt:refresh', this._globalHandler);
}

destroy() {
    // IMPORTANT: Remove document-level listeners!
    document.removeEventListener('pdt:refresh', this._globalHandler);
}
```

#### Pattern 5: Multiple Inputs with Same Handler
```javascript
constructor() {
    super('mytab', 'My Tab', ICONS.myIcon);
    this.ui = {};
    /** @private {Function|null} */ this._inputHandler = null;
}

postRender(element) {
    this.ui.inputs = [
        element.querySelector('#input1'),
        element.querySelector('#input2'),
        element.querySelector('#input3')
    ];
    
    this._inputHandler = () => this._updatePreview();
    
    this.ui.inputs.forEach(input => {
        input?.addEventListener('input', this._inputHandler);
    });
}

destroy() {
    this.ui.inputs?.forEach(input => {
        if (input) {
            input.removeEventListener('input', this._inputHandler);
        }
    });
}
```

**Common Mistakes to Avoid:**
```javascript
// ❌ WRONG: Closure captures scope - memory leak
postRender(element) {
    const data = this.getData();
    const button = element.querySelector('#my-button');
    button.addEventListener('click', () => {
        console.log(data); // Captures 'data' and 'this'
    });
}

// ✅ CORRECT: Use instance property
constructor() {
    super('mytab', 'My Tab', ICONS.myIcon);
    this.ui = {};
    /** @private {Function|null} */ this._buttonHandler = null;
}
postRender(element) {
    this.ui.button = element.querySelector('#my-button');
    this._buttonHandler = () => {
        console.log(this.getData()); // No closure leak
    };
    this.ui.button.addEventListener('click', this._buttonHandler);
}
```

### Testing Checklist

Before submitting your tab:

- [ ] `destroy()` method implemented with all event listener cleanup
- [ ] All handlers stored as instance properties (no anonymous functions)
- [ ] Handler properties initialized in constructor
- [ ] Tab renders correctly
- [ ] All buttons and inputs work as expected
- [ ] Error handling displays appropriate messages
- [ ] Loading states provide visual feedback
- [ ] Results display correctly (table/JSON views if applicable)
- [ ] Dark and light themes both look good
- [ ] No console errors or memory leaks
- [ ] Code follows existing patterns and style
- [ ] Comments and JSDoc added for public methods
- [ ] Tested tab switching multiple times (verify no memory leaks)

---

## 🧪 Testing

Power-Toolkit uses **Vitest** as its testing framework with comprehensive test coverage. All tests run in a simulated browser environment using **happy-dom**.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/ui/FilterGroupManager.test.js

# Run tests matching a pattern
npm test -- --grep "SmartValueInput"
```

### Test Structure

Tests are organized to mirror the source code structure:

```
tests/
├── setup.js                    # Global test setup and mocks
├── components/                 # Tab component tests
│   ├── InspectorTab.test.js
│   ├── WebApiExplorerTab.test.js
│   ├── FetchXmlTesterTab.test.js
│   └── ...
├── services/                   # Service layer tests
│   ├── DataService.test.js
│   ├── MetadataService.test.js
│   ├── NotificationService.test.js
│   └── ...
├── helpers/                    # Helper function tests
│   ├── dom.helpers.test.js
│   ├── string.helpers.test.js
│   └── ...
├── ui/                         # UI component tests
│   ├── FilterGroupManager.test.js
│   ├── SmartValueInput.test.js
│   ├── FormControlFactory.test.js
│   └── ...
└── utils/                      # Utility tests
    ├── ui/
    │   ├── BusyIndicator.test.js
    │   ├── PreferencesHelper.test.js
    │   └── ResultPanel.test.js
    └── parsers/
        └── ...
```

### Writing Tests

#### Basic Test Structure

```javascript
/**
 * @file Tests for MyComponent
 * @module tests/components/MyComponent.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MyComponent } from '../../src/components/MyComponent.js';

describe('MyComponent', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        component = new MyComponent();
    });

    afterEach(() => {
        component?.cleanup?.();
    });

    describe('constructor', () => {
        it('should initialize with correct defaults', () => {
            expect(component.id).toBe('mycomponent');
            expect(component.ui).toEqual({});
        });
    });

    describe('render', () => {
        it('should create container element', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
            expect(element.querySelector('.my-class')).toBeTruthy();
        });
    });

    describe('_handleClick', () => {
        it('should process data correctly', () => {
            const result = component._handleClick('test');
            expect(result).toBe('expected');
        });
    });
});
```

#### Mocking Services

```javascript
import { vi } from 'vitest';

// Mock a service before importing the component
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        retrieveRecord: vi.fn().mockResolvedValue({ name: 'Test' }),
        fetchRecords: vi.fn().mockResolvedValue([])
    }
}));

// Import component after mocks
import { MyComponent } from '../../src/components/MyComponent.js';
import { DataService } from '../../src/services/DataService.js';

describe('MyComponent with mocked service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call DataService with correct params', async () => {
        const component = new MyComponent();
        await component._loadData('account');
        
        expect(DataService.retrieveRecord).toHaveBeenCalledWith('account');
    });

    it('should handle service errors', async () => {
        DataService.retrieveRecord.mockRejectedValue(new Error('API Error'));
        
        const component = new MyComponent();
        await expect(component._loadData()).rejects.toThrow('API Error');
    });
});
```

#### Testing DOM Interactions

```javascript
describe('DOM interactions', () => {
    let component;
    let container;

    beforeEach(async () => {
        component = new MyComponent();
        container = await component.render();
        document.body.appendChild(container);
        component.postRender(container);
    });

    afterEach(() => {
        component.cleanup?.();
        container?.remove();
    });

    it('should update UI on button click', () => {
        const button = container.querySelector('#my-button');
        const output = container.querySelector('#output');
        
        button.click();
        
        expect(output.textContent).toBe('Clicked!');
    });

    it('should handle input changes', () => {
        const input = container.querySelector('#my-input');
        
        input.value = 'test value';
        input.dispatchEvent(new Event('input'));
        
        expect(component.currentValue).toBe('test value');
    });
});
```

#### Testing Async Operations

```javascript
describe('async operations', () => {
    it('should show loading state during fetch', async () => {
        // Delay the mock response
        DataService.fetchRecords.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve([]), 100))
        );

        const component = new MyComponent();
        const container = await component.render();
        
        const loadPromise = component._loadData();
        
        // Check loading state
        expect(container.querySelector('.loading')).toBeTruthy();
        
        await loadPromise;
        
        // Check loading cleared
        expect(container.querySelector('.loading')).toBeFalsy();
    });
});
```

### Testing Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Use descriptive test names** - `should show error when input is empty`
3. **One assertion per test** - Makes failures easier to diagnose
4. **Mock external dependencies** - Services, APIs, localStorage
5. **Clean up after tests** - Remove DOM elements, clear mocks
6. **Test edge cases** - Empty inputs, null values, error states
7. **Test accessibility** - ARIA attributes, keyboard navigation

### Adding Tests for a New Component

1. Create test file: `tests/components/MyNewTab.test.js`
2. Import dependencies and set up mocks
3. Write tests for:
   - Constructor initialization
   - `render()` output
   - `postRender()` event binding
   - User interactions (clicks, inputs)
   - Error handling
   - `cleanup()` method
4. Run tests: `npm test -- tests/components/MyNewTab.test.js`
5. Check coverage: `npm run test:coverage`

---

## 🤝 Contributing Guidelines

### Submitting Changes

1. **Fork the Repository**
2. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Make Your Changes** following the guidelines above
4. **Test Thoroughly** using the checklist
5. **Commit with Clear Messages:**
   ```bash
   git commit -m "Add: MyCustomTab for feature X"
   ```
6. **Push to Your Fork:**
   ```bash
   git push origin feature/my-new-feature
   ```
7. **Open a Pull Request** with a clear description of changes

### Code Standards

- Use ES6+ syntax
- Follow existing naming conventions (camelCase for variables/functions, PascalCase for classes)
- Add JSDoc comments for public methods
- Keep functions small and focused (single responsibility)
- Use meaningful variable names
- Avoid magic numbers (use constants)

### Commit Message Format

```
Type: Short description (50 chars max)

Longer description if needed (wrap at 72 chars)

Fixes #issue-number (if applicable)
```

**Types:** `Add`, `Fix`, `Update`, `Remove`, `Refactor`, `Docs`, `Style`

---

## 🐛 Reporting Issues

Found a bug? Have a feature request? Please open an issue with:

1. **Clear Title:** Brief description of the issue
2. **Environment:** Browser version, Power Apps version, extension version
3. **Steps to Reproduce:** Detailed steps to recreate the issue
4. **Expected Behavior:** What should happen
5. **Actual Behavior:** What actually happens
6. **Screenshots:** If applicable

---

## � License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built for the Power Platform community
- Inspired by real-world development challenges
- Powered by the Dataverse Web API and Xrm Client API

---


**Made with ❤️ for Power Platform Developers**
