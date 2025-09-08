
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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

module.exports = config;
