Power-Toolkit/
├──  dist/                  # Build output for production (bookmarklet, extension)
│   ├── Power-Toolkit.min.js   # Minified, single-file bundle for the bookmarklet
│   └── extension/           # Unpacked files for the browser extension
│
|__ extension/
|   |__ icons/
|   |__ background.js
|   |__ manifest.json
|
├── src/                     # All development source code lives here
│   ├── App.js               # Main application controller (initializes and registers components)
│   ├── Main.js              # Entry point wrapper (IIFE for bookmarklet/injection)
│   │
│   ├── core/                # 🏛️ Core architectural modules
│   │   ├── UIManager.js       # Manages the main UI dialog, tabs, events, and lifecycle
│   │   ├── store.js           # Centralized state management (theme, settings)
│   │   ├── baseComponent.js   # The abstract base class all feature components inherit from
│   │   └── componentRegistry.js # Manages the registration and retrieval of components
│   │
│   ├── services/            # 📡 Cross-cutting concerns and external interactions
│   │   ├── powerappsApiService.js # Abstraction layer for all Xrm API calls
│   │   ├── dataService.js       # Handles all data fetching and caching logic
│   │   ├── notificationService.js # Manages toast/pop-up notifications
│   │   └── dialogService.js     # Manages modal dialog windows
│   │
│   ├── components/          # 🧩 Individual feature components (the "tabs")
│   │   ├── inspectorTab.js
│   │   ├── formColumnsTab.js
│   │   ├── automationTab.js
│   │   ├── eventMonitorTab.js
│   │   ├── pluginContextTab.js
│   │   ├── webApiExplorerTab.js
│   │   ├── fetchXmlTesterTab.js
│   │   ├── envVarsTab.js
│   │   ├── pluginTraceLogTab.js
│   │   ├── userContextTab.js
│   │   ├── codeHubTab.js
│   │   ├── performanceTab.js
│   │   ├── settingsTab.js
│   │   ├── helpTab.js
│   │   ├── aboutTab.js
│   │   └── # Add any new feature tabs here...
│   │
│   ├── ui/                  # 🎨 UI-specific helpers and factories
│   │   ├── styleManager.js    # Injects the application's CSS into the page
│   │   ├── uiFactory.js       # Creates common reusable UI elements (e.g., code blocks)
│   │   └── formControlFactory.js # Creates specific form inputs for dialogs
│   │
│   ├── utils/               # 🛠️ General utility functions and configuration
│   │   ├── config.js          # Global configuration (version, author, etc.)
│   │   ├── icons.js           # Central repository for all SVG icons
│   │   └── helpers.js         # Common helper functions (debounce, copyToClipboard, etc.)
│   │
│   └── assets/              # 🖼️ Static assets
│       └── styles.css         # All CSS styles, extracted from the original script
│
├── .gitignore               # Specifies files for Git to ignore
├── package.json             # Project metadata, dependencies, and build scripts
├── webpack.config.js        # Build configuration (e.g., for bundling files into one)
└── README.md                # Project documentation and setup instructions