import { FilesCollection } from 'meteor/ostrio:files';

Tinytest.add('Helpers - isUndefined', test => {
  test.isFalse(FilesCollection.__helpers.isUndefined(null), 'isUndefined - null false');
  test.isFalse(FilesCollection.__helpers.isUndefined(true), 'isUndefined - true false');
  test.isFalse(FilesCollection.__helpers.isUndefined(false), 'isUndefined - false false');
  test.isTrue(FilesCollection.__helpers.isUndefined(), 'isUndefined - empty false');
  test.isFalse(FilesCollection.__helpers.isUndefined([]), 'isUndefined - Array false');
  test.isFalse(FilesCollection.__helpers.isUndefined(['a']), 'isUndefined - [String] false');
  test.isFalse(FilesCollection.__helpers.isUndefined(''), 'isUndefined - String empty false');
  test.isFalse(FilesCollection.__helpers.isUndefined('a'), 'isUndefined - String false');
  test.isFalse(FilesCollection.__helpers.isUndefined({a: 1}), 'isUndefined - true');
  test.isFalse(FilesCollection.__helpers.isUndefined({}), 'isUndefined - empty true');
  test.isFalse(FilesCollection.__helpers.isUndefined(function () { return; }), 'isUndefined ES5 - true');
  test.isFalse(FilesCollection.__helpers.isUndefined(() => { return; }), 'isUndefined ES6 - true');
  test.isTrue(FilesCollection.__helpers.isUndefined(void 0), 'isUndefined - void 0');
  test.isTrue(FilesCollection.__helpers.isUndefined(undefined), 'isUndefined - true');
  test.isFalse(FilesCollection.__helpers.isUndefined(new Date()), 'isUndefined - new Date()');
  test.isFalse(FilesCollection.__helpers.isUndefined(+new Date()), 'isUndefined - +new Date()');
});

Tinytest.add('Helpers - isObject', test => {
  test.isFalse(FilesCollection.__helpers.isObject(null), 'isObject - null false');
  test.isFalse(FilesCollection.__helpers.isObject(true), 'isObject - true false');
  test.isFalse(FilesCollection.__helpers.isObject(false), 'isObject - false false');
  test.isFalse(FilesCollection.__helpers.isObject(), 'isObject - empty false');
  test.isFalse(FilesCollection.__helpers.isObject([]), 'isObject - Array false');
  test.isFalse(FilesCollection.__helpers.isObject(['a']), 'isObject - [String] false');
  test.isFalse(FilesCollection.__helpers.isObject(''), 'isObject - String empty false');
  test.isFalse(FilesCollection.__helpers.isObject('a'), 'isObject - String false');
  test.isTrue(FilesCollection.__helpers.isObject({a: 1}), 'isObject - true');
  test.isTrue(FilesCollection.__helpers.isObject({}), 'isObject - empty true');
  test.isFalse(FilesCollection.__helpers.isObject(function () { return; }), 'isObject ES5 - true');
  test.isFalse(FilesCollection.__helpers.isObject(() => { return; }), 'isObject ES6 - true');
  test.isFalse(FilesCollection.__helpers.isObject(void 0), 'isObject - void 0');
  test.isFalse(FilesCollection.__helpers.isObject(undefined), 'isObject - true');
  test.isTrue(FilesCollection.__helpers.isObject(new Date()), 'isObject - new Date()');
  test.isFalse(FilesCollection.__helpers.isObject(+new Date()), 'isObject - +new Date()');
});

Tinytest.add('Helpers - isArray', test => {
  test.isFalse(FilesCollection.__helpers.isArray(null), 'isArray - null false');
  test.isFalse(FilesCollection.__helpers.isArray(true), 'isArray - true false');
  test.isFalse(FilesCollection.__helpers.isArray(false), 'isArray - false false');
  test.isFalse(FilesCollection.__helpers.isArray(), 'isArray - empty false');
  test.isTrue(FilesCollection.__helpers.isArray([]), 'isArray - Array false');
  test.isTrue(FilesCollection.__helpers.isArray(['a']), 'isArray - [String] false');
  test.isFalse(FilesCollection.__helpers.isArray(''), 'isArray - String empty false');
  test.isFalse(FilesCollection.__helpers.isArray('a'), 'isArray - String false');
  test.isFalse(FilesCollection.__helpers.isArray({a: 1}), 'isArray - true');
  test.isFalse(FilesCollection.__helpers.isArray({}), 'isArray - empty true');
  test.isFalse(FilesCollection.__helpers.isArray(function () { return; }), 'isArray ES5 - true');
  test.isFalse(FilesCollection.__helpers.isArray(() => { return; }), 'isArray ES6 - true');
  test.isFalse(FilesCollection.__helpers.isArray(void 0), 'isArray - void 0');
  test.isFalse(FilesCollection.__helpers.isArray(undefined), 'isArray - true');
  test.isFalse(FilesCollection.__helpers.isArray(new Date()), 'isArray - new Date()');
  test.isFalse(FilesCollection.__helpers.isArray(+new Date()), 'isArray - +new Date()');
});

