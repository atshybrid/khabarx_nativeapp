/**
 * Custom ESLint rule to flag deprecated React Native Web shadow and textShadow props.
 * Enforces usage of makeShadow/makeTextShadow helpers or boxShadow/textShadow string on web.
 */
'use strict';

const SHADOW_PROPS = new Set([
  'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset', 'textShadowColor', 'textShadowRadius', 'textShadowOffset'
]);

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow direct use of deprecated RN Web shadow* and textShadow* style props; use helpers instead', recommended: false },
    messages: {
      deprecatedShadow: 'Avoid "{{prop}}"; use makeShadow/makeTextShadow or web boxShadow/textShadow instead.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowInFiles: { type: 'array', items: { type: 'string' } }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options?.[0] || {};
    const allowIn = options.allowInFiles || [];
    const filename = context.getFilename();
    if (allowIn.some((pattern) => filename.includes(pattern))) {
      return {}; // skip
    }
    function reportIfDeprecated(node, key) {
      if (SHADOW_PROPS.has(key)) {
        context.report({ node, messageId: 'deprecatedShadow', data: { prop: key } });
      }
    }
    return {
      Property(node) {
        // style object literal keys
        if (node.key && !node.computed) {
          const name = node.key.name || (node.key.value != null ? String(node.key.value) : undefined);
          if (name) reportIfDeprecated(node.key, name);
        }
      },
      JSXAttribute(node) {
        if (!node.name) return;
        const name = node.name.name;
        if (name === 'style' && node.value && node.value.expression) {
          // Could traverse inside but cost/benefit low; rely on Property visitor
        }
      }
    };
  }
};
