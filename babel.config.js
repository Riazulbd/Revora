module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo already wires up the Reanimated/worklets plugin for SDK 57.
  return {
    presets: ['babel-preset-expo'],
  };
};
