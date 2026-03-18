// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 👇 Important: allow Metro to bundle .wasm files for expo-sqlite on web
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;
