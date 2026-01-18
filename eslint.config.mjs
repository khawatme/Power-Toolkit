import unusedImports from 'eslint-plugin-unused-imports';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'extension/background.js',
            '**/*.min.js',
            '**/*.bundle.js'
        ]
    },
    {
        files: ['src/**/*.js'],
        plugins: {
            'unused-imports': unusedImports
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                alert: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                DOMParser: 'readonly',
                HTMLElement: 'readonly',
                Event: 'readonly',
                Option: 'readonly',
                MutationObserver: 'readonly',
                ResizeObserver: 'readonly',
                AbortController: 'readonly',
                crypto: 'readonly',
                // Power Apps/Dynamics 365 globals
                Xrm: 'readonly',
                GetGlobalContext: 'readonly',
                parent: 'readonly'
            }
        },
        rules: {
            // Indentation and formatting
            'indent': ['error', 4, {
                'SwitchCase': 1,
                'ignoredNodes': ['TemplateLiteral *']
            }],
            'quotes': ['error', 'single', { 'avoidEscape': true }],
            'semi': ['error', 'always'],
            'comma-dangle': ['error', 'never'],
            'no-trailing-spaces': 'error',
            'no-multiple-empty-lines': ['error', { 'max': 2 }],
            'brace-style': ['error', '1tbs'],
            'curly': ['error', 'all'],

            // Spacing
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'arrow-spacing': 'error',
            'space-before-function-paren': ['error', {
                'anonymous': 'never',
                'named': 'never',
                'asyncArrow': 'always'
            }],

            // Best practices
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': 'off', // Replaced by unused-imports/no-unused-vars
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': ['error', {
                'vars': 'all',
                'varsIgnorePattern': '^_',
                'args': 'after-used',
                'argsIgnorePattern': '^_',
                'caughtErrors': 'all',
                'caughtErrorsIgnorePattern': '^_'
            }],
            'no-undef': 'error',
            'no-shadow': ['warn', { 'builtinGlobals': false }],
            'no-use-before-define': ['warn', { 'functions': false, 'classes': true, 'variables': true }],
            'consistent-return': 'warn',
            'no-else-return': ['warn', { 'allowElseIf': false }],
            'prefer-arrow-callback': ['warn', { 'allowNamedFunctions': false }],

            // Error prevention
            'no-unreachable': 'error',
            'no-constant-condition': 'error',
            'no-duplicate-imports': 'error',
            'no-self-assign': 'error',
            'no-useless-return': 'warn',
            'no-empty': 'warn',
            'no-extra-boolean-cast': 'error',
            'no-unused-expressions': ['error', { 'allowShortCircuit': true, 'allowTernary': true }],
            'require-await': 'warn',
            'no-return-await': 'warn',
            'no-throw-literal': 'error',

            // Code quality
            'max-len': ['warn', { 'code': 150, 'ignoreStrings': true, 'ignoreTemplateLiterals': true, 'ignoreComments': true }],
            'max-lines-per-function': ['warn', { 'max': 150, 'skipBlankLines': true, 'skipComments': true }],
            'complexity': ['warn', 20],
            'max-depth': ['warn', 5],

            // Development
            'no-console': 'off',
            'no-debugger': 'warn'
        }
    }
];
