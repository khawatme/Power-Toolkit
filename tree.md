# 🏛️ Power-Toolkit: Project Architecture

This document provides a high-level overview of the Power-Toolkit's source code architecture. The project follows a modern, modular design pattern to ensure maintainability and extensibility.

## Key Directories

* **`dist/`**: Contains the final, production-ready build output. This is the only directory end-users need to interact with.
    * `Power-Toolkit.min.js`: A minified, single-file bundle suitable for use as a bookmarklet.
    * `extension/`: The unpacked files required for installing the tool as a browser extension in Chrome, Edge, etc.

* **`extension/`**: Contains the static source files for the browser extension, such as the `manifest.json` and the `background.js` service worker. These files are copied into the `dist/extension` folder during the build process.

* **`src/`**: Contains all the raw, modular development source code.
    * `assets/`: Static assets, primarily the main `styles.css` file.
    * `core/`: The foundational architecture of the application, including the `UIManager`, state `Store`, and the `BaseComponent` that all feature tabs inherit from.
    * `services/`: Cross-cutting concerns and abstractions for external interactions. This includes the `PowerAppsApiService` (for all `Xrm` calls) and the `DataService` (for all Web API calls).
    * `components/`: Each feature tab is a self-contained, independent component module. This is where most of the tool's functionality lives.
    * `ui/`: UI-specific helper modules, such as the `UIFactory` for creating common elements like code blocks.
    * `utils/`: General, stateless utility functions and configuration files, such as `Helpers.js` and `Config.js`.

* **`App.js` & `Main.js`**: The primary entry points. `Main.js` provides a safe wrapper that waits for the Power Apps environment to be ready, and then `App.js` initializes the tool by registering all components and starting the UI.

## Build & Configuration

* **`webpack.config.js`**: The configuration file for Webpack, which bundles all the modules from `src/` into the final production files in `dist/`.
* **`package.json`**: Defines the project's metadata, dependencies (like Webpack), and provides the `npm` scripts (`dev`, `build`) for development.