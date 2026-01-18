/**
 * @file Test Setup
 * @description Comprehensive global test setup for Vitest
 * Provides mocks for Power Apps/Dynamics 365 API, browser APIs, and utilities
 */

import { beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// MOCK: localStorage
// ============================================================================
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        removeItem: (key) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index) => {
            const keys = Object.keys(store);
            return keys[index] || null;
        },
    };
})();

global.localStorage = localStorageMock;

// ============================================================================
// MOCK: sessionStorage
// ============================================================================
const sessionStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        removeItem: (key) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index) => {
            const keys = Object.keys(store);
            return keys[index] || null;
        },
    };
})();

global.sessionStorage = sessionStorageMock;

// ============================================================================
// MOCK: Clipboard API
// ============================================================================
global.navigator = {
    ...global.navigator,
    clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
        readText: vi.fn(() => Promise.resolve('')),
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Test Browser',
};

// ============================================================================
// MOCK: crypto API (only if not already defined)
// ============================================================================
try {
    if (!global.crypto || !global.crypto.randomUUID) {
        Object.defineProperty(global, 'crypto', {
            value: {
                randomUUID: vi.fn(() => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                })),
                getRandomValues: vi.fn((arr) => {
                    for (let i = 0; i < arr.length; i++) {
                        arr[i] = Math.floor(Math.random() * 256);
                    }
                    return arr;
                }),
            },
            writable: true,
            configurable: true,
        });
    }
} catch (e) {
    // crypto already exists and is read-only, that's fine
}

// ============================================================================
// MOCK: fetch API
// ============================================================================
global.fetch = vi.fn((url, options = {}) => {
    // Default successful response
    return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
            ['Content-Type', 'application/json'],
            ['OData-EntityId', 'https://org.crm.dynamics.com/api/data/v9.2/accounts(12345678-1234-1234-1234-123456789012)'],
        ]),
        json: () => Promise.resolve({ value: [] }),
        text: () => Promise.resolve(''),
        clone: function () { return this; },
    });
});

// Helper to create fetch response mocks
global.createFetchResponse = (data, options = {}) => {
    const { ok = true, status = 200, statusText = 'OK', headers = {} } = options;
    const headersMap = new Map(Object.entries({
        'Content-Type': 'application/json',
        ...headers
    }));

    return Promise.resolve({
        ok,
        status,
        statusText,
        headers: {
            get: (name) => headersMap.get(name) || null,
            has: (name) => headersMap.has(name),
        },
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
        clone: function () { return this; },
    });
};

// Helper to create error response
global.createFetchError = (status, message, odataError = null) => {
    const body = odataError || { error: { message, code: status.toString() } };
    return Promise.resolve({
        ok: false,
        status,
        statusText: message,
        headers: {
            get: () => null,
            has: () => false,
        },
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
        clone: function () { return this; },
    });
};

// ============================================================================
// MOCK: Xrm Attribute
// ============================================================================
const createMockAttribute = (logicalName, value, type = 'string', options = {}) => {
    let currentValue = value;
    let isDirty = options.isDirty || false;
    const onChangeHandlers = [];

    return {
        getName: () => logicalName,
        getAttributeType: () => type,
        getValue: () => currentValue,
        setValue: vi.fn((newValue) => {
            currentValue = newValue;
            isDirty = true;
            onChangeHandlers.forEach(h => h());
        }),
        getIsDirty: () => isDirty,
        setIsDirty: (val) => { isDirty = val; },
        getRequiredLevel: () => options.requiredLevel || 'none',
        setRequiredLevel: vi.fn(),
        getText: () => options.text || String(currentValue),
        getFormat: () => options.format || null,
        getMaxLength: () => options.maxLength || 100,
        getMin: () => options.min || null,
        getMax: () => options.max || null,
        getPrecision: () => options.precision || 2,
        getOptions: () => options.optionSetOptions || [],
        getOption: (val) => options.optionSetOptions?.find(o => o.value === val) || null,
        getSelectedOption: () => options.optionSetOptions?.find(o => o.value === currentValue) || null,
        addOnChange: (handler) => { onChangeHandlers.push(handler); },
        removeOnChange: (handler) => {
            const idx = onChangeHandlers.indexOf(handler);
            if (idx > -1) onChangeHandlers.splice(idx, 1);
        },
        fireOnChange: () => { onChangeHandlers.forEach(h => h()); },
        controls: {
            get: () => options.controls || [],
            forEach: (fn) => (options.controls || []).forEach(fn),
        },
    };
};

