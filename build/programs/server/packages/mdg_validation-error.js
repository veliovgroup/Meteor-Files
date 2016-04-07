(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var SimpleSchema = Package['aldeed:simple-schema'].SimpleSchema;
var MongoObject = Package['aldeed:simple-schema'].MongoObject;
var meteorInstall = Package.modules.meteorInstall;
var Buffer = Package.modules.Buffer;
var process = Package.modules.process;
var Symbol = Package['ecmascript-runtime'].Symbol;
var Map = Package['ecmascript-runtime'].Map;
var Set = Package['ecmascript-runtime'].Set;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var ValidationError;

var require = meteorInstall({"node_modules":{"meteor":{"mdg:validation-error":{"validation-error.js":["babel-runtime/helpers/classCallCheck","babel-runtime/helpers/possibleConstructorReturn","babel-runtime/helpers/inherits",function(require){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/mdg_validation-error/validation-error.js                                                        //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');                                     //
                                                                                                            //
var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);                                            //
                                                                                                            //
var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');               //
                                                                                                            //
var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);                      //
                                                                                                            //
var _inherits2 = require('babel-runtime/helpers/inherits');                                                 //
                                                                                                            //
var _inherits3 = _interopRequireDefault(_inherits2);                                                        //
                                                                                                            //
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }           //
                                                                                                            //
/* global ValidationError:true */                                                                           //
/* global SimpleSchema */                                                                                   //
                                                                                                            //
// This is exactly what comes out of SS.                                                                    //
var errorSchema = new SimpleSchema({                                                                        // 5
  name: { type: String },                                                                                   // 6
  type: { type: String },                                                                                   // 7
  details: { type: Object, blackbox: true, optional: true }                                                 // 8
});                                                                                                         //
                                                                                                            //
var errorsSchema = new SimpleSchema({                                                                       // 11
  errors: { type: Array },                                                                                  // 12
  'errors.$': { type: errorSchema }                                                                         // 13
});                                                                                                         //
                                                                                                            //
ValidationError = function (_Meteor$Error) {                                                                // 16
  (0, _inherits3['default'])(_class, _Meteor$Error);                                                        //
                                                                                                            //
  function _class(errors) {                                                                                 // 17
    var message = arguments.length <= 1 || arguments[1] === undefined ? 'Validation Failed' : arguments[1];
    (0, _classCallCheck3['default'])(this, _class);                                                         //
                                                                                                            //
    errorsSchema.validate({ errors: errors });                                                              // 18
                                                                                                            //
    var _this = (0, _possibleConstructorReturn3['default'])(this, _Meteor$Error.call(this, ValidationError.ERROR_CODE, message, errors));
                                                                                                            //
    _this.errors = errors;                                                                                  // 22
    return _this;                                                                                           //
  }                                                                                                         //
                                                                                                            //
  return _class;                                                                                            //
}(Meteor.Error);                                                                                            //
                                                                                                            //
// If people use this to check for the error code, we can change it                                         //
// in future versions                                                                                       //
ValidationError.ERROR_CODE = 'validation-error';                                                            // 28
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}]}}}},{"extensions":[".js",".json"]});
require("./node_modules/meteor/mdg:validation-error/validation-error.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['mdg:validation-error'] = {}, {
  ValidationError: ValidationError
});

})();

//# sourceMappingURL=mdg_validation-error.js.map
