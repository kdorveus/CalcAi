module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-proposal-export-namespace-from', 'react-native-reanimated/plugin'],
    env: {
      production: {
        plugins: [
          // Remove console.log in production for smaller bundle
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};
