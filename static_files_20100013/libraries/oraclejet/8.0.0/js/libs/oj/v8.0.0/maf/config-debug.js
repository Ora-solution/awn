/**
 * config for debug libraries
 */

requirejs.config({
  // Path mappings for the logical module names
  paths: {
    'knockout': 'libs/knockout/knockout-3.5.0.debug',
    'jquery': 'libs/jquery/jquery-3.4.1',
    'jqueryui-amd': 'libs/jquery/jqueryui-amd-1.12.1',
    'ojs': 'libs/oj/v8.0.0/debug',
    'ojL10n': 'libs/oj/v8.0.0/ojL10n',
    'ojtranslations': 'libs/oj/v8.0.0/resources',
    'signals': 'libs/js-signals/signals',
    'touchr': 'libs/touchr/touchr',
    'text': 'libs/require/text',
    'promise': 'libs/es6-promise/es6-promise',
    'hammerjs': 'libs/hammer/hammer-2.0.8',
    'ojdnd': 'libs/dnd-polyfill/dnd-polyfill-1.0.1'
  },
  // Shim configurations for modules that do not expose AMD
  shim: {
    'jquery': {
      exports: ['jQuery', '$']
    }
  }
});
