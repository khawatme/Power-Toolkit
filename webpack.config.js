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
        entry: './src/Main.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
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
                    { from: 'extension/manifest.json', to: 'extension/manifest.json' },
                    { from: 'extension/background.js', to: 'extension/background.js' },
                    { from: 'extension/icons', to: 'extension/icons' }
                ],
            }),
        ],
        devtool: isProduction ? 'source-map' : 'inline-source-map',
    };
};