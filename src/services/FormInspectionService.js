/**
 * @file Form inspection and column management service
 * @module services/FormInspectionService
 * @description Handles form hierarchy, columns, and event handler inspection
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';
import { ValidationService } from './ValidationService.js';
import { formatDisplayValue, inferDataverseType } from '../helpers/index.js';
import { Config } from '../constants/index.js';
import { SYSTEM_FORM_TYPES, SYSTEM_FORM_TYPE_LABELS } from '../constants/dataverse.js';
// Imported from the rule module rather than the barrel: test files mock constants/index.js
// partially, which would leave these undefined.
import { DATA_DRIVEN_CONTROL_TYPES, DEFERRABLE_CONTROL_TYPES } from '../constants/formPerformanceRules.js';

/**
 * Get form ID reliably across different Dynamics versions.
 * @private
 * @returns {string|null} Form ID without braces
 */
function _getFormIdReliably() {
    try {
        if (typeof Xrm !== 'undefined' && Xrm.Page && Xrm.Page.ui && Xrm.Page.ui.formSelector) {
            const currentItem = Xrm.Page.ui.formSelector.getCurrentItem();
            if (currentItem) {
                const formId = currentItem.getId();
                return formId ? formId.replace(/[{}]/g, '') : null;
            }
        }
        return null;
    } catch (_e) {
        return null;
    }
}

/**
 * Unwraps a Dataverse `formjson` collection.
 *
 * `formjson` is a .NET-serialized descriptor tree, so every collection arrives as
 * `{"$type": "...[], Microsoft.Crm.ObjectModel", "$values": [...]}` rather than a bare array.
 * Treating those objects as arrays silently yields nothing, which is exactly how the JSON side of
 * this parser used to read every form as having no handlers at all.
 * @private
 * @param {any} value - A descriptor collection, a plain array, or anything else
 * @returns {Array} The contained items, or an empty array
 */
function _unwrapValues(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return Array.isArray(value?.$values) ? value.$values : [];
}

/**
 * Extract handler objects from an XML event node.
 * @private
 * @param {Element} eventNode - The event element
 * @param {string|null} fieldName - The field name for field-level events
 * @returns {Array} Array of handler objects
 */
function _extractHandlersFromXmlNode(eventNode, fieldName = null) {
    return Array.from(eventNode.querySelectorAll('Handler')).map(h => ({
        library: h.getAttribute('libraryName'),
        function: h.getAttribute('functionName'),
        // `enabled` is optional in the FormXML schema with no declared default, and the platform runs
        // a handler unless it is explicitly switched off — so absent must not read as disabled.
        enabled: h.getAttribute('enabled') !== 'false',
        passContext: h.getAttribute('passExecutionContext') === 'true',
        parameters: h.getAttribute('parameters') || '',
        field: fieldName,
        // Registered by the platform rather than on the form. Not the same thing as a managed
        // solution — the form definition says nothing about solution layers.
        internal: h.parentElement?.tagName === 'InternalHandlers'
    }));
}

/**
 * Parse formxml string and populate automations object.
 * @private
 * @param {string} formxml - The form XML string
 * @param {object} automations - The automations accumulator
 * @param {Function} addHandler - Function to add a handler with deduplication
 */
function _parseFormXml(formxml, automations, addHandler) {
    const xmlDoc = new DOMParser().parseFromString(formxml, 'text/xml');
    if (xmlDoc.querySelector('parsererror')) {
        return;
    }

    // Parse form-level events (onload, onsave)
    xmlDoc.querySelectorAll('form > events > event').forEach(node => {
        const eventName = node.getAttribute('name')?.toLowerCase();
        const handlers = _extractHandlersFromXmlNode(node);

        if (eventName === 'onload') {
            handlers.forEach(h => addHandler(automations.OnLoad, 'OnLoad', h));
        } else if (eventName === 'onsave') {
            handlers.forEach(h => addHandler(automations.OnSave, 'OnSave', h));
        } else if (handlers.length > 0) {
            handlers.forEach(h => {
                h.eventType = eventName;
                addHandler(automations.Other, 'Other', h);
            });
        }
    });

    // Parse field-level events (onchange and other field events)
    xmlDoc.querySelectorAll('cell').forEach(cellNode => {
        const controlNode = cellNode.querySelector('control');
        const controlField = controlNode?.getAttribute('datafieldname') || controlNode?.getAttribute('id') || null;

        cellNode.querySelectorAll('events > event').forEach(eventNode => {
            const eventName = eventNode.getAttribute('name')?.toLowerCase();
            // A DataEvent names its own column; fall back to the cell's control for control events.
            const fieldName = eventNode.getAttribute('attribute') || controlField;
            const handlers = _extractHandlersFromXmlNode(eventNode, fieldName);

            if (eventName === 'onchange') {
                handlers.forEach(h => addHandler(automations.OnChange, 'OnChange', h));
            } else if (eventName === 'onload') {
                handlers.forEach(h => {
                    h.field = fieldName;
                    addHandler(automations.OnLoad, 'OnLoad', h);
                });
            } else if (handlers.length > 0) {
                handlers.forEach(h => {
                    h.eventType = eventName;
                    addHandler(automations.Other, 'Other', h);
                });
            }
        });
    });

    // Script libraries the form loads. Per the FormXML schema these live in
    // `<formLibraries><Library name="..." libraryUniqueId="..."/></formLibraries>` — the previous
    // `clientincludes/jscriptfile` lookup matched elements that do not exist in the schema, so this
    // list came back empty for every real form.
    xmlDoc.querySelectorAll('formLibraries > Library').forEach(node => {
        _addLibrary(automations, node.getAttribute('name'));
    });

    // Platform-internal resources — a different (and rarer) element, kept for completeness.
    xmlDoc.querySelectorAll('clientincludes > internaljscriptfile').forEach(node => {
        _addLibrary(automations, node.getAttribute('src'));
    });
}

