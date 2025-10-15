const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// Enable tree shaking for better bundle optimization
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Configure react-native-svg-transformer
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
  // Enable minification for production builds
  minifierConfig: {
    compress: {
      // Remove console logs in production
      drop_console: process.env.NODE_ENV === 'production',
      // Additional optimizations
      dead_code: true,
      unused: true,
      // Remove debugger statements
      drop_debugger: true,
      // Optimize boolean expressions
      booleans: true,
      // Optimize loops
      loops: true,
      // Inline simple functions
      inline: 2,
    },
    mangle: {
      // Mangle variable names for smaller bundle
      toplevel: process.env.NODE_ENV === 'production',
    },
    output: {
      // Remove comments
      comments: false,
      // Use ASCII only for better compatibility
      ascii_only: true,
    },
    sourceMap: {
      // Generate source maps for production debugging
      filename: true,
      url: true,
    },
  },
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;
