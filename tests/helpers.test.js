/* global describe, it */
import { expect } from 'chai';
import { FilesCollection } from '../server.js';

const helpers = FilesCollection.__helpers;

describe('Helpers - isUndefined', function () {
  it('isUndefined', function () {
    expect(helpers.isUndefined(null), 'isUndefined - null false').to.equal(false);
    expect(helpers.isUndefined(true), 'isUndefined - true false').to.equal(false);
    expect(helpers.isUndefined(false), 'isUndefined - false false').to.equal(false);
    expect(helpers.isUndefined(), 'isUndefined - empty false').to.equal(true);
    expect(helpers.isUndefined([]), 'isUndefined - Array false').to.equal(false);
    expect(helpers.isUndefined(['a']), 'isUndefined - [String] false').to.equal(false);
    expect(helpers.isUndefined(''), 'isUndefined - String empty false').to.equal(false);
    expect(helpers.isUndefined('a'), 'isUndefined - String false').to.equal(false);
    expect(helpers.isUndefined({a: 1}), 'isUndefined - true').to.equal(false);
    expect(helpers.isUndefined({}), 'isUndefined - empty true').to.equal(false);
    expect(helpers.isUndefined(function () { return; }), 'isUndefined ES5 - true').to.equal(false);
    expect(helpers.isUndefined(() => { return; }), 'isUndefined ES6 - true').to.equal(false);
    expect(helpers.isUndefined(void 0), 'isUndefined - void 0').to.equal(true);
    expect(helpers.isUndefined(undefined), 'isUndefined - true').to.equal(true);
    expect(helpers.isUndefined(new Date()), 'isUndefined - new Date()').to.equal(false);
    expect(helpers.isUndefined(+new Date()), 'isUndefined - +new Date()').to.equal(false);
  });
});

describe('Helpers - isObject', function () {
  it('isObject', function () {
    expect(helpers.isObject(null), 'isObject - null false').to.equal(false);
    expect(helpers.isObject(true), 'isObject - true false').to.equal(false);
    expect(helpers.isObject(false), 'isObject - false false').to.equal(false);
    expect(helpers.isObject(), 'isObject - empty false').to.equal(false);
    expect(helpers.isObject([]), 'isObject - Array false').to.equal(false);
    expect(helpers.isObject(['a']), 'isObject - [String] false').to.equal(false);
    expect(helpers.isObject(''), 'isObject - String empty false').to.equal(false);
    expect(helpers.isObject('a'), 'isObject - String false').to.equal(false);
    expect(helpers.isObject({a: 1}), 'isObject - true').to.equal(true);
    expect(helpers.isObject({}), 'isObject - empty true').to.equal(true);
    expect(helpers.isObject(function () { return; }), 'isObject ES5 - true').to.equal(false);
    expect(helpers.isObject(() => { return; }), 'isObject ES6 - true').to.equal(false);
    expect(helpers.isObject(void 0), 'isObject - void 0').to.equal(false);
    expect(helpers.isObject(undefined), 'isObject - true').to.equal(false);
    expect(helpers.isObject(new Date()), 'isObject - new Date()').to.equal(true);
    expect(helpers.isObject(+new Date()), 'isObject - +new Date()').to.equal(false);
  });
});

describe('Helpers - isArray', function () {
  it('isArray', function () {
    expect(helpers.isArray(null), 'isArray - null false').to.equal(false);
    expect(helpers.isArray(true), 'isArray - true false').to.equal(false);
    expect(helpers.isArray(false), 'isArray - false false').to.equal(false);
    expect(helpers.isArray(), 'isArray - empty false').to.equal(false);
    expect(helpers.isArray([]), 'isArray - Array false').to.equal(true);
    expect(helpers.isArray(['a']), 'isArray - [String] false').to.equal(true);
    expect(helpers.isArray(''), 'isArray - String empty false').to.equal(false);
    expect(helpers.isArray('a'), 'isArray - String false').to.equal(false);
    expect(helpers.isArray({a: 1}), 'isArray - true').to.equal(false);
    expect(helpers.isArray({}), 'isArray - empty true').to.equal(false);
    expect(helpers.isArray(function () { return; }), 'isArray ES5 - true').to.equal(false);
    expect(helpers.isArray(() => { return; }), 'isArray ES6 - true').to.equal(false);
    expect(helpers.isArray(void 0), 'isArray - void 0').to.equal(false);
    expect(helpers.isArray(undefined), 'isArray - true').to.equal(false);
    expect(helpers.isArray(new Date()), 'isArray - new Date()').to.equal(false);
    expect(helpers.isArray(+new Date()), 'isArray - +new Date()').to.equal(false);
  });
});