/**
 * Adds a script library to the accumulator, normalized and de-duplicated.
 * @private
 * @param {object} automations - The automations accumulator
 * @param {string|null|undefined} name - Raw library name or `$webresource:` reference
 */
function _addLibrary(automations, name) {
    const libraryName = String(name || '').replace(/^\$webresource:/, '').trim();
    if (libraryName && !automations.Libraries.includes(libraryName)) {
        automations.Libraries.push(libraryName);
    }
}

/**
 * Normalize a handler object from formjson into the standard format.
 * @private
 * @param {object} h - Raw handler from JSON
 * @param {string|null} fieldName - Field name for field-level events
 * @returns {object} Normalized handler
 */
function _normalizeJsonHandler(h, fieldName = null) {
    const lib = h.LibraryName || h.libraryName || h.library || '';
    return {
        library: String(lib).replace(/^\$webresource:/, ''),
        function: h.FunctionName || h.functionName || h.function || '',
        // Mirrors the XML rule: only an explicit `false` means disabled.
        enabled: h.Enabled !== false && h.enabled !== false,
        passContext: h.PassExecutionContext === true || h.passExecutionContext === true,
        parameters: h.Parameters || h.parameters || '',
        field: fieldName,
        internal: h.IsInternal === true || h.isInternal === true
    };
}

/**
 * Reads the event name off a formjson handler descriptor.
 * @private
 * @param {object} h - Raw handler descriptor
 * @returns {string} Lower-cased event name, or '' when the descriptor doesn't carry one
 */
function _jsonHandlerEventName(h) {
    return String(h?.EventName || h?.eventName || h?.Name || h?.name || h?.EventType || h?.eventType || '')
        .toLowerCase();
}

/**
 * Parse formjson string and populate automations object.
 * Modern Power Apps form designer stores event handlers here.
 * @private
 * @param {string} formjsonStr - The form JSON string
 * @param {object} automations - The automations accumulator
 * @param {Function} addHandler - Function to add a handler with deduplication
 */
function _parseFormJson(formjsonStr, automations, addHandler) {
    let json;
    try {
        json = JSON.parse(formjsonStr);
    } catch {
        return;
    }

    // Form-level handlers. Real payloads name this collection `EventHandlers` and each descriptor
    // carries its own `EventName`.
    _processJsonEventHandlers(
        _unwrapValues(json.EventHandlers ?? json.eventHandlers),
        null,
        automations,
        addHandler
    );

    // Older `Events` shapes, kept so either representation still parses.
    const events = json.Events || json.events || json.formEvents?.events;
    if (events) {
        _processJsonEvents(events, automations, addHandler);
    }

    // Script libraries: `FormLibraries` and `ClientResources` are string collections inside the
    // `{$type, $values}` wrapper, so they have to be unwrapped before they can be read at all.
    [
        ..._unwrapValues(json.FormLibraries ?? json.formLibraries),
        ..._unwrapValues(json.ClientResources ?? json.clientResources)
    ].forEach(lib => {
        _addLibrary(
            automations,
            typeof lib === 'string' ? lib : (lib?.Name || lib?.name || lib?.LibraryName || lib?.libraryName)
        );
    });

    // Control-level handlers, anywhere in the tab/section/row/cell tree.
    _extractFieldEventsFromJson(json, automations, addHandler);
}

/**
 * Buckets a collection of formjson handler descriptors.
 * @private
 * @param {Array} handlers - Raw `EventHandlerDescriptor` entries
 * @param {string|null} fieldName - Owning column, for control-level handlers
 * @param {object} automations - The automations accumulator
 * @param {Function} addHandler - Deduplicating add
 */