// ============================================================================
// MOCK: Xrm Control
// ============================================================================
const createMockControl = (name, attribute = null, options = {}) => ({
    getName: () => name,
    getLabel: () => options.label || name,
    setLabel: vi.fn(),
    getVisible: () => options.visible !== false,
    setVisible: vi.fn(),
    getDisabled: () => options.disabled || false,
    setDisabled: vi.fn(),
    getAttribute: () => attribute,
    getControlType: () => options.controlType || 'standard',
    setFocus: vi.fn(),
    clearNotification: vi.fn(),
    setNotification: vi.fn(),
    addNotification: vi.fn(),
    getOptions: () => options.optionSetOptions || [],
    addOption: vi.fn(),
    removeOption: vi.fn(),
    clearOptions: vi.fn(),
});

// ============================================================================
// MOCK: Xrm Section
// ============================================================================
const createMockSection = (name, controls = [], options = {}) => ({
    getName: () => name,
    getLabel: () => options.label || name,
    setLabel: vi.fn(),
    getVisible: () => options.visible !== false,
    setVisible: vi.fn(),
    getParent: () => options.parent || null,
    controls: {
        get: (nameOrIndex) => {
            if (typeof nameOrIndex === 'number') return controls[nameOrIndex];
            if (typeof nameOrIndex === 'string') return controls.find(c => c.getName() === nameOrIndex);
            return controls;
        },
        getLength: () => controls.length,
        forEach: (fn) => controls.forEach(fn),
    },
});

// ============================================================================
// MOCK: Xrm Tab
// ============================================================================
const createMockTab = (name, sections = [], options = {}) => ({
    getName: () => name,
    getLabel: () => options.label || name,
    setLabel: vi.fn(),
    getVisible: () => options.visible !== false,
    setVisible: vi.fn(),
    getDisplayState: () => options.displayState || 'expanded',
    setDisplayState: vi.fn(),
    getParent: () => options.parent || null,
    sections: {
        get: (nameOrIndex) => {
            if (typeof nameOrIndex === 'number') return sections[nameOrIndex];
            if (typeof nameOrIndex === 'string') return sections.find(s => s.getName() === nameOrIndex);
            return sections;
        },
        getLength: () => sections.length,
        forEach: (fn) => sections.forEach(fn),
    },
});

// ============================================================================
// MOCK: Xrm FormContext (Page)
// ============================================================================
const createMockFormContext = (entityName = 'account', recordId = '12345678-1234-1234-1234-123456789012') => {
    const attributes = [];
    const controls = [];
    const tabs = [];

    return {
        data: {
            entity: {
                getEntityName: () => entityName,
                getId: () => `{${recordId}}`,
                getPrimaryAttributeValue: () => 'Test Record',
                getIsDirty: () => false,
                save: vi.fn(() => Promise.resolve()),
                refresh: vi.fn(() => Promise.resolve()),
                attributes: {
                    get: (nameOrIndex) => {
                        if (typeof nameOrIndex === 'number') return attributes[nameOrIndex];
                        if (typeof nameOrIndex === 'string') return attributes.find(a => a.getName() === nameOrIndex);
                        return attributes;
                    },
                    getLength: () => attributes.length,
                    forEach: (fn) => attributes.forEach(fn),
                },
                addOnSave: vi.fn(),
                removeOnSave: vi.fn(),
            },
            process: {
                getActiveProcess: () => null,
                getActiveStage: () => null,
                getActivePath: () => ({ get: () => [] }),
            },
            refresh: vi.fn(() => Promise.resolve()),
            save: vi.fn(() => Promise.resolve()),
            isValid: () => true,
        },
        ui: {
            getFormType: () => 2, // Update form
            getViewPortWidth: () => 1920,
            getViewPortHeight: () => 1080,
            refreshRibbon: vi.fn(),
            setFormNotification: vi.fn(),
            clearFormNotification: vi.fn(),
            close: vi.fn(),
            tabs: {
                get: (nameOrIndex) => {
                    if (typeof nameOrIndex === 'number') return tabs[nameOrIndex];
                    if (typeof nameOrIndex === 'string') return tabs.find(t => t.getName() === nameOrIndex);
                    return tabs;
                },
                getLength: () => tabs.length,
                forEach: (fn) => tabs.forEach(fn),
            },
            controls: {
                get: (nameOrIndex) => {
                    if (typeof nameOrIndex === 'number') return controls[nameOrIndex];
                    if (typeof nameOrIndex === 'string') return controls.find(c => c.getName() === nameOrIndex);
                    return controls;
                },
                getLength: () => controls.length,
                forEach: (fn) => controls.forEach(fn),
            },
            formSelector: {
                getCurrentItem: () => ({
                    getId: () => 'form-12345',
                    getLabel: () => 'Main Form',
                }),
                items: { get: () => [] },
            },
            navigation: { items: { get: () => [] } },
            quickForms: { get: () => [] },
            process: null,
        },
        context: {
            getClientUrl: () => 'https://org.crm.dynamics.com',
            getClient: () => 'Web',
            getFormFactor: () => 1,
            getUserId: () => '{11111111-1111-1111-1111-111111111111}',
            getUserName: () => 'Test User',
            getUserRoles: () => ['22222222-2222-2222-2222-222222222222'],
            getUserLcid: () => 1033,
            getOrgUniqueName: () => 'testorg',
            getOrgLcid: () => 1033,
            getVersion: () => '9.2.0.0',
            isAutoSaveEnabled: () => true,
            getTimeZoneOffsetMinutes: () => -300,
        },
        getAttribute: (name) => attributes.find(a => a.getName() === name),
        getControl: (name) => controls.find(c => c.getName() === name),
        // Expose for test setup
        _addAttribute: (attr) => attributes.push(attr),
        _addControl: (ctrl) => controls.push(ctrl),
        _addTab: (tab) => tabs.push(tab),
        _getAttributes: () => attributes,
        _getControls: () => controls,
        _getTabs: () => tabs,
    };
};

