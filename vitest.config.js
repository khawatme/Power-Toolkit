/**
 * @file Vitest Configuration
 * @description Test configuration for Power-Toolkit project
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'extension/',
                'tests/',
                '**/*.test.js',
                '**/*.spec.js',
                'vitest.config.js',
                'webpack.config.js',
                'eslint.config.mjs',
            ],
            include: ['src/**/*.js'],
            all: true,
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80,
        },

        include: ['tests/**/*.{test,spec}.js', 'src/**/*.{test,spec}.js'],
        watchExclude: ['**/node_modules/**', '**/dist/**', '**/extension/**'],
        setupFiles: ['./tests/setup.js'],
        testTimeout: 10000,
        hookTimeout: 10000,
        reporters: ['verbose'],
        pool: 'threads',
    },

    poolOptions: {
        threads: {
            singleThread: false,
        },
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@constants': path.resolve(__dirname, './src/constants'),
            '@helpers': path.resolve(__dirname, './src/helpers'),
            '@services': path.resolve(__dirname, './src/services'),
            '@utils': path.resolve(__dirname, './src/utils'),
            '@ui': path.resolve(__dirname, './src/ui'),
            '@core': path.resolve(__dirname, './src/core'),
            '@components': path.resolve(__dirname, './src/components'),
        },
    },
});
