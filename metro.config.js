// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// Configure react-native-svg-transformer
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
  unstable_allowRequireContext: true,
};

// Add support for importing SVG files
config.resolver.assetExts = resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...resolver.sourceExts, 'svg'];

// config.resolver.unstable_enablePackageExports = true; // Removed - potentially caused axios resolution issues
// config.resolver.unstable_conditionNames = ['require', 'import', 'default']; // Removed - potentially caused axios resolution issues

module.exports = config;