// ============================================================================
// MOCK: Xrm Global Object
// ============================================================================
const globalContextMock = {
    getVersion: () => '9.2.0.0',
    getClientUrl: () => 'https://org.crm.dynamics.com',
    getClient: () => 'Web',
    getFormFactor: () => 1,
    getUserId: () => '{11111111-1111-1111-1111-111111111111}',
    getUserName: () => 'Test User',
    getUserRoles: () => ['22222222-2222-2222-2222-222222222222'],
    getUserLcid: () => 1033,
    getOrgUniqueName: () => 'testorg',
    getOrgLcid: () => 1033,
    getCurrentAppUrl: () => 'https://org.crm.dynamics.com/main.aspx?appid=12345',
    getCurrentAppName: () => 'Test App',
    isOnPremises: () => false,
    prependOrgName: (path) => `/testorg${path}`,
    getTimeZoneOffsetMinutes: () => -300,
    userSettings: {
        userId: '11111111-1111-1111-1111-111111111111',
        userName: 'Test User',
        languageId: 1033,
        dateFormattingInfo: {
            AMDesignator: 'AM',
            PMDesignator: 'PM',
            ShortDatePattern: 'M/d/yyyy',
            LongDatePattern: 'dddd, MMMM d, yyyy',
        },
    },
};

global.Xrm = {
    Page: null, // Set to null by default, tests can set to formContext
    Utility: {
        getGlobalContext: () => globalContextMock,
        showProgressIndicator: vi.fn(),
        closeProgressIndicator: vi.fn(),
        alertDialog: vi.fn(() => Promise.resolve()),
        confirmDialog: vi.fn(() => Promise.resolve({ confirmed: true })),
        lookupObjects: vi.fn(() => Promise.resolve([])),
        getEntityMetadata: vi.fn((entity) => Promise.resolve({
            LogicalName: entity,
            EntitySetName: entity + 's',
            DisplayName: entity,
            PrimaryIdAttribute: entity + 'id',
            PrimaryNameAttribute: 'name',
        })),
        getResourceString: vi.fn((key) => key),
    },
    WebApi: {
        online: {
            retrieveMultipleRecords: vi.fn((entity, options) => Promise.resolve({ entities: [], nextLink: null })),
            retrieveRecord: vi.fn((entity, id, options) => Promise.resolve({})),
            createRecord: vi.fn((entity, data) => Promise.resolve({ id: '12345678-1234-1234-1234-123456789012' })),
            updateRecord: vi.fn((entity, id, data) => Promise.resolve({})),
            deleteRecord: vi.fn((entity, id) => Promise.resolve({})),
            execute: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
            executeMultiple: vi.fn(() => Promise.resolve([])),
        },
        offline: {
            retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] })),
            retrieveRecord: vi.fn(() => Promise.resolve({})),
            createRecord: vi.fn(() => Promise.resolve({ id: '12345678-1234-1234-1234-123456789012' })),
            updateRecord: vi.fn(() => Promise.resolve({})),
            deleteRecord: vi.fn(() => Promise.resolve({})),
        },
    },
    Navigation: {
        openForm: vi.fn(() => Promise.resolve()),
        openUrl: vi.fn(),
        openAlertDialog: vi.fn(() => Promise.resolve()),
        openConfirmDialog: vi.fn(() => Promise.resolve({ confirmed: true })),
        openErrorDialog: vi.fn(() => Promise.resolve()),
        openFile: vi.fn(() => Promise.resolve()),
        openWebResource: vi.fn(() => Promise.resolve()),
    },
    Panel: {
        loadPanel: vi.fn(() => Promise.resolve()),
    },
    Encoding: {
        xmlEncode: (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        xmlDecode: (value) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
    },
};

