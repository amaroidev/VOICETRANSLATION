const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: [
        '@expo/vector-icons',
        'react-native-vector-icons',
        '@react-native-async-storage/async-storage',
        'expo-speech',
        'expo-av'
      ]
    }
  }, argv);

  // PWA Configuration
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    'react-native$': 'react-native-web',
    'react-native-vector-icons': '@expo/vector-icons'
  };

  // Add service worker support
  if (config.mode === 'production') {
    // Copy manifest and service worker
    const CopyPlugin = require('copy-webpack-plugin');
    
    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'web-app/manifest.json'),
            to: 'manifest.json'
          },
          {
            from: path.resolve(__dirname, 'web-app/sw.js'),
            to: 'sw.js'
          }
        ]
      })
    );
  }

  // Web-specific optimizations
  config.resolve.extensions = [
    '.web.js',
    '.js',
    '.web.jsx',
    '.jsx',
    '.web.ts',
    '.ts',
    '.web.tsx',
    '.tsx',
    '.json'
  ];

  return config;
};
