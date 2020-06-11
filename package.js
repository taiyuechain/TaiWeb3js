/* jshint ignore:start */
Package.describe({
  name: 'taiyuechain:web3tai',
  version: '1.0.0',
  summary: 'TaiYueChain JavaScript API wrapper repository',
  git: 'https://github.com/taiyuechain/TaiWeb3js',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

// Npm.depends({
//     "xmlhttprequest": "1.7.0"
// });


Package.onUse(function(api) {
  api.versionsFrom('1.0.3.2');

  api.addFiles('dist/web3tai.js', ['client']); // 'server'
});

/* jshint ignore:end */
