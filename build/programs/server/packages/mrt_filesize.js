(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;

/* Package-scope variables */
var filesize;

(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/mrt_filesize/packages/mrt_filesize.js                                               //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
(function () {

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/mrt:filesize/filesize.js                                                     //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
/**                                                                                      // 1
 * filesize                                                                              // 2
 *                                                                                       // 3
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>                                 // 4
 * @copyright 2014 Jason Mulligan                                                        // 5
 * @license BSD-3 <https://raw.github.com/avoidwork/filesize.js/master/LICENSE>          // 6
 * @link http://filesizejs.com                                                           // 7
 * @module filesize                                                                      // 8
 * @version 2.0.3                                                                        // 9
 */                                                                                      // 10
                                                                                         // 11
var bit   = /b$/,                                                                        // 12
    radix = 10,                                                                          // 13
    left  = /.*\./,                                                                      // 14
    zero  = /^0$/;                                                                       // 15
/**                                                                                      // 16
 * SI suffixes                                                                           // 17
 *                                                                                       // 18
 * @type {Object}                                                                        // 19
 */                                                                                      // 20
var si = {                                                                               // 21
	bits  : ["B", "kb", "Mb", "Gb", "Tb", "Pb", "Eb", "Zb", "Yb"],                          // 22
	bytes : ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]                           // 23
};                                                                                       // 24
                                                                                         // 25
/**                                                                                      // 26
 * filesize                                                                              // 27
 *                                                                                       // 28
 * @method filesize                                                                      // 29
 * @param  {Mixed}   arg        String, Int or Float to transform                        // 30
 * @param  {Object}  descriptor [Optional] Flags                                         // 31
 * @return {String}             Readable file size String                                // 32
 */                                                                                      // 33
filesize = function ( arg, descriptor ) {                                                // 34
	var result = "",                                                                        // 35
	    skip   = false,                                                                     // 36
	    e, base, bits, ceil, neg, num, round, unix, spacer, suffix, z, suffixes;            // 37
                                                                                         // 38
	if ( isNaN( arg ) ) {                                                                   // 39
		throw new Error( "Invalid arguments" );                                                // 40
	}                                                                                       // 41
                                                                                         // 42
	descriptor = descriptor || {};                                                          // 43
	bits       = ( descriptor.bits === true );                                              // 44
	unix       = ( descriptor.unix === true );                                              // 45
	base       = descriptor.base     !== undefined ? descriptor.base     : unix ? 2  : 10;  // 46
	round      = descriptor.round    !== undefined ? descriptor.round    : unix ? 1  : 2;   // 47
	spacer     = descriptor.spacer   !== undefined ? descriptor.spacer   : unix ? "" : " "; // 48
	suffixes   = descriptor.suffixes !== undefined ? descriptor.suffixes : {};              // 49
	num        = Number( arg );                                                             // 50
	neg        = ( num < 0 );                                                               // 51
	ceil       = base > 2 ? 1000 : 1024;                                                    // 52
                                                                                         // 53
	// Flipping a negative number to determine the size                                     // 54
	if ( neg ) {                                                                            // 55
		num = -num;                                                                            // 56
	}                                                                                       // 57
                                                                                         // 58
	// Zero is now a special case because bytes divide by 1                                 // 59
	if ( num === 0 ) {                                                                      // 60
		if ( unix ) {                                                                          // 61
			result = "0";                                                                         // 62
		}                                                                                      // 63
		else {                                                                                 // 64
			suffix = "B";                                                                         // 65
			result = "0" + spacer + ( suffixes[suffix] || suffix );                               // 66
		}                                                                                      // 67
	}                                                                                       // 68
	else {                                                                                  // 69
		e = Math.floor( Math.log( num ) / Math.log( 1000 ) );                                  // 70
                                                                                         // 71
		// Exceeding supported length, time to reduce & multiply                               // 72
		if ( e > 8 ) {                                                                         // 73
			result = result * ( 1000 * ( e - 8 ) );                                               // 74
			e      = 8;                                                                           // 75
		}                                                                                      // 76
                                                                                         // 77
		if ( base === 2 ) {                                                                    // 78
			result = num / Math.pow( 2, ( e * 10 ) );                                             // 79
		}                                                                                      // 80
		else {                                                                                 // 81
			result = num / Math.pow( 1000, e );                                                   // 82
		}                                                                                      // 83
                                                                                         // 84
		if ( bits ) {                                                                          // 85
			result = ( result * 8 );                                                              // 86
                                                                                         // 87
			if ( result > ceil ) {                                                                // 88
				result = result / ceil;                                                              // 89
				e++;                                                                                 // 90
			}                                                                                     // 91
		}                                                                                      // 92
                                                                                         // 93
		result = result.toFixed( e > 0 ? round : 0 );                                          // 94
		suffix = si[bits ? "bits" : "bytes"][e];                                               // 95
                                                                                         // 96
		if ( !skip && unix ) {                                                                 // 97
			if ( bits && bit.test( suffix ) ) {                                                   // 98
				suffix = suffix.toLowerCase();                                                       // 99
			}                                                                                     // 100
                                                                                         // 101
			suffix = suffix.charAt( 0 );                                                          // 102
			z      = result.replace( left, "" );                                                  // 103
                                                                                         // 104
			if ( suffix === "B" ) {                                                               // 105
				suffix = "";                                                                         // 106
			}                                                                                     // 107
			else if ( !bits && suffix === "k" ) {                                                 // 108
				suffix = "K";                                                                        // 109
			}                                                                                     // 110
                                                                                         // 111
			if ( zero.test( z ) ) {                                                               // 112
				result = parseInt( result, radix );                                                  // 113
			}                                                                                     // 114
                                                                                         // 115
			result += spacer + ( suffixes[suffix] || suffix );                                    // 116
		}                                                                                      // 117
		else if ( !unix ) {                                                                    // 118
			result += spacer + ( suffixes[suffix] || suffix );                                    // 119
		}                                                                                      // 120
	}                                                                                       // 121
                                                                                         // 122
	// Decorating a 'diff'                                                                  // 123
	if ( neg ) {                                                                            // 124
		result = "-" + result;                                                                 // 125
	}                                                                                       // 126
                                                                                         // 127
	return result;                                                                          // 128
}                                                                                        // 129
                                                                                         // 130
                                                                                         // 131
// // CommonJS, AMD, script tag                                                          // 132
// if ( typeof exports !== "undefined" ) {                                               // 133
// 	module.exports = filesize;                                                           // 134
// }                                                                                     // 135
// else if ( typeof define === "function" ) {                                            // 136
// 	define( function () {                                                                // 137
// 		return filesize;                                                                    // 138
// 	} );                                                                                 // 139
// }                                                                                     // 140
// else {                                                                                // 141
// 	global.filesize = filesize;                                                          // 142
// }                                                                                     // 143
                                                                                         // 144
                                                                                         // 145
///////////////////////////////////////////////////////////////////////////////////////////

}).call(this);

//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['mrt:filesize'] = {}, {
  filesize: filesize
});

})();