describe('Helpers - isBoolean', function () {
  it('isBoolean', function () {
    expect(helpers.isBoolean(null), 'isBoolean - null false').to.equal(false);
    expect(helpers.isBoolean(true), 'isBoolean - true false').to.equal(true);
    expect(helpers.isBoolean(false), 'isBoolean - false false').to.equal(true);
    expect(helpers.isBoolean(), 'isBoolean - empty false').to.equal(false);
    expect(helpers.isBoolean([]), 'isBoolean - Array false').to.equal(false);
    expect(helpers.isBoolean(['a']), 'isBoolean - [String] false').to.equal(false);
    expect(helpers.isBoolean(''), 'isBoolean - String empty false').to.equal(false);
    expect(helpers.isBoolean('a'), 'isBoolean - String false').to.equal(false);
    expect(helpers.isBoolean({a: 1}), 'isBoolean - true').to.equal(false);
    expect(helpers.isBoolean({}), 'isBoolean - empty true').to.equal(false);
    expect(helpers.isBoolean(function () { return; }), 'isBoolean ES5 - true').to.equal(false);
    expect(helpers.isBoolean(() => { return; }), 'isBoolean ES6 - true').to.equal(false);
    expect(helpers.isBoolean(void 0), 'isBoolean - void 0').to.equal(false);
    expect(helpers.isBoolean(undefined), 'isBoolean - true').to.equal(false);
    expect(helpers.isBoolean(new Date()), 'isBoolean - new Date()').to.equal(false);
    expect(helpers.isBoolean(+new Date()), 'isBoolean - +new Date()').to.equal(false);
  });
});

describe('Helpers - isString', function () {
  it('isString', function () {
    expect(helpers.isString(null), 'isString - null false').to.equal(false);
    expect(helpers.isString(true), 'isString - true false').to.equal(false);
    expect(helpers.isString(false), 'isString - false false').to.equal(false);
    expect(helpers.isString(), 'isString - empty false').to.equal(false);
    expect(helpers.isString([]), 'isString - Array false').to.equal(false);
    expect(helpers.isString(['a']), 'isString - [String] false').to.equal(false);
    expect(helpers.isString(''), 'isString - String empty false').to.equal(true);
    expect(helpers.isString('a'), 'isString - String false').to.equal(true);
    expect(helpers.isString({a: 1}), 'isString - true').to.equal(false);
    expect(helpers.isString({}), 'isString - empty true').to.equal(false);
    expect(helpers.isString(function () { return; }), 'isString ES5 - true').to.equal(false);
    expect(helpers.isString(() => { return; }), 'isString ES6 - true').to.equal(false);
    expect(helpers.isString(void 0), 'isString - void 0').to.equal(false);
    expect(helpers.isString(undefined), 'isString - true').to.equal(false);
    expect(helpers.isString(new Date()), 'isString - new Date()').to.equal(false);
    expect(helpers.isString(+new Date()), 'isString - +new Date()').to.equal(false);
  });
});

