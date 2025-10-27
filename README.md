# Power-Toolkit for Power Apps & Dataverse

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)

**Power-Toolkit** is a comprehensive, client-side developer tool designed to accelerate the development and debugging of Power Apps Model-Driven Apps. Built as a browser extension, it provides a suite of powerful features to inspect, debug, and manipulate form data, metadata, and server-side processes in real-time, directly within your browser.

---

## ✨ Key Features

The toolkit is organized into a clear, tab-based interface, with each tab providing a distinct and powerful capability:

### 🔍 Live Form Inspection & Editing
* **Inspector:** Real-time tree view of the form's UI hierarchy (Tabs → Sections → Controls)
* **Form Columns:** Interactive grid of all form attributes with live editing capabilities
* **Event Monitor:** Live console that logs `OnLoad`, `OnSave`, and `OnChange` events as they happen

### ⚙️ Automation & Logic Debugging
* **Form Automation:** View, manage, activate, and deactivate Business Rules for any table. Inspect the underlying JavaScript logic. Lists static `OnLoad`/`OnSave` event handlers
* **Plugin Context:** Simulate the `Target`, `PreEntityImage`, and `PostEntityImage` sent to server-side plugins. Includes a C# unit test generator for FakeXrmEasy
* **Plugin Traces:** Real-time viewer for server-side Plugin Trace Logs with live polling, powerful filtering, and search capabilities

### 📊 Data & API Interaction
* **WebAPI Explorer:** Full-featured client to execute GET, POST, PATCH, and DELETE requests against the Dataverse Web API with intelligent query building
* **FetchXML Tester:** Powerful builder and editor to write, format, and execute FetchXML queries with syntax highlighting
* **Metadata Browser:** Complete, searchable dictionary of all tables and columns in the environment

### 🔐 Security & Configuration
* **Impersonate:** Test security roles by executing all tool operations as another user (requires impersonation privileges)
* **User Context:** Detailed breakdown of the current (or impersonated) user's security roles, including those inherited from teams, with organization and session details
* **Environment Variables:** View, create, and edit all Environment Variables and their current values with schema name validation

### 📈 Performance & Development
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

### Quick Tips
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
│   ├── utils/             # Utilities (builders, parsers, validators)
│   ├── constants/         # Configuration and constants
│   ├── core/              # Base classes and core infrastructure
│   ├── data/              # Static data (code snippets, etc.)
│   ├── assets/            # Styles, icons, and static assets
│   ├── App.js             # Main application entry point
│   └── Main.js            # Bootstrap and initialization
├── extension/
│   ├── manifest.json      # Extension manifest
│   ├── background.js      # Service worker
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
import { Config } from '../constants/index.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { UIFactory } from '../ui/UIFactory.js';

export class MyCustomTab extends BaseComponent {
    constructor() {
        super('mycustomtab'); // Unique tab ID
    }

