module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-proposal-export-namespace-from', 'react-native-reanimated/plugin'],
    // Console removal and dead code elimination is handled by Metro minifier
    // Tree shaking is handled by Metro with inlineRequires enabled
  };
};
