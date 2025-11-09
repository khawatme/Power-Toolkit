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
                // Power Apps/Dynamics 365 globals
                Xrm: 'readonly',
                GetGlobalContext: 'readonly',
                parent: 'readonly'
            }
        },
        rules: {
            // Indentation and formatting
            'indent': ['error', 4],
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
            'no-var': 'warn',
            'prefer-const': 'warn',
            'no-unused-vars': ['warn', {
                'argsIgnorePattern': '^_',
                'caughtErrorsIgnorePattern': '^_'
            }],

            // Development
            'no-console': 'off',
            'no-debugger': 'warn'
        }
    }
];
