# Power-Toolkit User Guide

What every tab does, and when to reach for it. For installation see the [README](../README.md); for building and extending the toolkit see the [Development Guide](DEVELOPMENT.md).

The same guide ships inside the extension — open the **Help / Guide** tab and search it.

## Table of Contents

- [Getting Started](#getting-started)
  - [Launching the toolkit](#launching-the-toolkit)
  - [Where each tab works](#where-each-tab-works)
  - [Global actions (header buttons)](#global-actions-header-buttons)
- [Form Tools](#form-tools)
  - [Inspector](#inspector) · [Form Columns](#form-columns) · [Event Monitor](#event-monitor) · [Plugin Context](#plugin-context) · [Performance](#performance)
- [Automation & AI](#automation--ai)
  - [Form Automation](#form-automation) · [Power Automate](#power-automate) · [AI Workbench](#ai-workbench)
- [Data & API](#data--api)
  - [WebAPI Explorer](#webapi-explorer) · [FetchXML Tester](#fetchxml-tester) · [Custom APIs](#custom-apis) · [Metadata Browser](#metadata-browser)
- [Security & Environment](#security--environment)
  - [Impersonate](#impersonate) · [User Context](#user-context) · [Env Variables](#env-variables) · [Solution Layers](#solution-layers) · [Plugin Traces](#plugin-traces)
- [Productivity](#productivity)
  - [Code Hub](#code-hub) · [Settings](#settings)
- [Privileges reference](#privileges-reference)

---

## Getting Started

### Launching the toolkit

Open a model-driven app or the maker portal, then click the Power-Toolkit icon in your browser toolbar. The panel opens over the page — drag its header to move it, double-click the header (or press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>M</kbd>) to minimize it.

The toolkit runs entirely in your browser session. Every request it makes uses your own credentials against the environment you already have open; nothing is sent anywhere else.

### Where each tab works

Five tabs read the live form context and are disabled elsewhere. The rest work anywhere in the environment, including on dashboards and list views.

| Needs an open record form | Works anywhere in the environment |
|---|---|
| Inspector, Form Columns, Event Monitor, Plugin Context, Performance | Form Automation, Power Automate, AI Workbench, Impersonate, Metadata Browser, Solution Layers, WebAPI Explorer, FetchXML Tester, Custom APIs, Env Variables, Plugin Traces, User Context, Code Hub, Settings |

A few features inside the "works anywhere" tabs light up only on a form — the **Current record** button in WebAPI Explorer, for example.

### Global actions (header buttons)

| Button | What it does |
|---|---|
| **Show Logical Names** | Overlays logical-name badges on form tabs, sections, and controls. Click a badge to copy the name. |
| **Hide Logical Names** | Removes the overlays. |
| **God Mode** | Unlocks every field, drops required-field validation, and reveals hidden UI on the form. |
| **Reset Form** | Discards unsaved changes by reloading the form data. |
| **Refresh Tool** | Clears the toolkit's cache and reloads the current tab. |
| **Toggle Theme** | Switches between light and dark. |

> **Tip:** Choose which header buttons appear, and in what order, under **Settings → Header Buttons**.

---

## Form Tools

### Inspector

A live tree of the form's UI hierarchy — Tabs → Sections → Controls — with each node's properties and current value. Values that can be edited are underlined; click one to change it in place and watch how the form reacts, without writing a line of script.

### Form Columns

Every data column as a flat, searchable, sortable table.

- **Form Columns** view — live values from the form context, editable in place.
- **Record Columns** view — every attribute on the saved record, fetched through the Web API.

Hover a row to highlight the matching control on the form behind the panel.

### Event Monitor

A running console of form events as they fire: the initial `OnLoad`, every field's `OnChange` (naming the field), and `OnSave`. Use it to confirm the order your client scripts actually run in.

### Plugin Context

Builds the context a server-side plugin would receive for a `Create`, `Update`, or `Delete` on the record in front of you — `InputParameters["Target"]`, `PreEntityImages["preimage"]`, and `PostEntityImages["postimage"]` — as copyable JSON. One button turns it into a **FakeXrmEasy** C# unit test.

### Performance

Form load time broken down into server, network, and client processing, alongside a composition summary — tabs, sections, controls, and OnChange handlers.

**Performance Review** checks the form against Microsoft's published guidance. Each finding is graded **High** / **Medium** / **Low**, names what it found on *this* form, and links to the Microsoft Learn page behind it.

| Rule | What it looks at |
|---|---|
| Mobile object limits | The documented ceiling for phones and tablets — 5 tabs, 75 columns, 10 subgrids |
| Default tab | The first expanded tab, whose controls always initialize on load — subgrids, quick views, and timelines each fetch their own data before the form is usable |
| Load time | Whether the load is slow, and whether server, network, or client dominates it |

**Scan form scripts** reads the table's *unmanaged* form libraries and adds the client-scripting rules: synchronous requests, `window.top`, the OData v2.0 endpoint, leftover `console` calls, new browser windows, uncleaned timers and window listeners, and URLs that leave the navigation bar on. Managed libraries are skipped — you can't change them. Comments and string literals are ignored, so a pattern named in a comment isn't reported as live code.

**Refresh** re-reads the form and runs the review again, clearing any previous scan.

> **The all-clear is honest.** Until you scan, the script rules are *skipped*, not passed — the summary says how many rules ran. A library the toolkit cannot open is named rather than assumed clean. Two thresholds are the toolkit's own rather than Microsoft's — how slow a load is worth flagging, and how heavy a default tab is — and findings that use them say so.

---

## Automation & AI

### Form Automation

Everything automated on a table, in one place.

**Business Rules** — every rule, active or inactive, for any table you pick. Activate, deactivate, open, or delete them from the list, and expand a rule to read the JavaScript it compiles to, with syntax highlighting.

**Form Event Handlers** — the `OnLoad`, `OnSave`, and `OnChange` functions from the form designer, plus anything else under **Other Events**. Every form type that can carry handlers is read — **Main, Quick View, Quick Create, and Card** — and a note names the ones that were scanned.

| Badge | Meaning |
|---|---|
| **System** | The platform registered it (the form's `InternalHandlers`). |
| **Form** | Added in the form designer. |
| **Off** | Explicitly disabled on the form. |
| *Form name / count* | Which form it lives on. A shared handler is listed once with the count — hover for the names. |

System vs Form describes *where the registration lives*, not managed vs unmanaged solutions — a form definition doesn't record that. Handlers are read from both `formxml` and `formjson`, with FormXML winning where the two disagree.

**Form Libraries** — the JavaScript these forms load. Useful when a library is registered but nothing from it is wired to an event.

**Web Resource Editor** — the edit button opens a script in a built-in editor. Unmanaged resources can be edited or replaced by dropping in a `.js` file, then **Save** or **Save & Publish**. Managed and hidden ones open read-only behind a lock banner.

### Power Automate

Every solution-aware cloud flow in the environment, with status, owner, and dates.

- **Turn On/Off** — from the card. Managed flows are read-only.
- **View / Edit Definition** — two views. **Visual** lays out triggers, actions, and branches, and gives each step clickable **run-after** dots: toggle the conditions, add or remove predecessors, then Save or Undo. **JSON** is syntax-highlighted and editable for unmanaged flows.
- **Run History** — recent runs with colour-coded status, trigger, duration, and error details, plus a success-rate summary, a status filter, **Live** auto-refresh, and per-run portal links. Dataverse stores run history for solution flows only, for roughly 28 days.
- **Open / Delete** — open in the native designer (Power Automate, or Copilot Studio for *Agent flows*), or delete unmanaged flows.

> **Tip:** Filter Run History to *Failed* and switch on **Live** while you debug.

### AI Workbench

Everything Copilot Studio and AI Builder keep in Dataverse — agents, transcripts, prompts, and models — read from `bot`, `botcomponent`, `conversationtranscript`, and `msdyn_aimodel`.

#### Agents

One card per agent, with three independent badges: **Draft / Published** (Copilot Studio's real publish status, from `publishedon`), **Active / Inactive** (the Dataverse record state), and **Powered by** — *GitHub Copilot* for modern generative agents, *Standard* for classic topic-based ones. From the card: activate or deactivate, export as JSON, open in Copilot Studio, or delete unmanaged agents.

**View Definition** opens a tabbed dialog:

| Tab | Contents |
|---|---|
| **Overview** | The agent's instructions — editable in place for unmanaged agents, whether they live in a Custom GPT component (classic) or the bot configuration (modern) — plus its model. |
| **Map** | Topics, tools, knowledge, triggers, and expandable connected agents. |
| **Components** | Grouped and togglable. Test sets show their graders and Pass/Fail labels; test cases show the expected conversation. |
| **Activity** | Lifecycle, publish readiness, and session analytics. |
| **Transcripts** | Each conversation led by a session summary — engaged/unengaged, outcome, turn count, and a **Test-pane** badge for test-canvas chats — then the readable User/Agent turns. A message-less unengaged session is explained rather than left blank. Kept ~30 days. |
| **Configuration** | The full JSON. |

Unmanaged agents save with a single footer **Save & Publish**.

#### Workflows

The environment's Copilot Studio workflows: toggle, edit definitions, delete unmanaged ones, or open in Copilot Studio.

#### Prompts & Models

One card per AI Builder prompt or model, badged by **family** (Prompt, Custom model, Prebuilt model) and by its latest configuration's **state** (Live, Published, Draft, Training, Train failed). Each card says whether a version is published and whether an automatic retrain is scheduled, opens the item in AI Builder, and deletes unmanaged items with confirmation.

**Editing a prompt.** Only the **live** version is editable — older versions collapse into **Version history**, mirroring AI Builder, where you publish a new version rather than rewrite a past one. Two tabs edit the same live configuration and stay in sync:

- **Prompt** — the prompt as plain, editable text. Words in `{braces}` are inputs (Dataverse columns and formulas the model fills in) and survive as you reword around them. An **Advanced** disclosure exposes the raw JSON; a code-interpreter prompt also shows its generated Python, read-only.
- **Settings** — temperature, content moderation, record-retrieval limit, response links, and code interpreter, each with a one-line description.

One footer **Save** persists both tabs together and stays disabled until something changes, with **Undo** beside it. **Save as** copies the prompt under a new name as an independent model.

**Testing a prompt.** Runs are kept as a log, newest first, so you can compare outputs as you tweak the wording. If the prompt declares input variables, a field appears for each and the run uses your values exactly as a live request would. Each result shows the output and its media type, the exact LLM build that answered and the finish reason, the token breakdown with both AI Builder and Copilot credits spent, and any grounding records it read under **Data used**. A code-interpreter run also reveals the generated Python, its logs, and its plan; a plain reasoning run shows its thought steps. Once a run has generated code, **Test without regenerating** re-runs that exact code — faster and deterministic.

**Working with a trained model.** Versions are organized like the maker portal: a **Published version** (the one that actually runs), the **Last trained version**, and older iterations under a read-only **History**. Each shows the bound table, the predicted column, and the bound columns, plus a **Model performance** panel — an accuracy gauge with per-category precision / recall / F1 and a **Download detailed metrics** export. Actions stay inside the dialog:

- **Train / Retrain** — starts training and tracks status until it settles at Trained or Train failed. A trained iteration can't be retrained in place, so **Retrain** clones a fresh iteration; an untrained draft simply trains.
- **Quick test** — run the model on sample text inline. Each run is kept as a row with its predictions and confidence; an unrecognized output is shown as-is rather than reported as empty.
- **Publish / Unpublish** — publish the last-trained version or unpublish the live one. Only one version can be live at a time, so **Publish** appears only when nothing is published.

**Runs** lists recent executions (quick tests and automation) with their output and, when recorded, the input they ran against, plus the LLM model, units, credit cost, a usage summary, and a 14-day trend.

**Evaluations** is the AI Builder **Test hub** for a prompt:

- **Evaluation criteria** — the passing score and which prebuilt checks apply (expected response, exact or semantic; response quality; JSON correctness). Editable: set the passing score 1–100% and toggle the checks.
- **Latest run** — cases, average accuracy, pass count, duration, and model for the newest batch.
- **Test cases** — each saved case with its expected output, editable in place. Select one, several, or all to **Run** or delete; expand a case for its input variables.
- **Run** — predicts each case, then grades it against the criteria (semantic similarity and response quality through the same server-side grader; exact-match and JSON checks computed locally) and writes back a scored batch. It runs immediately with progress shown in place, and it calls the model, so it consumes AI Builder credits.
- **Run history** — every batch, newest first, expandable for per-case expected-vs-actual output, Pass/Fail against the passing score, the accuracy score, and the model and tokens used.

#### Templates

A three-part authoring workbench, all of it scoped by one **Agent type** control in the header. Microsoft's guidance genuinely differs between **Classic** (topic-based) and **Modern** (instructions-first) agents, so selecting an agent picks the matching type for you — and you can always change it.

- **Library** — 200+ copy-ready scaffolds, sub-categorized (instructions by industry, patterns, orchestration, topics, tools including MCP, knowledge, guardrails, evaluation test sets) and searchable by problem language. Click a card to expand it, fill its placeholders, and copy the result. Every instruction scaffold passes the Review checker as-is; cards badged **Maker checklist** are steps to follow in the editor, and **Definition** ones belong in a topic or test set rather than in an agent's instructions. Choosing a type hides the scaffolds that don't apply and rewrites tool references to the syntax that experience uses.
- **Generator** — compose a full instruction set from role presets, tone, capabilities, tools (optionally grounded in your own agents' real tool names), escalation, and guardrails. Modern output adds an explicit tone and output contract. Copy or download it.
- **Review** — paste instructions, or load them from an agent, and get findings against Microsoft's instruction-writing guidance, each linking to the Learn page behind it. Loading an agent also flags tools or topics the instructions name that the agent doesn't actually have.

#### Search

One box across every agent's component names, descriptions, and instructions, grouped by agent.

> **Note:** Run scores and engagement analytics live in Copilot Studio. The toolkit shows what Dataverse stores.

---

## Data & API

### WebAPI Explorer

A client for the Dataverse Web API.

**GET** — build OData queries with `$select`, `$filter`, `$expand`, `$orderby`, and `$top`. **Filter Groups** compose AND/OR/NOT logic; the **Browse** buttons search table and column names. Results render as a sortable table or raw JSON.

**Current record** — on a record form, fills in the table you're looking at and filters to that record's id, using the table's real primary key from metadata. It replaces any filters already in the builder.

**POST / PATCH** — **JSON mode** for raw payloads, or **Field Builder mode** for a visual editor that detects attribute types and offers picklists, booleans, date pickers, and lookups. **Populate Required** fills mandatory fields with placeholders.

**Bulk operations** — leave the Record ID empty and add filter groups to PATCH or DELETE many records, with live progress. An incomplete filter that would match every record is refused rather than run.

**Touch Records** — select rows in the results and click **Touch** to write a field such as `modifiedon` without changing data, to fire plugins or workflows.

**File uploads** — file columns get a picker with chunked upload for files of any size.

**Pagination** — past 5000 records, **Load More** or **Load All** fetch further pages.

> **Tip:** **Hide System Fields** in the toolbar strips OData properties like `@odata.etag` from results.

### FetchXML Tester

Build queries visually or write the XML directly.

**Builder** — pick a table, add columns, and compose conditions with **Add Filter Group** (AND/OR). **Linked entities (joins)** detect lookup relationships automatically, and clicking a linked entity adds child joins for multi-level chains (Account → Contact → SystemUser).

**Aggregates** — **Add Aggregate** (count, sum, avg, min, max) and **Add Group By**. When either is present the builder emits `aggregate="true"` FetchXML; order aggregate results using the Order field with an alias.

**Selection & Touch** — results carry checkboxes; **Touch** bulk-touches the selected records, and **Export** exports only the selection when one is active.

**XML Editor** — for complex queries or FetchXML pasted from elsewhere, with syntax highlighting, **Format XML**, and built-in templates including aggregate examples.

**Convert To** — turn the current FetchXML into **C# QueryExpression** (FetchExpression for aggregates), **JavaScript Xrm.WebApi** (OData for simple queries, FetchXML for complex), an **OData** query string, **SQL** (T-SQL with JOINs and GROUP BY), a **Power Automate** *List rows* configuration, or a ready-to-use **Web API URL**.

**Pagination** — **Load More** / **Load All** beyond the 5000-record page.

> **Tip:** Click column headers to sort, and enable **Hide System Fields** to focus on your data.

### Custom APIs

Full lifecycle management for Dataverse Custom APIs. Pick a solution first — it scopes every operation to that solution's publisher prefix.

**Browser** — a searchable card grid showing unique name, type (Action / Function), binding (Global, Entity-bound, Collection-bound), bound entity, processing type (Sync / Async), and the plug-in behind it. **Expand** reveals request parameters and response properties with types and optional/required flags. Unmanaged APIs get **Edit** and **Delete**; **New API** creates one with its parameters and response properties in a single deep-insert request.

**Tester** — select an API and the tester works out the HTTP method (GET for Functions, POST for Actions), the endpoint URL for its binding type, and a type-aware input for every parameter. Add request headers (`MSCRM.SuppressDuplicateDetection: true`, for example) before executing. The response panel reports status, elapsed time, size, formatted body (JSON / XML / Raw), and headers, each with one-click copy.

**Code generation** — ready-to-run snippets in **JavaScript** (native `fetch` with the right OData headers), **C# (SDK)** (`OrganizationRequest` / `IOrganizationService`), **HTTP** (paste into Postman or Bruno), and **Power Automate** (a *Perform an unbound/bound action* step).

**Export / Import** — export a definition with all its parameters and properties as portable JSON, and recreate it in another environment in one click.

**Execution history** — the last 20 executions with name, method, status code, and elapsed time. Click one to repopulate the tester.

> **Tip:** **Test** on a Browser card jumps straight to the Tester with that API selected.

### Metadata Browser

A searchable dictionary of the environment's schema. The left panel lists every table the current user can see; picking one loads its columns on the right. Click a table or column for a dialog of its full metadata — `SchemaName`, `IsManaged`, `ObjectTypeCode`, and the rest — including choice options and lookup targets, polymorphic ones such as `customerid` and `ownerid` included.

---

## Security & Environment

### Impersonate

Run the toolkit as another user to see what their security roles actually produce. Pick a user and **every server-side request the toolkit makes** — WebAPI Explorer, FetchXML, Plugin Traces — executes as them, with a yellow indicator in the header.

**Analyze Security** compares your access with theirs: entity privileges on the current table, field security profiles and column-level permissions, team memberships, and a role comparison marking each role **Direct** or **via team: *name***.

**Compare Commands** shows which ribbon buttons each user can see and the specific rule that blocks the others (`Mscrm.DeleteSelectedEntityPermission`, for instance) — usually how you find out why someone has no **Delete** button. It queries the same ribbon metadata as the built-in Command Checker (`&ribbondebug=true`). Commands gated by custom JavaScript or Power Fx are listed under **Cannot be determined**, because those rules only run inside that user's own session.

**Quick Check** summarizes what the impersonated user would get on the page you're on: table privileges, the form they'd actually open, columns hidden by field security, access to the record, the apps they can open, and role-scoped views. It's read-only and covers one page, so press it again after navigating. It can't see business rules, form scripts, or anything that hides fields at runtime.

> **Requires** the **prvActOnBehalfOfAnotherUser** privilege (the Delegate role), assigned directly rather than through a team. Impersonated requests use the **intersection** of your privileges and theirs, so if you aren't a System Administrator the toolkit can under-report what that user could really do.

### User Context

The current session at a glance: user name and id, **team memberships** with their types, and the **complete security role list** including roles inherited from teams, alongside client and organization details. Every id is copyable with a click. When impersonation is active this tab shows the impersonated user instead.

### Env Variables

Every Environment Variable Definition with its schema name, type, default value, and current value.

- **New Variable** — create a definition; the dialog validates the schema name format before saving.
- **Edit** — set the current value without opening the maker portal.
- **Delete** — remove variables you no longer need, with confirmation. Managed variables can't be deleted.

> **Tip:** Current values are stored separately from default values in Dataverse. Editing here sets the current-value override and leaves the default alone.

### Solution Layers

Find and clean up customization layers. Pick a solution to list its components carrying active unmanaged customizations on top of managed ones, searchable and filterable by component type (Entity, Attribute, Form, View, and so on). **Delete** an unmanaged active layer to drop your customization and reveal the managed version underneath — the fastest route out of a conflict after a managed import.

### Plugin Traces

A live viewer for Plugin Trace Logs, with **live polling** for new traces as they're written. Filter server-side by **outcome** (All / Errors only / Success only — errors being traces that recorded an exception), class name, date range, or message content, then search locally within the results.

**Logging level** — the banner reports the environment's current level, and the dropdown beside it switches between *Off*, *Exception*, and *All* without a trip to System Settings → Customization. It writes the org-wide setting, so it needs write access to the Organization table (System Administrator) and affects everyone in the environment. The change applies to plug-ins that run after it, not to traces already recorded.

> **Tip:** An empty list usually means logging is Off, or the traces aged out — a daily job deletes anything older than **24 hours**. Microsoft also switches logging off on its own if the trace table passes 100 GB, so a level you set to *All* can come back as *Off*. Switch back to *Exception* when you've finished debugging; trace logging consumes environment storage.

---

## Productivity

### Code Hub

A curated library of Client API (JavaScript) snippets for model-driven apps — each with a description, search tags, and one-click copy. Snippets follow current practice: `formContext` from `executionContext`, `async`/`await`.

Categories: **Form Context** (values, handlers, required level, form type), **Save & Lifecycle** (save-if-dirty, prevent save, save mode, block auto-save), **UI** (tabs, sections, form and control notifications), **Lookup Filters** (PreSearch with a custom filter), **Business Process Flow**, **Web API** (CRUD, associate, actions and functions, batch, `@odata.bind`, FetchXML, formatted values), **Navigation & Dialogs** (openForm, navigateTo, custom and generative pages, alerts and confirms), **Grids & Subgrids**, **App & Side Panes** (`Xrm.App` global notifications and side panes), and **Utilities** (global context, roles).

Type to filter across titles, tags, and code — matching categories expand on their own. The library is reviewed against the Microsoft Learn Client API reference.

### Settings

**Tab Configuration** — drag tabs to reorder the navigation, and use the toggles to hide the ones you never open.

**Tab colors** — the swatch on each row gives a tab an accent color in the navigation: an edge bar and a tinted icon, so the tabs you use most are findable at a glance. The **×** clears it.

**Header Buttons** — which header buttons appear and in what order, again by drag and toggle. Some (Show Logical Names, God Mode) are only available on form pages.

**Export / Import / Reset** — **Export** writes your settings to a file and **Import** loads them on another machine; tab order, visibility, and colors all travel with it. **Reset** restores the defaults.

---

## Privileges reference

Most of the toolkit needs nothing beyond the access you already have — it reads what your own user can read. These features need more:

| Feature | Requirement |
|---|---|
| Impersonate | **prvActOnBehalfOfAnotherUser** (Delegate role), assigned directly, not via a team |
| Plugin Traces — change logging level | Write access to the Organization table (System Administrator) |
| Editing web resources, flows, agents, prompts | The component must be **unmanaged**; managed ones open read-only |
| Solution Layers — delete a layer | Permission to delete the unmanaged customization |
| AI Builder test runs and prompt tests | Consume AI Builder credits in the environment |

---

**Found something the guide doesn't cover, or that doesn't match what you see?** [Open an issue](https://github.com/khawatme/Power-Toolkit/issues/new/choose) using one of the templates.