// ============================================================================
// MOCK: GetGlobalContext (standalone)
// ============================================================================
global.GetGlobalContext = () => globalContextMock;

// ============================================================================
// MOCK: Performance API
// ============================================================================
global.performance = {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
};

// ============================================================================
// MOCK: URL API
// ============================================================================
global.URL = class URL {
    constructor(url, base) {
        const fullUrl = base ? new globalThis.URL(url, base) : url;
        const parsed = typeof fullUrl === 'string' ? this._parse(fullUrl) : fullUrl;
        this.href = parsed.href || fullUrl;
        this.origin = parsed.origin || 'https://org.crm.dynamics.com';
        this.protocol = parsed.protocol || 'https:';
        this.host = parsed.host || 'org.crm.dynamics.com';
        this.hostname = parsed.hostname || 'org.crm.dynamics.com';
        this.pathname = parsed.pathname || '/';
        this.search = parsed.search || '';
        this.searchParams = new URLSearchParams(this.search);
        this.hash = parsed.hash || '';
    }

    _parse(url) {
        const match = url.match(/^(https?:)\/\/([^\/]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
        if (!match) return { href: url };
        return {
            href: url,
            protocol: match[1],
            host: match[2],
            hostname: match[2].split(':')[0],
            origin: `${match[1]}//${match[2]}`,
            pathname: match[3] || '/',
            search: match[4] || '',
            hash: match[5] || '',
        };
    }

    toString() { return this.href; }
};

// ============================================================================
// MOCK: DOM APIs
// ============================================================================
// Mock window.location
Object.defineProperty(global, 'location', {
    value: {
        href: 'https://org.crm.dynamics.com/main.aspx?appid=12345&pagetype=entityrecord&etn=account&id=12345678-1234-1234-1234-123456789012',
        origin: 'https://org.crm.dynamics.com',
        pathname: '/main.aspx',
        search: '?appid=12345&pagetype=entityrecord&etn=account&id=12345678-1234-1234-1234-123456789012',
        hash: '',
        host: 'org.crm.dynamics.com',
        hostname: 'org.crm.dynamics.com',
        protocol: 'https:',
        reload: vi.fn(),
        assign: vi.fn(),
        replace: vi.fn(),
    },
    writable: true,
});

// Mock window.open
global.open = vi.fn(() => ({
    document: { write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    close: vi.fn(),
}));

// Mock window.close
global.close = vi.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// ============================================================================
// MOCK: Notification API
// ============================================================================
global.Notification = class Notification {
    static permission = 'granted';
    static requestPermission = vi.fn(() => Promise.resolve('granted'));
    constructor(title, options) {
        this.title = title;
        this.options = options;
    }
    close() { }
};

// ============================================================================
// EXPORT: Test helpers
// ============================================================================
global.createMockAttribute = createMockAttribute;
global.createMockControl = createMockControl;
global.createMockSection = createMockSection;
global.createMockTab = createMockTab;
global.createMockFormContext = createMockFormContext;

// ============================================================================
// HOOKS: Reset state before each test
// ============================================================================
beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    // Reset Xrm.Page to null (tests should set it if needed)
    global.Xrm.Page = null;

    // Reset fetch to default behavior
    global.fetch.mockImplementation(() => createFetchResponse({ value: [] }));
});

afterEach(() => {
    // Clean up any DOM additions
    document.body.innerHTML = '';
});