describe('Helpers - isNumber', function () {
  it('isNumber', function () {
    expect(helpers.isNumber(null), 'isNumber - null false').to.equal(false);
    expect(helpers.isNumber(true), 'isNumber - true false').to.equal(false);
    expect(helpers.isNumber(false), 'isNumber - false false').to.equal(false);
    expect(helpers.isNumber(), 'isNumber - empty false').to.equal(false);
    expect(helpers.isNumber([]), 'isNumber - Array false').to.equal(false);
    expect(helpers.isNumber(['a']), 'isNumber - [String] false').to.equal(false);
    expect(helpers.isNumber(''), 'isNumber - String empty false').to.equal(false);
    expect(helpers.isNumber('a'), 'isNumber - String false').to.equal(false);
    expect(helpers.isNumber({a: 1}), 'isNumber - true').to.equal(false);
    expect(helpers.isNumber({}), 'isNumber - empty true').to.equal(false);
    expect(helpers.isNumber(function () { return; }), 'isNumber ES5 - true').to.equal(false);
    expect(helpers.isNumber(() => { return; }), 'isNumber ES6 - true').to.equal(false);
    expect(helpers.isNumber(void 0), 'isNumber - void 0').to.equal(false);
    expect(helpers.isNumber(undefined), 'isNumber - true').to.equal(false);
    expect(helpers.isNumber(new Date()), 'isNumber - new Date()').to.equal(false);
    expect(helpers.isNumber(+new Date()), 'isNumber - +new Date()').to.equal(true);
  });
});

describe('Helpers - isDate', function () {
  it('isDate', function () {
    expect(helpers.isDate(null), 'isDate - null false').to.equal(false);
    expect(helpers.isDate(true), 'isDate - true false').to.equal(false);
    expect(helpers.isDate(false), 'isDate - false false').to.equal(false);
    expect(helpers.isDate(), 'isDate - empty false').to.equal(false);
    expect(helpers.isDate([]), 'isDate - Array false').to.equal(false);
    expect(helpers.isDate(['a']), 'isDate - [String] false').to.equal(false);
    expect(helpers.isDate(''), 'isDate - String empty false').to.equal(false);
    expect(helpers.isDate('a'), 'isDate - String false').to.equal(false);
    expect(helpers.isDate({a: 1}), 'isDate - true').to.equal(false);
    expect(helpers.isDate({}), 'isDate - empty true').to.equal(false);
    expect(helpers.isDate(function () { return; }), 'isDate ES5 - true').to.equal(false);
    expect(helpers.isDate(() => { return; }), 'isDate ES6 - true').to.equal(false);
    expect(helpers.isDate(void 0), 'isDate - void 0').to.equal(false);
    expect(helpers.isDate(undefined), 'isDate - true').to.equal(false);
    expect(helpers.isDate(new Date()), 'isDate - new Date()').to.equal(true);
    expect(helpers.isDate(+new Date()), 'isDate - +new Date()').to.equal(false);
  });
});

describe('Helpers - isFunction', function () {
  it('isFunction', function () {
    expect(helpers.isFunction(null), 'isFunction - null false').to.equal(false);
    expect(helpers.isFunction(true), 'isFunction - true false').to.equal(false);
    expect(helpers.isFunction(false), 'isFunction - false false').to.equal(false);
    expect(helpers.isFunction(), 'isFunction - empty false').to.equal(false);
    expect(helpers.isFunction([]), 'isFunction - Array false').to.equal(false);
    expect(helpers.isFunction(['a']), 'isFunction - [String] false').to.equal(false);
    expect(helpers.isFunction(''), 'isFunction - String empty false').to.equal(false);
    expect(helpers.isFunction('a'), 'isFunction - String false').to.equal(false);
    expect(helpers.isFunction({a: 1}), 'isFunction - true').to.equal(false);
    expect(helpers.isFunction({}), 'isFunction - empty true').to.equal(false);
    expect(helpers.isFunction(function () { return; }), 'isFunction ES5 - true').to.equal(true);
    expect(helpers.isFunction(() => { return; }), 'isFunction ES6 - true').to.equal(true);
    expect(helpers.isFunction(void 0), 'isFunction - void 0').to.equal(false);
    expect(helpers.isFunction(undefined), 'isFunction - true').to.equal(false);
    expect(helpers.isFunction(new Date()), 'isFunction - new Date()').to.equal(false);
    expect(helpers.isFunction(+new Date()), 'isFunction - +new Date()').to.equal(false);
  });
});