function _processJsonEventHandlers(handlers, fieldName, automations, addHandler) {
    handlers.forEach(raw => {
        if (!raw || typeof raw !== 'object') {
            return;
        }
        const handler = _normalizeJsonHandler(raw, fieldName);
        if (!handler.function && !handler.library) {
            return;
        }
        _bucketHandler(_jsonHandlerEventName(raw), handler, fieldName, automations, addHandler);
    });
}

/**
 * Files a handler under the event it belongs to.
 *
 * A descriptor whose event can't be identified goes to Other tagged `unknown` rather than being
 * dropped — listing it in the wrong place is recoverable, hiding it is not.
 * @private
 */
function _bucketHandler(eventName, handler, fieldName, automations, addHandler) {
    if (eventName === 'onload') {
        handler.field = fieldName;
        addHandler(automations.OnLoad, 'OnLoad', handler);
    } else if (eventName === 'onsave') {
        addHandler(automations.OnSave, 'OnSave', handler);
    } else if (eventName === 'onchange') {
        addHandler(automations.OnChange, 'OnChange', handler);
    } else {
        handler.eventType = eventName || 'unknown';
        addHandler(automations.Other, 'Other', handler);
    }
}

/**
 * Process JSON events structure (form-level events).
 * Supports both array and object event formats.
 * @private
 */
function _processJsonEvents(events, automations, addHandler) {
    if (Array.isArray(events)) {
        // Format: [{name: "onload", handlers: [...]}, ...]
        events.forEach(evt => {
            const name = (evt.name || evt.Name || evt.EventName || evt.eventName || evt.eventType || evt.EventType || '').toLowerCase();
            const handlers = evt.handlers || evt.Handlers || [];
            _addJsonHandlersToAutomations(name, handlers, automations, addHandler);
        });
    } else if (typeof events === 'object') {
        // Format: {onload: {handlers: [...]}, onsave: {...}} or {onload: [...], onsave: [...]}
        for (const [key, value] of Object.entries(events)) {
            const name = key.toLowerCase();
            let handlers;
            if (Array.isArray(value)) {
                handlers = value;
            } else if (value && typeof value === 'object') {
                handlers = value.handlers || value.Handlers || [];
            } else {
                continue;
            }
            _addJsonHandlersToAutomations(name, handlers, automations, addHandler);
        }
    }
}

/**
 * Add parsed JSON handlers to the appropriate automations list.
 * @private
 */
function _addJsonHandlersToAutomations(eventName, handlers, automations, addHandler) {
    if (!Array.isArray(handlers) || handlers.length === 0) {
        return;
    }

    handlers.forEach(rawHandler => {
        const handler = _normalizeJsonHandler(rawHandler);
        if (!handler.function && !handler.library) {
            return;
        }
        _bucketHandler(eventName, handler, null, automations, addHandler);
    });
}

/**
 * Walks the formjson descriptor tree collecting control-level handlers.
 *
 * Every collection on the way down (`Tabs`, `Columns`, `Sections`, `Rows`, `Cells`, `Controls`,
 * `HiddenFields`, header/footer controls) is `{$type, $values}`-wrapped, and a cell holds its
 * control under a single `Control` property rather than in a list.
 * @private
 * @param {object} node - Current descriptor node
 * @param {object} automations - The automations accumulator
 * @param {Function} addHandler - Deduplicating add
 * @param {number} [depth=0] - Recursion guard against a self-referencing payload
 */
function _extractFieldEventsFromJson(node, automations, addHandler, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 20) {
        return;
    }

    const children = [
        ..._unwrapValues(node.Tabs ?? node.tabs),
        ..._unwrapValues(node.Columns ?? node.columns),
        ..._unwrapValues(node.Sections ?? node.sections),
        ..._unwrapValues(node.Rows ?? node.rows),
        ..._unwrapValues(node.Cells ?? node.cells),
        ..._unwrapValues(node.Controls ?? node.controls),
        ..._unwrapValues(node.HiddenFields),
        ..._unwrapValues(node.TabHeader),
        ..._unwrapValues(node.TabFooter),
        node.Control ?? node.control,
        node.Header,
        node.Footer
    ].filter(child => child && typeof child === 'object');

    children.forEach(child => {
        // Tabs and sections carry handlers too (tab state change), but their Id is a layout GUID —
        // only a control's Id is a usable column name, so don't label a tab handler with one.
        const isLayoutContainer = Boolean(child.Columns || child.Sections || child.Rows || child.Cells);
        const fieldName = child.DataFieldName || child.datafieldname ||
                          child.LogicalName || child.logicalName ||
                          (isLayoutContainer ? null : (child.Id || child.id)) || null;

        // A control carries its handlers directly; each descriptor names its own event.
        _processJsonEventHandlers(
            _unwrapValues(child.EventHandlers ?? child.eventHandlers),
            fieldName,
            automations,
            addHandler
        );

        // Older `Events: [{name, handlers}]` shape on a control.
        const childEvents = child.Events ?? child.events;
        if (Array.isArray(childEvents)) {
            childEvents.forEach(evt => {
                const name = (evt?.name || evt?.Name || evt?.eventType || evt?.EventType || '').toLowerCase();
                _unwrapValues(evt?.handlers || evt?.Handlers).forEach(rawHandler => {
                    const handler = _normalizeJsonHandler(rawHandler, fieldName);
                    if (!handler.function && !handler.library) {
                        return;
                    }
                    _bucketHandler(name, handler, fieldName, automations, addHandler);
                });
            });
        }

        _extractFieldEventsFromJson(child, automations, addHandler, depth + 1);
    });
}

