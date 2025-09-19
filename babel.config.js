module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated plugin moved; use react-native-worklets/plugin and keep it last
      'react-native-worklets/plugin',
    ],
  };
};
