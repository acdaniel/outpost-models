var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('outpost:array-proxy');
var q = require('q');

var helpers = require('./helpers');
var ObjectProxy = require('./object-proxy');

var ArrayProxy = ObjectProxy.create({
  name: 'ArrayProxy',
  properties: {
    length: { type: 'number' }
  }
});

// ArrayProxy.prototype.copyWithin = function () {
//   var retVal = this.__obj.copyWithin.apply(this.__obj, arguments);
//   this.emit('change');
//   return retVal;
// };

// ArrayProxy.prototype.fill = function () {
//   var retVal = this.__obj.fill.apply(this.__obj, arguments);
//   this.emit('change');
//   return retVal;
// };

ArrayProxy.prototype.pop = function () {
  var retVal = this.__obj.pop();
  this.emit('change');
  return retVal;
};

ArrayProxy.prototype.push = function () {
  var retVal = this.__obj.push.apply(this.__obj, arguments);
  this.emit('change');
  return retVal;
};

ArrayProxy.prototype.reverse = function () {
  var retVal = this.__obj.reverse();
  this.emit('change');
  return retVal;
};

ArrayProxy.prototype.shift = function () {
  var retVal = this.__obj.shift();
  this.emit('change');
  return retVal;
};

ArrayProxy.prototype.sort = function () {
  var retVal = this.__obj.sort.apply(this.__obj, arguments);
  this.emit('change');
  return retVal;
};

ArrayProxy.prototype.splice = function () {
  var retVal = this.__obj.splice.apply(this.__obj, arguments);
  this.emit('change');
  return retVal;
};

ArrayProxy.prototype.unshift =  function () {
  var retVal = this.__obj.unshift.apply(this.__obj, arguments);
  this.emit('change');
  return retVal;
};

ArrayProxy.prototype.concat = helpers.wrapFunction('concat');
ArrayProxy.prototype.contains = helpers.wrapFunction('contains');
ArrayProxy.prototype.join = helpers.wrapFunction('join');
ArrayProxy.prototype.slice = helpers.wrapFunction('slice');
ArrayProxy.prototype.toSource = helpers.wrapFunction('toSource');
ArrayProxy.prototype.toString = helpers.wrapFunction('toString');
ArrayProxy.prototype.toLocaleString = helpers.wrapFunction('toLocaleString');
ArrayProxy.prototype.indexOf = helpers.wrapFunction('indexOf');
ArrayProxy.prototype.lastIndexOf = helpers.wrapFunction('lastIndexOf');

ArrayProxy.prototype.forEach = helpers.wrapFunction('forEach');
ArrayProxy.prototype.entries = helpers.wrapFunction('entries');
ArrayProxy.prototype.every = helpers.wrapFunction('every');
ArrayProxy.prototype.some = helpers.wrapFunction('some');
ArrayProxy.prototype.filter = helpers.wrapFunction('filter');
ArrayProxy.prototype.find = helpers.wrapFunction('find');
ArrayProxy.prototype.findIndex = helpers.wrapFunction('findIndex');
ArrayProxy.prototype.keys = helpers.wrapFunction('keys');
ArrayProxy.prototype.map = helpers.wrapFunction('map');
ArrayProxy.prototype.reduce = helpers.wrapFunction('reduce');
ArrayProxy.prototype.reduceRight = helpers.wrapFunction('reduceRight');
ArrayProxy.prototype.values = helpers.wrapFunction('values');

ArrayProxy.prototype.toJSON = function () {
  var arr = [];
  for (var i = 0, l = this.__obj.length; i < l; i++) {
    arr[i] = helpers.toJson(this.__obj[i]);
  }
  return arr;
};

ArrayProxy.prototype.toObject = function () {
  var arr = [];
  for (var i = 0, l = this.__obj.length; i < l; i++) {
    arr[i] = helpers.toObject(this.__obj[i]);
  }
  return arr;
};

module.exports = ArrayProxy;
