// @bacons/apple-targets config for the Next Deadline widget extension.
// Discovered during `expo prebuild` when @bacons/apple-targets is in the
// app.json plugins. See WIDGET.md.
module.exports = {
  type: 'widget',
  name: 'NextDeadline',
  deploymentTarget: '17.0',
  // Shared container the app writes the next deadline into.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.av1yan.receiptvault'],
  },
};
