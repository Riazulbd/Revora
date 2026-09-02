const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// React Native Firebase ships .cjs entry points.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

module.exports = config;