Tinytest.add('Helpers - isBoolean', test => {
  test.isFalse(FilesCollection.__helpers.isBoolean(null), 'isBoolean - null false');
  test.isTrue(FilesCollection.__helpers.isBoolean(true), 'isBoolean - true false');
  test.isTrue(FilesCollection.__helpers.isBoolean(false), 'isBoolean - false false');
  test.isFalse(FilesCollection.__helpers.isBoolean(), 'isBoolean - empty false');
  test.isFalse(FilesCollection.__helpers.isBoolean([]), 'isBoolean - Array false');
  test.isFalse(FilesCollection.__helpers.isBoolean(['a']), 'isBoolean - [String] false');
  test.isFalse(FilesCollection.__helpers.isBoolean(''), 'isBoolean - String empty false');
  test.isFalse(FilesCollection.__helpers.isBoolean('a'), 'isBoolean - String false');
  test.isFalse(FilesCollection.__helpers.isBoolean({a: 1}), 'isBoolean - true');
  test.isFalse(FilesCollection.__helpers.isBoolean({}), 'isBoolean - empty true');
  test.isFalse(FilesCollection.__helpers.isBoolean(function () { return; }), 'isBoolean ES5 - true');
  test.isFalse(FilesCollection.__helpers.isBoolean(() => { return; }), 'isBoolean ES6 - true');
  test.isFalse(FilesCollection.__helpers.isBoolean(void 0), 'isBoolean - void 0');
  test.isFalse(FilesCollection.__helpers.isBoolean(undefined), 'isBoolean - true');
  test.isFalse(FilesCollection.__helpers.isBoolean(new Date()), 'isBoolean - new Date()');
  test.isFalse(FilesCollection.__helpers.isBoolean(+new Date()), 'isBoolean - +new Date()');
});

Tinytest.add('Helpers - isString', test => {
  test.isFalse(FilesCollection.__helpers.isString(null), 'isString - null false');
  test.isFalse(FilesCollection.__helpers.isString(true), 'isString - true false');
  test.isFalse(FilesCollection.__helpers.isString(false), 'isString - false false');
  test.isFalse(FilesCollection.__helpers.isString(), 'isString - empty false');
  test.isFalse(FilesCollection.__helpers.isString([]), 'isString - Array false');
  test.isFalse(FilesCollection.__helpers.isString(['a']), 'isString - [String] false');
  test.isTrue(FilesCollection.__helpers.isString(''), 'isString - String empty false');
  test.isTrue(FilesCollection.__helpers.isString('a'), 'isString - String false');
  test.isFalse(FilesCollection.__helpers.isString({a: 1}), 'isString - true');
  test.isFalse(FilesCollection.__helpers.isString({}), 'isString - empty true');
  test.isFalse(FilesCollection.__helpers.isString(function () { return; }), 'isString ES5 - true');
  test.isFalse(FilesCollection.__helpers.isString(() => { return; }), 'isString ES6 - true');
  test.isFalse(FilesCollection.__helpers.isString(void 0), 'isString - void 0');
  test.isFalse(FilesCollection.__helpers.isString(undefined), 'isString - true');
  test.isFalse(FilesCollection.__helpers.isString(new Date()), 'isString - new Date()');
  test.isFalse(FilesCollection.__helpers.isString(+new Date()), 'isString - +new Date()');
});

