/* eslint-disable no-console */
/* global before, after */
import './core.test';
import './cursor.test';
import './server.test';
import './helpers.test';
import './security.test';

// Collections created in tests do not set `onBeforeRemove`, drop the S5 startup warning from the output
const originalWarn = console.warn;
before(function () {
  console.warn = function (...args) {
    if (typeof args[0] === 'string' && args[0].includes('"allowClientCode" is on')) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

after(function () {
  console.warn = originalWarn;
});