/**
 * Add a handler to a list, deduplicating by event+function+library+field.
 *
 * The event has to be part of the key: one Set is shared by every bucket so that the same handler
 * seen in both formxml and formjson (or on two forms of the same table) is listed once — but
 * without the bucket, registering one function on both OnLoad and OnSave made the second
 * registration look like a duplicate and it silently vanished from the tab.
 * @private
 * @param {Set} seenKeys - Set of already-seen handler keys
 * @param {Array} list - Target handler list
 * @param {string} bucket - Event bucket the list represents ('OnLoad', 'OnSave', …)
 * @param {object} handler - Handler to add
 */
function _addUniqueHandler(seenHandlers, list, bucket, handler, formLabel) {
    const key = `${bucket}|${handler.eventType || ''}|${handler.function}|${handler.library}|${handler.field || ''}`;
    const existing = seenHandlers.get(key);

    if (existing) {
        // Same registration seen again — on the other definition column, or on another form of the
        // same table. Record where rather than listing it twice.
        if (formLabel && !existing.forms.includes(formLabel)) {
            existing.forms.push(formLabel);
        }
        return;
    }

    handler.forms = formLabel ? [formLabel] : [];
    seenHandlers.set(key, handler);
    list.push(handler);
}

/**
 * Creates a deduplicating collector shared by every parse of a single request.
 *
 * The collector is stateful across forms so the caller can point it at one form at a time and have
 * repeat registrations merge into a single row that knows every form it appears on.
 * @private
 * @returns {{add: Function, useForm: Function}} Collector with a bound-form setter
 */
function _createHandlerCollector() {
    const seenHandlers = new Map();
    let currentForm = null;

    return {
        add: (list, bucket, handler) => _addUniqueHandler(seenHandlers, list, bucket, handler, currentForm),
        useForm: (formLabel) => {
            currentForm = formLabel || null;
        }
    };
}

/**
 * Parses one systemform row into the accumulator.
 *
 * formxml is parsed first on purpose: it is the definition the designer has always written, and
 * first-seen wins in the deduplication, so a handler present in both columns keeps the event
 * bucketing that FormXML states explicitly. formjson then contributes anything XML didn't carry.
 * @private
 * @param {{formxml?: string, formjson?: string}} form - A systemform row
 * @param {object} automations - The automations accumulator
 * @param {Function} addHandler - Deduplicating add
 */
function _parseFormDefinition(form, automations, addHandler) {
    if (form?.formxml) {
        _parseFormXml(form.formxml, automations, addHandler);
    }
    if (form?.formjson) {
        _parseFormJson(form.formjson, automations, addHandler);
    }
}

/**
 * Describes a systemform row for display and attribution.
 * @private
 * @param {object} form - A systemform row
 * @returns {{id: string, name: string, type: number|null, typeLabel: string}} Form summary
 */
function _describeForm(form) {
    const type = typeof form?.type === 'number' ? form.type : null;
    const typeLabel = (type !== null && SYSTEM_FORM_TYPE_LABELS[type]) || 'Form';
    return {
        id: form?.formid || '',
        name: form?.name || typeLabel,
        type,
        typeLabel
    };
}

/**
 * Reads a control's type, normalized. Custom controls report `customcontrol: <namespace.name>` and
 * custom grids `customsubgrid: <name>`; the prefix is what the rules care about, not the component.
 * @private
 * @param {Xrm.Controls.Control} control - A form control
 * @returns {string} The control type, or '' when it cannot be read
 */
function _controlType(control) {
    try {
        const raw = control?.getControlType?.();
        return typeof raw === 'string' ? raw.split(':')[0].trim() : '';
    } catch {
        // A control can throw while the form is still settling; an unknown type is not a finding.
        return '';
    }
}

/**
 * Tallies control types into an accumulator.
 * @private
 * @param {Record<string, number>} tally - Accumulator, mutated
 * @param {string} type - Control type
 * @param {readonly string[]} [only] - When given, only these types are counted
 */
function _tallyControlType(tally, type, only) {
    if (!type || (only && !only.includes(type))) {
        return;
    }
    tally[type] = (tally[type] || 0) + 1;
}

/**
 * Reads the controls on one tab, walking its sections.
 * @private
 * @param {Xrm.Controls.Tab} tab - A form tab
 * @returns {string[]} The control types on the tab
 */