Tinytest.add('Helpers - isNumber', test => {
  test.isFalse(FilesCollection.__helpers.isNumber(null), 'isNumber - null false');
  test.isFalse(FilesCollection.__helpers.isNumber(true), 'isNumber - true false');
  test.isFalse(FilesCollection.__helpers.isNumber(false), 'isNumber - false false');
  test.isFalse(FilesCollection.__helpers.isNumber(), 'isNumber - empty false');
  test.isFalse(FilesCollection.__helpers.isNumber([]), 'isNumber - Array false');
  test.isFalse(FilesCollection.__helpers.isNumber(['a']), 'isNumber - [String] false');
  test.isFalse(FilesCollection.__helpers.isNumber(''), 'isNumber - String empty false');
  test.isFalse(FilesCollection.__helpers.isNumber('a'), 'isNumber - String false');
  test.isFalse(FilesCollection.__helpers.isNumber({a: 1}), 'isNumber - true');
  test.isFalse(FilesCollection.__helpers.isNumber({}), 'isNumber - empty true');
  test.isFalse(FilesCollection.__helpers.isNumber(function () { return; }), 'isNumber ES5 - true');
  test.isFalse(FilesCollection.__helpers.isNumber(() => { return; }), 'isNumber ES6 - true');
  test.isFalse(FilesCollection.__helpers.isNumber(void 0), 'isNumber - void 0');
  test.isFalse(FilesCollection.__helpers.isNumber(undefined), 'isNumber - true');
  test.isFalse(FilesCollection.__helpers.isNumber(new Date()), 'isNumber - new Date()');
  test.isTrue(FilesCollection.__helpers.isNumber(+new Date()), 'isNumber - +new Date()');
});

Tinytest.add('Helpers - isDate', test => {
  test.isFalse(FilesCollection.__helpers.isDate(null), 'isDate - null false');
  test.isFalse(FilesCollection.__helpers.isDate(true), 'isDate - true false');
  test.isFalse(FilesCollection.__helpers.isDate(false), 'isDate - false false');
  test.isFalse(FilesCollection.__helpers.isDate(), 'isDate - empty false');
  test.isFalse(FilesCollection.__helpers.isDate([]), 'isDate - Array false');
  test.isFalse(FilesCollection.__helpers.isDate(['a']), 'isDate - [String] false');
  test.isFalse(FilesCollection.__helpers.isDate(''), 'isDate - String empty false');
  test.isFalse(FilesCollection.__helpers.isDate('a'), 'isDate - String false');
  test.isFalse(FilesCollection.__helpers.isDate({a: 1}), 'isDate - true');
  test.isFalse(FilesCollection.__helpers.isDate({}), 'isDate - empty true');
  test.isFalse(FilesCollection.__helpers.isDate(function () { return; }), 'isDate ES5 - true');
  test.isFalse(FilesCollection.__helpers.isDate(() => { return; }), 'isDate ES6 - true');
  test.isFalse(FilesCollection.__helpers.isDate(void 0), 'isDate - void 0');
  test.isFalse(FilesCollection.__helpers.isDate(undefined), 'isDate - true');
  test.isTrue(FilesCollection.__helpers.isDate(new Date()), 'isDate - new Date()');
  test.isFalse(FilesCollection.__helpers.isDate(+new Date()), 'isDate - +new Date()');
});

Tinytest.add('Helpers - isFunction', test => {
  test.isFalse(FilesCollection.__helpers.isFunction(null), 'isFunction - null false');
  test.isFalse(FilesCollection.__helpers.isFunction(true), 'isFunction - true false');
  test.isFalse(FilesCollection.__helpers.isFunction(false), 'isFunction - false false');
  test.isFalse(FilesCollection.__helpers.isFunction(), 'isFunction - empty false');
  test.isFalse(FilesCollection.__helpers.isFunction([]), 'isFunction - Array false');
  test.isFalse(FilesCollection.__helpers.isFunction(['a']), 'isFunction - [String] false');
  test.isFalse(FilesCollection.__helpers.isFunction(''), 'isFunction - String empty false');
  test.isFalse(FilesCollection.__helpers.isFunction('a'), 'isFunction - String false');
  test.isFalse(FilesCollection.__helpers.isFunction({a: 1}), 'isFunction - true');
  test.isFalse(FilesCollection.__helpers.isFunction({}), 'isFunction - empty true');
  test.isTrue(FilesCollection.__helpers.isFunction(function () { return; }), 'isFunction ES5 - true');
  test.isTrue(FilesCollection.__helpers.isFunction(() => { return; }), 'isFunction ES6 - true');
  test.isFalse(FilesCollection.__helpers.isFunction(void 0), 'isFunction - void 0');
  test.isFalse(FilesCollection.__helpers.isFunction(undefined), 'isFunction - true');
  test.isFalse(FilesCollection.__helpers.isFunction(new Date()), 'isFunction - new Date()');
  test.isFalse(FilesCollection.__helpers.isFunction(+new Date()), 'isFunction - +new Date()');
});

