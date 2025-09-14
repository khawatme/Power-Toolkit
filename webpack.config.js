/**
 * @file Webpack configuration for the Power-Toolkit project.
 * @description This file configures how the source code is bundled, transpiled,
 * and optimized for both development and production environments.
 */

const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        // The main entry point of the application.
        entry: './src/main.js',

        // Configuration for the output bundle.
        output: {
            path: path.resolve(__dirname, 'dist'),
            // CHANGE 1: The main bundle is now created directly for the extension.
            filename: 'extension/Power-Toolkit.js',
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
            // CHANGE 2: The CopyPlugin logic is now more robust.
            new CopyPlugin({
                patterns: [
                    // It copies static assets from your source `extension` folder...
                    { from: 'extension/manifest.json', to: 'extension/manifest.json' },
                    { from: 'extension/background.js', to: 'extension/background.js' },
                    { from: 'extension/icons', to: 'extension/icons' },

                    // ...then it copies the ALREADY CREATED bundle file to create the bookmarklet version.
                    // This is safe because the bundle is guaranteed to exist at this point.
                    {
                        from: 'extension/Power-Toolkit.js',
                        to: 'Power-Toolkit.min.js',
                        context: 'dist' // important: tells the plugin to look inside the 'dist' folder for the 'from' path
                    }
                ],
            }),
        ],

        devtool: isProduction ? 'source-map' : 'inline-source-map',
    };
};