function _tabControlTypes(tab) {
    const types = [];
    const sections = tab?.sections?.get?.() || [];

    for (const section of sections) {
        for (const control of section?.controls?.get?.() || []) {
            types.push(_controlType(control));
        }
    }
    return types;
}

/**
 * Decodes a web resource's base64 `content` column back to text.
 *
 * `atob` alone yields a *binary* string — one character per byte — so a UTF-8 source turns every
 * non-ASCII character into its individual bytes (`café` → `cafÃ©`). That is not just a display
 * problem: `updateWebResourceContent` re-encodes what it is given as UTF-8, so opening a script with
 * an accent or a curly quote in the editor and saving it rewrote the file with mangled text, and
 * every subsequent save compounded it.
 *
 * A resource that is not valid UTF-8 falls back to the raw bytes rather than having them replaced
 * with U+FFFD — that keeps the old behavior for the rare non-UTF-8 file instead of corrupting it a
 * different way.
 * @private
 * @param {string} base64 - The raw `content` column.
 * @returns {string} The decoded text.
 */
function _decodeWebResourceContent(base64) {
    const binary = globalThis.atob(base64);
    try {
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new globalThis.TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return binary;
    }
}

/**
 * Finds the default tab — the first visible expanded tab. Docs: "The default tab is the first
 * expanded tab on a form", and its controls are the ones that always initialize on load.
 * @private
 * @param {Xrm.Controls.Tab[]} tabs - All form tabs
 * @returns {Xrm.Controls.Tab|null} The default tab, or null when none is expanded
 */
function _findDefaultTab(tabs) {
    for (const tab of tabs) {
        try {
            if (tab?.getVisible?.() !== false && tab?.getDisplayState?.() === 'expanded') {
                return tab;
            }
        } catch {
            // Skip a tab that can't report its state rather than mis-picking the default.
        }
    }
    return null;
}

/**
 * Summarizes the default tab for the review rules.
 * @private
 * @param {Xrm.Controls.Tab|null} tab - The default tab
 * @returns {{name: string, label: string, controls: number, dataControls: Record<string, number>,
 *   deferrable: Record<string, number>}|null} The summary, or null when there is no default tab
 */
function _describeDefaultTab(tab) {
    if (!tab) {
        return null;
    }

    const types = _tabControlTypes(tab);
    const dataControls = {};
    const deferrable = {};

    for (const type of types) {
        _tallyControlType(dataControls, type, DATA_DRIVEN_CONTROL_TYPES);
        _tallyControlType(deferrable, type, DEFERRABLE_CONTROL_TYPES);
    }

    let label = '';
    try {
        label = tab.getLabel?.() || tab.getName?.() || '';
    } catch {
        label = '';
    }

    return {
        name: (() => {
            try {
                return tab.getName?.() || '';
            } catch {
                return '';
            }
        })(),
        label: label || 'the default tab',
        controls: types.length,
        dataControls,
        deferrable
    };
}

/**
 * @typedef {object} FormColumn
 * @property {string} displayName - The user-friendly label of the column
 * @property {string} logicalName - The schema name of the column
 * @property {any} value - The current value of the column on the form
 * @property {string} type - The attribute type (e.g., "string", "lookup")
 * @property {boolean} isDirty - True if the column's value has been changed
 * @property {string} requiredLevel - The required level ('none', 'required', 'recommended')
 * @property {Xrm.Attributes.Attribute} attribute - The underlying Xrm.Attribute object
 * @property {boolean} [onForm] - True if the column is present on the form
 * @property {boolean} [isSystem] - True if the column is a system-managed property
 */

