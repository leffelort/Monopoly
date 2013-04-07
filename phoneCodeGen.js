/* Simple node module that generates unique number codes.
 * Keeps track of codes that have already been used.
 */

// Array of codes currently in use
var usedCodes = [];

exports.generate = function() {
  return getNewCode(1000, 9999);
}

exports.return = function(code) {
  var index = usedCodes.indexOf(code);
  if (index !== -1) {
    usedCodes.splice(index, 1)
  }
}

function getNewCode(min, max) {
  var code = Math.floor(Math.random() * (max - min + 1)) + min;
  if (usedCodes.indexOf(code) !== -1) {
    return getNewCode(min, max);
  }
  usedCodes.push(code);
  return code;
}
