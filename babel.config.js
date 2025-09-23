module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Expo Router auto import / file-based routing
      'expo-router/babel',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': './' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // Keep worklets plugin last
      'react-native-worklets/plugin',
    ],
  };
};