Tinytest.add('Helpers - isEmpty', test => {
  test.isFalse(FilesCollection.__helpers.isEmpty(null), 'isEmpty - null false');
  test.isFalse(FilesCollection.__helpers.isEmpty(true), 'isEmpty - true false');
  test.isFalse(FilesCollection.__helpers.isEmpty(false), 'isEmpty - false false');
  test.isFalse(FilesCollection.__helpers.isEmpty(), 'isEmpty - empty false');
  test.isTrue(FilesCollection.__helpers.isEmpty([]), 'isEmpty - Array false');
  test.isFalse(FilesCollection.__helpers.isEmpty(['a']), 'isEmpty - [String] false');
  test.isTrue(FilesCollection.__helpers.isEmpty(''), 'isEmpty - String empty false');
  test.isFalse(FilesCollection.__helpers.isEmpty('a'), 'isEmpty - String false');
  test.isFalse(FilesCollection.__helpers.isEmpty({a: 1}), 'isEmpty - true');
  test.isTrue(FilesCollection.__helpers.isEmpty({}), 'isEmpty - empty true');
  test.isFalse(FilesCollection.__helpers.isEmpty(function () { return; }), 'isEmpty ES5 - true');
  test.isFalse(FilesCollection.__helpers.isEmpty(() => { return; }), 'isEmpty ES6 - true');
  test.isFalse(FilesCollection.__helpers.isEmpty(void 0), 'isEmpty - void 0');
  test.isFalse(FilesCollection.__helpers.isEmpty(undefined), 'isEmpty - true');
  test.isFalse(FilesCollection.__helpers.isEmpty(new Date()), 'isEmpty - new Date()');
  test.isFalse(FilesCollection.__helpers.isEmpty(+new Date()), 'isEmpty - +new Date()');
});

// Tinytest.add('Helpers - clone', test => {
//   ### ????? ###
// });

Tinytest.add('Helpers - has', test => {
  test.isFalse(FilesCollection.__helpers.has(null, 'needle'), 'has - null false');
  test.isFalse(FilesCollection.__helpers.has(true, 'needle'), 'has - true false');
  test.isFalse(FilesCollection.__helpers.has(false, 'needle'), 'has - false false');
  test.isFalse(FilesCollection.__helpers.has({}, 'needle'), 'has - empty false');
  test.isFalse(FilesCollection.__helpers.has([], 'needle'), 'has - Array false');
  test.isFalse(FilesCollection.__helpers.has(['a'], 'needle'), 'has - [String] false');
  test.isFalse(FilesCollection.__helpers.has(['needle'], 'needle'), 'has - ["needle"] false');
  test.isFalse(FilesCollection.__helpers.has('', 'needle'), 'has - String empty false');
  test.isFalse(FilesCollection.__helpers.has('a', 'needle'), 'has - String false');
  test.isFalse(FilesCollection.__helpers.has({a: 1}, 'needle'), 'has - true');
  test.isFalse(FilesCollection.__helpers.has({a: 1}, 'needle'), 'has - true');
  test.isTrue(FilesCollection.__helpers.has({needle: '123'}, 'needle'), 'has - empty true');
  test.isFalse(FilesCollection.__helpers.has(function () { return; }, 'needle'), 'has ES5 - true');
  test.isFalse(FilesCollection.__helpers.has(() => { return; }, 'needle'), 'has ES6 - true');
  test.isFalse(FilesCollection.__helpers.has(void 0, 'needle'), 'has - void 0');
  test.isFalse(FilesCollection.__helpers.has(undefined, 'needle'), 'has - true');
  test.isFalse(FilesCollection.__helpers.has(new Date(), 'needle'), 'has - new Date()');
  test.isFalse(FilesCollection.__helpers.has(+new Date(), 'needle'), 'has - +new Date()');
});

Tinytest.add('Helpers - omit', test => {
  test.isTrue(FilesCollection.__helpers.isEmpty(FilesCollection.__helpers.omit({}, 'needle')), 'omit - 1');
  const test1 = FilesCollection.__helpers.omit({needle: 1, hay: 2, hey: 3, bar: 4}, 'needle', 'hay');
  test.equal(test1.hey, 3);
  test.equal(test1.bar, 4);
  test.isTrue(FilesCollection.__helpers.isUndefined(test1.needle));
  test.isTrue(FilesCollection.__helpers.isUndefined(test1.hay));

  const test2 = FilesCollection.__helpers.omit({needle: 1, hay: 2, hey: 3, bar: 4}, 'needle', 'hey', 'hay');
  test.equal(test2.bar, 4);
  test.isTrue(FilesCollection.__helpers.isUndefined(test2.needle));
  test.isTrue(FilesCollection.__helpers.isUndefined(test2.hay));
  test.isTrue(FilesCollection.__helpers.isUndefined(test2.hey));
});

Tinytest.add('Helpers - now', test => {
  test.equal(FilesCollection.__helpers.now(), +new Date(), 'FilesCollection.__helpers.now() === +new Date()');
});