describe('Helpers - isEmpty', function () {
  it('isEmpty', function () {
    expect(helpers.isEmpty(null), 'isEmpty - null false').to.equal(false);
    expect(helpers.isEmpty(true), 'isEmpty - true false').to.equal(false);
    expect(helpers.isEmpty(false), 'isEmpty - false false').to.equal(false);
    expect(helpers.isEmpty(), 'isEmpty - empty false').to.equal(false);
    expect(helpers.isEmpty([]), 'isEmpty - Array false').to.equal(true);
    expect(helpers.isEmpty(['a']), 'isEmpty - [String] false').to.equal(false);
    expect(helpers.isEmpty(''), 'isEmpty - String empty false').to.equal(true);
    expect(helpers.isEmpty('a'), 'isEmpty - String false').to.equal(false);
    expect(helpers.isEmpty({a: 1}), 'isEmpty - true').to.equal(false);
    expect(helpers.isEmpty({}), 'isEmpty - empty true').to.equal(true);
    expect(helpers.isEmpty(function () { return; }), 'isEmpty ES5 - true').to.equal(false);
    expect(helpers.isEmpty(() => { return; }), 'isEmpty ES6 - true').to.equal(false);
    expect(helpers.isEmpty(void 0), 'isEmpty - void 0').to.equal(false);
    expect(helpers.isEmpty(undefined), 'isEmpty - true').to.equal(false);
    expect(helpers.isEmpty(new Date()), 'isEmpty - new Date()').to.equal(false);
    expect(helpers.isEmpty(+new Date()), 'isEmpty - +new Date()').to.equal(false);
  });
});

describe('Helpers - has', function () {
  it('has', function () {
    expect(helpers.has(null, 'needle'), 'has - null false').to.equal(false);
    expect(helpers.has(true, 'needle'), 'has - true false').to.equal(false);
    expect(helpers.has(false, 'needle'), 'has - false false').to.equal(false);
    expect(helpers.has({}, 'needle'), 'has - empty false').to.equal(false);
    expect(helpers.has([], 'needle'), 'has - Array false').to.equal(false);
    expect(helpers.has(['a'], 'needle'), 'has - [String] false').to.equal(false);
    expect(helpers.has(['needle'], 'needle'), 'has - ["needle"] false').to.equal(false);
    expect(helpers.has('', 'needle'), 'has - String empty false').to.equal(false);
    expect(helpers.has('a', 'needle'), 'has - String false').to.equal(false);
    expect(helpers.has({a: 1}, 'needle'), 'has - true').to.equal(false);
    expect(helpers.has({a: 1}, 'needle'), 'has - true').to.equal(false);
    expect(helpers.has({needle: '123'}, 'needle'), 'has - empty true').to.equal(true);
    expect(helpers.has(function () { return; }, 'needle'), 'has ES5 - true').to.equal(false);
    expect(helpers.has(() => { return; }, 'needle'), 'has ES6 - true').to.equal(false);
    expect(helpers.has(void 0, 'needle'), 'has - void 0').to.equal(false);
    expect(helpers.has(undefined, 'needle'), 'has - true').to.equal(false);
    expect(helpers.has(new Date(), 'needle'), 'has - new Date()').to.equal(false);
    expect(helpers.has(+new Date(), 'needle'), 'has - +new Date()').to.equal(false);
  });
});

describe('Helpers - omit', function () {
  it('omit', function () {
    expect(helpers.isEmpty(helpers.omit({}, 'needle')), 'omit - 1').to.equal(true);
    const test1 = helpers.omit({needle: 1, hay: 2, hey: 3, bar: 4}, 'needle', 'hay');
    expect(test1.hey).to.equal(3);
    expect(test1.bar).to.equal(4);
    expect(helpers.isUndefined(test1.needle)).to.equal(true);
    expect(helpers.isUndefined(test1.hay)).to.equal(true);

    const test2 = helpers.omit({needle: 1, hay: 2, hey: 3, bar: 4}, 'needle', 'hey', 'hay');
    expect(test2.bar).to.equal(4);
    expect(helpers.isUndefined(test2.needle)).to.equal(true);
    expect(helpers.isUndefined(test2.hay)).to.equal(true);
    expect(helpers.isUndefined(test2.hey)).to.equal(true);
  });
});

describe('Helpers - now', function () {
  it('now', function () {
    expect(helpers.now(), 'helpers.now() ~ +new Date()').to.be.closeTo(+new Date(), 50);
  });
});
