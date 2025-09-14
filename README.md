# Power-Toolkit for Power Apps

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/version-20.5-blue.svg)

A comprehensive, client-side toolkit for Power Apps Model-Driven App developers. This tool provides a suite of powerful features to inspect, debug, and manipulate form data and metadata in real-time, directly within the browser. It can be run as a simple bookmarklet or installed as a browser extension for easier access.



---

## ✨ Features

The Power-Toolkit is organized into several powerful tabs, each designed to address a common development challenge:

* **Inspector:** View the entire form's component hierarchy (tabs, sections, controls) and edit field values on the fly.
* **Form Columns:** Get a simple, sortable list of all attributes on the form, including their logical names, values, and dirty state.
* **Form Automation:** See all active Business Rules and client-side Form Event Handlers (OnLoad, OnSave) in one place.
* **Event Monitor:** A live console that logs form events like OnLoad, OnSave, and OnChange as they happen.
* **Plugin Context:** Simulate the `Target`, `PreEntityImage`, and `PostEntityImage` that would be sent to a server-side plugin on Create, Update, or Delete.
* **WebAPI Explorer:** A full client to execute GET, POST, PATCH, and DELETE requests against the Dataverse Web API.
* **FetchXML Tester:** Write, format, and execute FetchXML queries directly in the browser and see the results instantly.
* **Plugin Traces:** A real-time debugger for server-side code with live polling and filtering for Plugin Trace Logs.
* **Environment Variables:** View all Environment Variables and their current values in the environment.
* **User Context:** Quickly see your User ID, security roles, client version, and organization details.
* **Code Hub:** A handy library of common JavaScript snippets for client-side development.
* **Performance:** Analyze form load times and see a breakdown of UI component complexity.
* **Settings:** Customize the toolkit by reordering, hiding tabs, and importing/exporting your configuration.

---

## 🚀 Installation & Usage

You can use the Power-Toolkit in two ways: as a quick-use bookmarklet or as a more permanent browser extension.

### Method 1: As a Bookmarklet (Quick Use)

This is the fastest way to get started.

1.  **Copy the Code:** Open the `dist/Power-Toolkit.bundle.js` file in this repository. Copy the entire content of the file.
2.  **Create a New Bookmark:** In your browser, create a new bookmark.
3.  **Edit the Bookmark:**
    * For the **Name**, type `Power-Toolkit`.
    * For the **URL** or **Address**, paste the code you copied, and **make sure to add `javascript:` at the very beginning**.
    * Example: `javascript:(function(){...})();`
4.  **Save and Run:** Save the bookmark. Navigate to any Power Apps Model-Driven App form or view and click the bookmark to launch the tool.

### Method 2: As a Browser Extension (Recommended)

Installing as an unpacked extension is more convenient for regular use.

**For Chrome or Edge:**

1.  **Download the Code:** Download this repository as a ZIP file and unzip it, or clone it using Git.
2.  **Navigate to Extensions:** Open your browser and go to `chrome://extensions` (for Chrome) or `edge://extensions` (for Edge).
3.  **Enable Developer Mode:** In the top-right corner, turn on the "Developer mode" toggle.
4.  **Load the Extension:**
    * Click the "**Load unpacked**" button that appears.
    * In the file dialog, navigate to and select the `dist/extension` folder from the project files you downloaded.
5.  **Launch:** The Power-Toolkit icon will appear in your browser's toolbar. Navigate to a Model-Driven App and click the icon to launch the tool.

---

## 💻 Development & Building from Source

If you want to contribute or customize the toolkit, you can build it from the source files.

### Prerequisites

* [Node.js](https://nodejs.org/) (which includes npm)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/Power-Toolkit.git](https://github.com/your-username/Power-Toolkit.git)
    cd Power-Toolkit
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running in Development Mode

This command will start webpack in "watch mode." It will automatically re-bundle the files in the `dist` folder every time you save a change in the `src` directory.

```bash
npm run dev

Building for Production
This command will bundle and minify all source files, creating the final production-ready assets in the dist folder.
npm run build

🏗️ Project Structure
The project is organized with a clear separation of concerns to make it maintainable and extensible.

src/: Contains all the raw, modular source code.

assets/: Static files like the main CSS stylesheet.

components/: Each feature tab is a self-contained component.

core/: The core application architecture (UI Manager, State Store, etc.).

services/: Modules for handling external interactions (Dataverse API, notifications).

ui/: UI helper factories for creating common elements like code blocks.

utils/: Generic helper functions and configuration files.

app.js: The main application controller that assembles all the modules.

main.js: The final entry point that safely initializes the app.

dist/: Contains the final, bundled output from the build process. This is what you use.


📜 License
This project is licensed under the MIT License.