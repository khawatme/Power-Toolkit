/**
 * @file Manages the injection of the application's CSS stylesheet.
 * @module ui/styleManager
 * @description By simply importing this module and calling init(), Webpack's style-loader
 * will automatically handle the injection of the required CSS into the DOM.
 */

// 1. Webpack sees this import and uses 'css-loader' to process the file.
// 2. Then, 'style-loader' takes the processed CSS and automatically creates
//    and injects a <style> tag into the page <head>.
import '../assets/style.css';

/**
 * This function can be called to explicitly ensure this module has been loaded
 * by the JavaScript engine, thus guaranteeing the styles have been injected.
 * @returns {void}
 */
export const StyleManager = {
    /**
     * This function can be called to explicitly ensure this module has been loaded
     * by the JavaScript engine, thus guaranteeing the styles have been injected.
     */
    init() {
        // The magic happens on import, so this function is just a formality
        // to ensure the module is included in the bundle and evaluated.
        console.log("Power-Toolkit styles initialized.");
    }
};