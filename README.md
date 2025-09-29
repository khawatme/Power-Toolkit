# Power-Toolkit for Power Apps & Dataverse

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)

**Power-Toolkit** is a comprehensive, client-side developer tool designed to accelerate the development and debugging of Power Apps Model-Driven Apps. It provides a suite of powerful features to inspect, debug, and manipulate form data, metadata, and server-side processes in real-time, directly within your browser.

---

## ✨ Key Features

The toolkit is organized into a clear, tab-based interface, with each tab providing a distinct and powerful capability:

* **Live Form Inspection & Editing:**
    * **Inspector:** A real-time tree view of the form's UI hierarchy.
    * **Form Columns:** An interactive grid of all form attributes with live editing.
    * **Event Monitor:** A live console that logs `OnLoad`, `OnSave`, and `OnChange` events as they happen.

* **Automation & Logic Debugging:**
    * **Form Automation:** View, manage, activate, and deactivate Business Rules for any table. Inspect the underlying JavaScript logic of any rule. Also lists static `OnLoad`/`OnSave` event handlers.
    * **Plugin Context:** Simulate the `Target`, `PreEntityImage`, and `PostEntityImage` sent to server-side plugins. Includes a C# unit test generator for FakeXrmEasy.
    * **Plugin Traces:** A real-time viewer for server-side Plugin Trace Logs with live polling and powerful filtering.

* **Data & API Interaction:**
    * **WebAPI Explorer:** A full client to execute GET, POST, PATCH, and DELETE requests against the Dataverse Web API.
    * **FetchXML Tester:** A powerful builder and editor to write, format, and execute FetchXML queries.
    * **Metadata Browser:** A complete, searchable dictionary of all tables and columns in the environment.

* **Security & Configuration:**
    * **Impersonate:** Test security roles by executing all tool operations as another user.
    * **User Context:** View a detailed breakdown of the current (or impersonated) user's security roles, including those inherited from teams.
    * **Environment Variables:** View and edit all Environment Variables and their current values.

* **And More...** including a Performance analyzer, a library of modern JavaScript code snippets, and fully customizable settings.

---

## 🚀 Installation & Usage

You can use the Power-Toolkit as a simple bookmarklet for quick use or as a browser extension for a more integrated experience.


### Browser Extension

Installing it from Edge or Chrome Store.

**Microsoft Edge-Add-Ons:**
* [https://microsoftedge.microsoft.com/addons/detail/powertoolkit-for-power-a/bcdhpcgnalcckffananlnedhcedfadhg](Power-Toolkit on Edge)


**Chrome Web Store:**
* [https://chromewebstore.google.com/detail/power-toolkit-for-power-a/pohgckfkhjeahcjnmihobcoccpccgpca](Power-Toolkit on Chrome)

---

## 💻 Development & Contribution

Contributions are welcome! If you want to fix a bug or add a new feature, you can build the tool from its source files.

### Prerequisites
* [Node.js](https://nodejs.org/) (which includes npm)

### Setup
1.  **Clone & Install:**
    ```bash
    git clone [https://github.com/your-username/power-toolkit.git](https://github.com/your-username/power-toolkit.git)
    cd power-toolkit
    npm install
    ```
2.  **Run in Development Mode:** This command will watch for changes in the `src/` directory and automatically rebuild the files in `dist/`.
    ```bash
    npm run dev
    ```
3.  **Build for Production:** This command will bundle and minify all source files for release.
    ```bash
    npm run build
    ```
---

## 📜 License

This project is licensed under the **MIT License**.