export const FormInspectionService = {
    /**
     * Get the complete UI hierarchy (Tabs > Sections > Controls) from the current form.
     * @returns {Array<object>} Hierarchical form structure
     */
    getFormHierarchy() {
        const tabs = PowerAppsApiService.getAllTabs();
        if (!tabs?.length) {
            return [];
        }

        const mapControl = ctrl => {
            try {
                const controlType = ctrl.getControlType();
                let value = `[${controlType}]`;
                let editableAttr = null;

                if (ctrl.getAttribute) {
                    const attr = ctrl.getAttribute();
                    if (attr) {
                        value = attr.getValue();
                        editableAttr = attr;
                    } else {
                        value = '[No Attribute]';
                    }
                } else if (controlType?.includes('subgrid')) {
                    const grid = ctrl.getGrid?.();
                    value = grid
                        ? `Entity: ${ctrl.getEntityName()} | Records: ${grid.getTotalRecordCount()}`
                        : `Entity: ${ctrl.getEntityName()} | Records: (loading)`;
                }

                return {
                    label: ctrl.getLabel() || ctrl.getName() || '(unnamed control)',
                    logicalName: ctrl.getName() || '',
                    value,
                    editableAttr,
                    controlType
                };
            } catch (e) {
                return {
                    label: ctrl?.getName?.() || 'Errored Control',
                    logicalName: `Error: ${e.message}`,
                    value: '—'
                };
            }
        };

        const mapSection = section => {
            try {
                return {
                    label: `Section: ${section.getLabel() || section.getName() || 'Unnamed'}`,
                    logicalName: section.getName() || '',
                    children: (section.controls?.get() || []).map(mapControl)
                };
            } catch (e) {
                return {
                    label: 'Section: (Error)',
                    logicalName: `Error: ${e.message}`,
                    children: []
                };
            }
        };

        return tabs.map(tab => ({
            label: `Tab: ${tab.getLabel() || tab.getName() || 'Unnamed Tab'}`,
            logicalName: tab.getName() || '',
            children: (tab.sections?.get?.() || []).map(mapSection)
        }));
    },

    /**
     * Get all columns present on the current form with their metadata.
     * @returns {FormColumn[]} Array of form columns
     */
    getFormColumns() {
        return PowerAppsApiService.getAllAttributes().reduce((acc, attribute) => {
            try {
                const logicalName = attribute.getName();
                let displayName = logicalName;

                const controlsLength = attribute.controls?.getLength?.() ?? 0;
                if (controlsLength > 0) {
                    displayName = attribute.controls.get(0)?.getLabel?.() ?? logicalName;
                }

                acc.push({
                    displayName,
                    logicalName,
                    value: formatDisplayValue(attribute.getValue(), attribute),
                    type: attribute.getAttributeType(),
                    isDirty: attribute.getIsDirty(),
                    requiredLevel: attribute.getRequiredLevel(),
                    attribute
                });
            } catch (_e) {
                // Skip attributes that throw during inspection
            }
            return acc;
        }, []);
    },

    /**
     * Get all record columns by merging form attributes with full record data.
     * @param {Function} retrieveRecord - DataService retrieve function
     * @param {Function} getFormColumns - Form columns getter
     * @param {Function} isOdataProperty - Helper to identify OData properties
     * @param {Function} loadMetadata - Metadata service function to ensure metadata is loaded
     * @param {Function} getEntitySetName - Metadata service function to convert logical name to entity set name
     * @param {Function} getAttributeDefinitions - Metadata service function to get attribute definitions
     * @returns {Promise<FormColumn[]>} All columns with metadata
     */
    async getAllRecordColumns(retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions) {
        const entityLogicalName = PowerAppsApiService.getEntityName();
        const entityId = PowerAppsApiService.getEntityId();

        if (!entityId) {
            return getFormColumns();
        }

        // Ensure metadata is loaded before converting entity names
        await loadMetadata();

        // Convert logical name to entity set name for Web API
        const entitySetName = getEntitySetName(entityLogicalName) || entityLogicalName;

        // Fetch attribute metadata, form data, and record data in parallel
        const [formData, recordData, attributeMetadata] = await Promise.all([
            Promise.resolve(getFormColumns()),
            retrieveRecord(entitySetName, entityId),
            getAttributeDefinitions ? getAttributeDefinitions(entityLogicalName, false) : Promise.resolve([])
        ]);

        // Create a map of attribute logical names to their types from metadata
        const attributeTypeMap = new Map();
        if (attributeMetadata && Array.isArray(attributeMetadata)) {
            attributeMetadata.forEach(attr => {
                const logicalName = attr.LogicalName || attr.logicalName;
                const attrType = attr.AttributeType || attr.attributeType;
                if (logicalName && attrType) {
                    attributeTypeMap.set(logicalName.toLowerCase(), attrType.toLowerCase());
                }
            });
        }

        const formColumnMap = new Map(formData.map(c => [c.logicalName, c]));
        const allColumns = [];

        // Process all record properties
        for (const key in recordData) {
            const isSystem = isOdataProperty(key);
            const formColumn = formColumnMap.get(key);

            if (formColumn) {
                allColumns.push({ ...formColumn, onForm: true, isSystem });
                formColumnMap.delete(key);
            } else {
                // Get type from metadata first, fall back to inference
                const metadataType = attributeTypeMap.get(key.toLowerCase());
                const inferredType = inferDataverseType(recordData[key], key);

                allColumns.push({
                    displayName: key,
                    logicalName: key,
                    value: formatDisplayValue(recordData[key]),
                    type: metadataType || inferredType,
                    isDirty: false,
                    requiredLevel: 'none',
                    attribute: null,
                    onForm: false,
                    isSystem
                });
            }
        }

        // Add remaining form columns not in record data
        for (const formColumn of formColumnMap.values()) {
            allColumns.push({ ...formColumn, onForm: true, isSystem: false });
        }

        return allColumns;
    },

    /**
     * Get event handlers (OnLoad, OnSave) from current form's XML and JSON.
     * @param {Function} retrieveRecord - DataService retrieve function `(entity, id, options)`
     * @returns {Promise<{OnLoad: Array, OnSave: Array, OnChange: Array, Other: Array, Libraries: Array, formId: string}>} Event handlers
     */
    async getFormEventHandlers(retrieveRecord) {
        const formId = _getFormIdReliably();
        ValidationService.validateRequired(formId, 'Form ID', Config.VALIDATION_ERRORS.formIdNotFound);

        const formResult = await retrieveRecord('systemform', formId, '?$select=formxml,formjson');
        ValidationService.validateRequired(
            formResult?.formxml || formResult?.formjson,
            'formxml',
            "Retrieved form data but it did not contain a 'formxml' or 'formjson' definition."
        );

        const automations = { OnLoad: [], OnSave: [], OnChange: [], Other: [], Libraries: [], formId, forms: [] };
        const collector = _createHandlerCollector();

        _parseFormDefinition(formResult, automations, collector.add);

        return automations;
    },

    /**
     * Get form event handlers for a specific entity (not current form).
     *
     * Covers every form kind that can carry handlers — Main, Quick View, Quick Create and Card —
     * and aggregates them into one list where each handler records the forms it appears on, so a
     * script registered on eight forms reads as one row rather than eight.
     *
     * Both `formxml` and `formjson` are selected because neither is a complete substitute for the
     * other; that makes this the heaviest read in the tab, which is why `forms` is returned for the
     * caller to show what was scanned.
     * @param {Function} retrieveMultipleRecords - DataService retrieve multiple function
     * @param {Function} retrieveRecord - DataService retrieve function
     * @param {string} entityName - Entity logical name
     * @returns {Promise<{OnLoad: Array, OnSave: Array, OnChange: Array, Other: Array, Libraries: Array, formId: string, forms: Array}|null>} Event handlers or null
     */
    async getFormEventHandlersForEntity(retrieveMultipleRecords, retrieveRecord, entityName) {
        if (!entityName) {
            return null;
        }

        const typeFilter = Object.values(SYSTEM_FORM_TYPES)
            .map(type => `type eq ${type}`)
            .join(' or ');
        // Single quotes are the only OData string terminator, so a doubled quote is the escape.
        const safeEntityName = String(entityName).replace(/'/g, "''");
        const formQueryOptions = `?$filter=objecttypecode eq '${safeEntityName}' and (${typeFilter})` +
            '&$select=formid,name,type,formxml,formjson&$orderby=type,name';
        const formResult = await retrieveMultipleRecords('systemform', formQueryOptions);

        if (!formResult?.entities?.length) {
            return null;
        }

        const automations = {
            OnLoad: [], OnSave: [], OnChange: [], Other: [], Libraries: [],
            formId: formResult.entities[0].formid,
            forms: formResult.entities.map(_describeForm)
        };
        const collector = _createHandlerCollector();

        formResult.entities.forEach((form, index) => {
            collector.useForm(automations.forms[index].name);
            _parseFormDefinition(form, automations, collector.add);
        });

        return automations;
    },

    /**
     * Get performance metrics for current form load.
     * @returns {object} Performance details
     */
    getPerformanceDetails() {
        const perfInfo = PowerAppsApiService.getPerformanceInfo();
        const details = {
            totalLoadTime: 'N/A',
            isApiAvailable: false,
            breakdown: { network: 0, server: 0, client: 0 }
        };

        if (perfInfo?.FCL) {
            const totalLoad = perfInfo.FCL;
            const network = perfInfo.Network || 0;
            const server = perfInfo.Server || 0;

            details.isApiAvailable = true;
            details.totalLoadTime = totalLoad.toFixed(0);
            details.breakdown = {
                network,
                server,
                client: Math.max(0, totalLoad - network - server)
            };
        } else if (window.performance?.getEntriesByType) {
            const navEntry = window.performance.getEntriesByType('navigation')[0];
            if (navEntry) {
                details.totalLoadTime = (navEntry.loadEventEnd - navEntry.startTime).toFixed(0);
            }
        }

        const allTabs = PowerAppsApiService.getAllTabs();
        const allControls = PowerAppsApiService.getAllControls();
        const allAttributes = PowerAppsApiService.getAllAttributes();

        details.uiCounts = {
            tabs: allTabs.length,
            sections: allTabs.reduce((acc, tab) => acc + (tab.sections?.get?.().length || 0), 0),
            controls: allControls.length,
            // Columns, not controls: a subgrid or iFrame is a control but not a column, and the
            // documented mobile limit is stated in columns.
            columns: allAttributes.length,
            onChange: allAttributes.reduce(
                (acc, attr) => acc + (attr.getOnChange?.().length || 0), 0
            )
        };

        // Composition detail the review rules need: what kinds of control the form carries, and
        // what sits on the tab that always initializes.
        const controlTypes = {};
        for (const control of allControls) {
            _tallyControlType(controlTypes, _controlType(control));
        }
        details.controlTypes = controlTypes;
        details.defaultTab = _describeDefaultTab(_findDefaultTab(allTabs));

        return details;
    },

    /**
     * Reads the JavaScript libraries a table's forms load, ready for the review's script rules.
     *
     * **Managed libraries are excluded.** Microsoft's own form scripts and any ISV's arrive in a
     * managed solution and cannot be edited, so reporting findings against them would be noise a
     * maker can do nothing about. They are counted in `system` so the scan can say what it left out.
     *
     * A library that cannot be read — deleted, or hidden from this user — is reported in `skipped`
     * rather than silently treated as clean, so the review never claims to have checked something
     * it could not open.
     * @param {Function} retrieveMultipleRecords - DataService retrieve-multiple function
     * @param {Function} retrieveRecord - DataService retrieve-record function
     * @param {string} entityName - The table's logical name
     * @returns {Promise<{scripts: Array<{name: string, source: string}>, skipped: string[],
     *   system: number}>} The libraries that were read, the names of those that could not be, and
     *   how many managed libraries were deliberately left out.
     */
    async getFormScriptSources(retrieveMultipleRecords, retrieveRecord, entityName) {
        const automations = await this.getFormEventHandlersForEntity(
            retrieveMultipleRecords, retrieveRecord, entityName
        );
        // Libraries is an array of plain web resource names (see _addLibrary), not objects.
        const names = [...new Set(
            (automations.Libraries || [])
                .map(library => (typeof library === 'string' ? library : library?.name))
                .filter(Boolean)
        )];

        // Read the libraries in parallel: a form can load a dozen of them, and serially that is a
        // dozen round trips before the review can run. Each read is settled on its own so one
        // unreadable library still only costs itself.
        const resources = await Promise.all(names.map(async (name) => {
            try {
                // getWebResourceByName already base64-decodes the content column.
                return { name, resource: await this.getWebResourceByName(retrieveMultipleRecords, name) };
            } catch {
                return { name, resource: null };
            }
        }));

        const scripts = [];
        const skipped = [];
        let system = 0;

        // Assembled from the ordered results rather than as each read settles, so the library names a
        // finding reports are in a stable order.
        for (const { name, resource } of resources) {
            if (typeof resource?.content !== 'string') {
                skipped.push(name);
            } else if (resource.isManaged) {
                system += 1;
            } else {
                scripts.push({ name, source: resource.content });
            }
        }

        return { scripts, skipped, system };
    },

    /**
     * Get a web resource by its name.
     * @param {Function} retrieveMultipleRecords - DataService retrieve multiple function
     * @param {string} webResourceName - The name of the web resource (e.g., 'new_/scripts/account.js')
     * @returns {Promise<{id: string, name: string, content: string, webresourcetype: number}|null>} Web resource data or null
     */
    async getWebResourceByName(retrieveMultipleRecords, webResourceName) {
        if (!webResourceName) {
            return null;
        }

        const queryOptions = `?$filter=name eq '${webResourceName}'&$select=webresourceid,name,content,webresourcetype,displayname,iscustomizable,ishidden,ismanaged`;
        const result = await retrieveMultipleRecords('webresource', queryOptions);

        if (!result?.entities?.length) {
            return null;
        }

        const wr = result.entities[0];
        return {
            id: wr.webresourceid,
            name: wr.name,
            displayName: wr.displayname || wr.name,
            content: wr.content ? _decodeWebResourceContent(wr.content) : '',
            webresourcetype: wr.webresourcetype,
            isCustomizable: wr.iscustomizable?.Value !== false,
            isHidden: wr.ishidden?.Value === true,
            isManaged: wr.ismanaged === true
        };
    },

    /**
     * Update a web resource's content.
     * @param {Function} updateRecord - DataService update function
     * @param {string} webResourceId - The GUID of the web resource
     * @param {string} content - The new content (plain text, will be base64 encoded)
     * @returns {Promise<void>}
     */
    async updateWebResourceContent(updateRecord, webResourceId, content) {
        const encoded = encodeURIComponent(content).replace(/%([0-9A-F]{2})/g,
            (_match, hex) => String.fromCharCode(parseInt(hex, 16))
        );
        const encodedContent = globalThis.btoa(encoded);
        await updateRecord('webresource', webResourceId, { content: encodedContent });
    },

    /**
     * Publish a web resource.
     * @param {Function} webApiFetch - DataService web API fetch function
     * @param {string} webResourceId - The GUID of the web resource
     * @returns {Promise<void>}
     */
    async publishWebResource(webApiFetch, webResourceId) {
        const publishXml = `<importexportxml><webresources><webresource>{${webResourceId}}</webresource></webresources></importexportxml>`;
        await webApiFetch('POST', 'PublishXml', '', { ParameterXml: publishXml });
    }
};
