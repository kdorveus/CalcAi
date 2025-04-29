// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// Add support for importing SVG files
config.resolver.sourceExts.push('svg');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');

// Ensure compatibility with top level await
config.transformer.unstable_allowRequireContext = true;
// config.resolver.unstable_enablePackageExports = true; // Removed - potentially caused axios resolution issues
// config.resolver.unstable_conditionNames = ['require', 'import', 'default']; // Removed - potentially caused axios resolution issues

module.exports = config; 