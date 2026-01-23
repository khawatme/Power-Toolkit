/**
 * @file Webpack configuration for the Power-Toolkit project.
 * @description This file configures how the source code is bundled, transpiled,
 * and optimized for both development and production environments.
 * 
 * Supports multiple browsers via the --env webpack CLI flag:
 * - webpack --env browser=chrome (default): Builds for Chrome/Edge with service_worker background
 * - webpack --env browser=firefox: Builds for Firefox with background scripts
 * 
 * Usage examples:
 * - npm run build (defaults to Chrome/Edge)
 * - npm run build:firefox (uses --env browser=firefox)
 */

const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const targetBrowser = env?.browser || 'chrome';

    // Determine output directory based on target browser
    const getOutputPath = () => {
        if (targetBrowser === 'firefox') {
            return path.resolve(__dirname, 'dist-firefox');
        }
        return path.resolve(__dirname, 'dist');
    };

    // Get the appropriate manifest file
    const getManifestSource = () => {
        if (targetBrowser === 'firefox') {
            return 'extension/manifest.firefox.json';
        }
        return 'extension/manifest.json';
    };

    return {
        entry: './src/Main.js',
        output: {
            path: getOutputPath(),
            filename: 'extension/power-toolkit.js',
            clean: true,
        },

        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: { presets: ['@babel/preset-env'] }
                    }
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                }
            ]
        },

        optimization: {
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        format: {
                            comments: /@name|@version|@author|@license/i,
                        },
                    },
                    extractComments: false,
                }),
            ],
        },

        plugins: [
            new CopyPlugin({
                patterns: [
                    {
                        from: getManifestSource(),
                        to: 'extension/manifest.json'
                    },
                    { from: 'extension/background.js', to: 'extension/background.js' },
                    { from: 'extension/icons', to: 'extension/icons' }
                ],
            }),
            /*
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                openAnalyzer: false,
                reportFilename: '../bundle-report.html',
                generateStatsFile: true,
                statsFilename: '../bundle-stats.json'
            }),
            */
        ],
        devtool: isProduction ? 'source-map' : 'inline-source-map',
    };
};