    /**
     * Render the tab's UI
     * @returns {string} HTML content for the tab
     */
    render() {
        return `
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
    }

    /**
     * Attach event listeners after render
     */
    attachEventListeners() {
        const executeBtn = this.getElement('#my-execute-btn');
        const inputField = this.getElement('#my-input');
        
        executeBtn?.addEventListener('click', () => this._handleExecute());
        
        // Add Enter key support
        inputField?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleExecute();
            }
        });
    }

    /**
     * Handle execute button click
     * @private
     */
    async _handleExecute() {
        const input = this.getElement('#my-input')?.value?.trim();
        
        if (!input) {
            NotificationService.show('Please enter a value', 'error');
            return;
        }

        const executeBtn = this.getElement('#my-execute-btn');
        const resultContainer = this.getElement('#my-result-container');

        try {
            // Show loading state
            executeBtn.disabled = true;
            executeBtn.textContent = 'Processing...';
            
            // Your business logic here
            const result = await DataService.retrieveRecord('account', input);
            
            // Display results
            resultContainer.innerHTML = '';
            resultContainer.appendChild(
                UIFactory.createCopyableCodeBlock(
                    JSON.stringify(result, null, 2),
                    'json'
                )
            );
            
            NotificationService.show('Operation completed successfully', 'success');
            
        } catch (error) {
            NotificationService.show(`Error: ${error.message}`, 'error');
            resultContainer.innerHTML = `
                <div class="pdt-card error">
                    <p><strong>Error:</strong> ${error.message}</p>
                </div>
            `;
        } finally {
            // Reset button state
            executeBtn.disabled = false;
            executeBtn.textContent = 'Execute';
        }
    }
}
```

### Step 2: Register Your Tab

Open `src/core/ComponentRegistry.js` and import your component:

```javascript
import { MyCustomTab } from '../components/MyCustomTab.js';
```

Then add it to the registry:

```javascript
export function registerAllComponents() {
    ComponentRegistry.register('mycustomtab', MyCustomTab);
    // ... other components
}
```

### Step 3: Add Tab to UI

Open `src/App.js` and add your tab to the tabs array:

```javascript
this.tabs = [
    { id: 'inspector', label: 'Inspector', icon: '🔍' },
    // ... other tabs
    { id: 'mycustomtab', label: 'My Custom', icon: '🎯' },
    // ... remaining tabs
];
```

### Step 4: Update Constants (Optional)

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

### Step 5: Add Styles (Optional)

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

### Step 6: Test Your Tab

1. Run `npm run dev` to start development mode
2. Reload the extension in your browser
3. Open Power-Toolkit and navigate to your new tab
4. Test all functionality and error handling

### Best Practices for Tab Development

#### 1. Follow the BaseComponent Pattern
- Extend `BaseComponent` for automatic lifecycle management
- Use `render()` for HTML generation
- Use `attachEventListeners()` for event binding
- Use `getElement(selector)` helper for DOM queries

#### 2. Use Existing Services
- **DataService:** All Dataverse CRUD operations
- **NotificationService:** User notifications (success/error/info/warn)
- **MetadataService:** Entity and attribute metadata
- **PowerAppsApiService:** Xrm.Page and context operations

#### 3. Error Handling
- Always wrap async operations in try-catch
- Use `NotificationService` for user-facing errors
- Provide helpful error messages
- Reset UI state in `finally` blocks

#### 4. UI Consistency
- Use existing CSS classes from `style.css`:
  - `.pdt-section` for main containers
  - `.pdt-card` for content cards
  - `.pdt-button` for buttons (add `primary` for primary actions)
  - `.pdt-input-group` for form inputs
  - `.pdt-note` for helper text
- Follow the established color scheme (use CSS custom properties)
- Use `UIFactory` for common UI elements (code blocks, info grids, etc.)

#### 5. Accessibility
- Use semantic HTML
- Add ARIA labels where appropriate
- Ensure keyboard navigation works
- Test with screen readers

#### 6. Performance
- Debounce expensive operations (use `PerformanceHelpers.debounce()`)
- Cache results when appropriate
- Use pagination for large datasets
- Show loading indicators for async operations

### Example: Using Helper Functions

Power-Toolkit provides many helper utilities in `src/helpers/`:

```javascript
import { 
    escapeHtml,           // Safe HTML escaping
    isValidGuid,          // GUID validation
    formatDisplayValue,   // Format attribute values
    normalizeGuid,        // Clean GUID formatting
    copyToClipboard      // Clipboard operations
} from '../helpers/index.js';

// Usage
const safeText = escapeHtml(userInput);
const isValid = isValidGuid(recordId);
const displayText = formatDisplayValue(attribute.getValue(), attribute);
```

### Testing Checklist

Before submitting your tab:

- [ ] Tab renders correctly
- [ ] All buttons and inputs work as expected
- [ ] Error handling displays appropriate messages
- [ ] Loading states provide visual feedback
- [ ] Results display correctly (table/JSON views if applicable)
- [ ] Dark and light themes both look good
- [ ] No console errors
- [ ] Code follows existing patterns and style
- [ ] Comments and JSDoc added for public methods

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
