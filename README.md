# Power-Toolkit for Power Apps & Dynamics 365

[![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)](https://github.com/khawatme/Power-Toolkit/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A browser extension that puts a developer toolkit over any model-driven app: inspect and edit live form data, query the Web API and FetchXML, read plugin traces, test security roles, and manage flows, agents, and Custom APIs — without leaving the record you're looking at.

Everything runs client-side in your own session, against the environment you already have open.

---

## Install

| Browser | |
|---|---|
| **Microsoft Edge** | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/powertoolkit-for-power-a/bcdhpcgnalcckffananlnedhcedfadhg) |
| **Google Chrome** | [Chrome Web Store](https://chromewebstore.google.com/detail/power-toolkit-for-power-a/pohgckfkhjeahcjnmihobcoccpccgpca) |
| **Mozilla Firefox** | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/power-toolkit-for-power-apps/) *(Firefox 140+)* |

Open a model-driven app or the maker portal and click the toolbar icon to launch.

<details>
<summary><strong>Load unpacked (from source)</strong></summary>

```bash
npm install
npm run build          # Chrome/Edge → dist/extension/
npm run build:firefox  # Firefox     → dist-firefox/extension/
```

**Chrome / Edge** — open `chrome://extensions/` or `edge://extensions/`, enable Developer mode, choose **Load unpacked**, and select `dist/extension/`.

**Firefox** — open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist-firefox/extension/manifest.json`.

</details>

---

## Features

| Tab | What it does |
|---|---|
| [Inspector](docs/USER-GUIDE.md#inspector) | Live tree of the form's UI hierarchy, with in-place value editing |
| [Form Columns](docs/USER-GUIDE.md#form-columns) | Every column as a searchable table — live form values or the saved record |
| [Event Monitor](docs/USER-GUIDE.md#event-monitor) | Console of `OnLoad`, `OnSave`, and `OnChange` as they fire |
| [Plugin Context](docs/USER-GUIDE.md#plugin-context) | Simulated `Target` and pre/post images, plus a FakeXrmEasy test generator |
| [Performance](docs/USER-GUIDE.md#performance) | Load-time breakdown plus a review of the form against Microsoft's guidance, every finding linked to its Learn page |
| [Form Automation](docs/USER-GUIDE.md#form-automation) | Business rules and event handlers across Main, Quick View, Quick Create, and Card forms, with a web resource editor |
| [Power Automate](docs/USER-GUIDE.md#power-automate) | Browse, toggle, and edit cloud flows — visual `runAfter` editing, raw JSON, and run history |
| [AI Workbench](docs/USER-GUIDE.md#ai-workbench) | Copilot Studio agents, transcripts, and workflows plus AI Builder prompts and models — inspect, edit, test, publish |
| [Impersonate](docs/USER-GUIDE.md#impersonate) | Run every request as another user; compare privileges, field security, and command bars |
| [Metadata Browser](docs/USER-GUIDE.md#metadata-browser) | Searchable dictionary of every table and column, choice options and lookup targets included |
| [Solution Layers](docs/USER-GUIDE.md#solution-layers) | Find and remove unmanaged customization layers |
| [WebAPI Explorer](docs/USER-GUIDE.md#webapi-explorer) | GET/POST/PATCH/DELETE with filter groups, bulk operations, and file uploads |
| [FetchXML Tester](docs/USER-GUIDE.md#fetchxml-tester) | Build, run, and convert FetchXML to C#, JavaScript, OData, SQL, or Power Automate |
| [Custom APIs](docs/USER-GUIDE.md#custom-apis) | Browse, create, test, and generate code for Custom APIs, scoped by solution |
| [Env Variables](docs/USER-GUIDE.md#env-variables) | Create and edit environment variables and their current values |
| [Plugin Traces](docs/USER-GUIDE.md#plugin-traces) | Live trace viewer with an outcome filter and an environment logging-level switch |
| [User Context](docs/USER-GUIDE.md#user-context) | Roles, teams, and session details for the current or impersonated user |
| [Code Hub](docs/USER-GUIDE.md#code-hub) | Copy-ready Client API snippets, reviewed against Microsoft Learn |
| [Settings](docs/USER-GUIDE.md#settings) | Reorder, hide, and color tabs; configure header buttons; export and import |

Plus header actions on any form: **Show Logical Names**, **God Mode**, **Reset Form**, and theme toggle.

---

## Documentation

- **[User Guide](docs/USER-GUIDE.md)** — what every tab does and when to use it. The same guide ships inside the extension under **Help / Guide**.
- **[Development Guide](docs/DEVELOPMENT.md)** — project structure, adding a tab, memory-leak patterns, testing, and the contribution workflow.

---

## Development

```bash
git clone https://github.com/khawatme/Power-Toolkit.git
cd Power-Toolkit
npm install
npm run dev        # watch mode (Chrome/Edge); npm run dev:firefox for Firefox
npm test           # run the test suite
npm run lint       # lint
```

Contributions are welcome — see the [Development Guide](docs/DEVELOPMENT.md) before opening a pull request.

## Reporting issues

[Open an issue](https://github.com/khawatme/Power-Toolkit/issues/new/choose) and pick a template — bug report, feature request, or documentation. The template prompts you for everything needed to reproduce it.

## License

[MIT](LICENSE) © Mohammed Khawatme
