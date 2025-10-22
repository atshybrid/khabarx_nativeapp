module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Note: 'expo-router/babel' plugin is no longer required on SDK 50+ and can be removed
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
