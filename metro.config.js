// Metro configuration: start from Expo's defaults and add minimal overrides.
const { getDefaultConfig } = require('expo/metro-config');
let exclusionList;
try {
  // Preferred modern helper
  exclusionList = require('metro-config/src/defaults/exclusionList');
} catch {
  try {
    // Legacy name
    exclusionList = require('metro-config/src/defaults/blacklist');
  } catch {
    exclusionList = null; // If still unavailable, we proceed without blockList.
  }
}
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

// Exclude backup / stale dependency trees if exclusionList helper resolved.
if (exclusionList) {
  config.resolver = {
    ...(config.resolver || {}),
    blockList: exclusionList([
      /node_modules\.old\/.*/,
      /\.cache\/duplicate-modules\/.*/,
      /\/__trash__\//,
    ]),
  };
}

module.exports = config;
