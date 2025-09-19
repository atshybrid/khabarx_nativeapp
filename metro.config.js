
const { getDefaultConfig } = require('expo/metro-config');

// Note: no custom exclusion list required. We keep Metro defaults.

const config = getDefaultConfig(__dirname);

// Work around Windows ENOENT when Metro tries to symbolicate Hermes InternalBytecode.js frames.
// We collapse or remove those frames to avoid Metro reading a non-existent file path.
config.symbolicator = {
  customizeFrame: (frame) => {
    const file = frame?.file || '';
    if (file.includes('InternalBytecode.js')) {
      return { collapse: true };
    }
    return {};
  },
  customizeStack: (stack) => {
    try {
      return stack.filter((f) => !(f?.file || '').includes('InternalBytecode.js'));
    } catch {
      return stack;
    }
  },
};

// Remove the default reporter which causes `require.context` issues.
config.reporter = {
  update: () => {},
};

// Allow all origins for development purposes.
// This is not recommended for production.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return middleware(req, res, next);
    };
  },
};

// Allow expo-image-picker to be bundled (required in development build with native module present).
config.resolver = {
  ...(config.resolver || {}),
};

module.exports = config;
