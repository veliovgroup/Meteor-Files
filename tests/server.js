/* eslint-disable no-console */
/* global before, after */
import './core.test';
import './cursor.test';
import './server.test';
import './helpers.test';
import './mime.test';
import './security.test';
import './browser-fixtures';

// Collections created in tests trigger the allowClientCode and protected: true startup warnings, drop them from the output
const originalWarn = console.warn;
before(function () {
  console.warn = function (...args) {
    if (typeof args[0] === 'string' && (args[0].includes('"allowClientCode" is on') || args[0].includes('"protected: true" is deprecated'))) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

after(function () {
  console.warn = originalWarn;
});
