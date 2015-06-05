var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('outpost:date-proxy');
var q = require('q');

var helpers = require('./helpers');
var ObjectProxy = require('./object-proxy');

var DateProxy = ObjectProxy.create({
  name: 'DateProxy',
  properties: {
    date: helpers.descGetterAndSetterVirtual('date'),
    day: helpers.descGetterAndSetterVirtual('day'),
    fullYear: helpers.descGetterAndSetterVirtual('fullYear'),
    hours: helpers.descGetterAndSetterVirtual('hours'),
    milliseconds: helpers.descGetterAndSetterVirtual('milliseconds'),
    minutes: helpers.descGetterAndSetterVirtual('minutes'),
    month: helpers.descGetterAndSetterVirtual('month'),
    seconds: helpers.descGetterAndSetterVirtual('seconds'),
    time: helpers.descGetterAndSetterVirtual('time'),
    timezoneOffset: helpers.descGetterAndSetterVirtual('timezoneOffset'),
    UTCDate: helpers.descGetterAndSetterVirtual('UTCDate'),
    UTCFullYear: helpers.descGetterAndSetterVirtual('UTCFullYear'),
    UTCHours: helpers.descGetterAndSetterVirtual('UTCHours'),
    UTCMilliseconds: helpers.descGetterAndSetterVirtual('UTCMilliseconds'),
    UTCMinutes: helpers.descGetterAndSetterVirtual('UTCMinutes'),
    UTCMonth: helpers.descGetterAndSetterVirtual('UTCMonth'),
    UTCSeconds: helpers.descGetterAndSetterVirtual('UTCSeconds'),
    year: helpers.descGetterAndSetterVirtual('year')
  }
});

DateProxy.prototype.getDate = helpers.wrapFunction('getDate');
DateProxy.prototype.setDate = helpers.wrapSetterFunction('date');
DateProxy.prototype.getDay = helpers.wrapFunction('getDay');
DateProxy.prototype.setDay = helpers.wrapSetterFunction('day');
DateProxy.prototype.getFullYear = helpers.wrapFunction('getFullYear');
DateProxy.prototype.setFullYear = helpers.wrapSetterFunction('fullYear');
DateProxy.prototype.getHours = helpers.wrapFunction('getHours');
DateProxy.prototype.setHours = helpers.wrapSetterFunction('hours');
DateProxy.prototype.getMilliseconds = helpers.wrapFunction('getMilliseconds');
DateProxy.prototype.setMilliseconds = helpers.wrapSetterFunction('milliseconds');
DateProxy.prototype.getMinutes = helpers.wrapFunction('getMinutes');
DateProxy.prototype.setMinutes = helpers.wrapSetterFunction('minutes');
DateProxy.prototype.getMonth = helpers.wrapFunction('getMonth');
DateProxy.prototype.setMonth = helpers.wrapSetterFunction('month');
DateProxy.prototype.getSeconds = helpers.wrapFunction('getSeconds');
DateProxy.prototype.setSeconds = helpers.wrapSetterFunction('seconds');
DateProxy.prototype.getTime = helpers.wrapFunction('getTime');
DateProxy.prototype.setTime = helpers.wrapSetterFunction('time');
DateProxy.prototype.getTimezoneOffset = helpers.wrapFunction('getTimezoneOffset');
DateProxy.prototype.setTimezoneOffset = helpers.wrapSetterFunction('timezoneOffset');
DateProxy.prototype.getUTCDate = helpers.wrapFunction('getUTCDate');
DateProxy.prototype.setUTCDate = helpers.wrapSetterFunction('UTCDate');
DateProxy.prototype.getUTCFullYear = helpers.wrapFunction('getUTCFullYear');
DateProxy.prototype.setUTCFullYear = helpers.wrapSetterFunction('UTCFullYear');
DateProxy.prototype.getUTCHours = helpers.wrapFunction('getUTCHours');
DateProxy.prototype.setUTCHours = helpers.wrapSetterFunction('UTCHours');
DateProxy.prototype.getUTCMilliseconds = helpers.wrapFunction('getUTCMilliseconds');
DateProxy.prototype.setUTCMilliseconds = helpers.wrapSetterFunction('UTCMilliseconds');
DateProxy.prototype.getUTCMinutes = helpers.wrapFunction('getUTCMinutes');
DateProxy.prototype.setUTCMinutes = helpers.wrapSetterFunction('UTCMinutes');
DateProxy.prototype.getUTCMonth = helpers.wrapFunction('getUTCMonth');
DateProxy.prototype.setUTCMonth = helpers.wrapSetterFunction('UTCMonth');
DateProxy.prototype.getUTCSeconds = helpers.wrapFunction('getUTCSeconds');
DateProxy.prototype.setUTCSeconds = helpers.wrapSetterFunction('UTCSeconds');
DateProxy.prototype.getYear = helpers.wrapFunction('getYear');
DateProxy.prototype.setYear = helpers.wrapSetterFunction('year');

DateProxy.prototype.toDateString = helpers.wrapFunction('toDateString');
DateProxy.prototype.toISOString = helpers.wrapFunction('toISOString');
DateProxy.prototype.toJSON = helpers.wrapFunction('toJSON');
DateProxy.prototype.toGMTString = helpers.wrapFunction('toGMTString');
DateProxy.prototype.toLocaleDateString = helpers.wrapFunction('toLocaleDateString');
DateProxy.prototype.toLocaleFormat = helpers.wrapFunction('toLocaleFormat');
DateProxy.prototype.toLocaleString = helpers.wrapFunction('toLocaleString');
DateProxy.prototype.toLocaleTimeString = helpers.wrapFunction('toLocaleTimeString');
DateProxy.prototype.toSource = helpers.wrapFunction('toSource');
DateProxy.prototype.toString = helpers.wrapFunction('toString');
DateProxy.prototype.toTimeString = helpers.wrapFunction('toTimeString');
DateProxy.prototype.toUTCString = helpers.wrapFunction('toUTCString');
DateProxy.prototype.valueOf = helpers.wrapFunction('valueOf');

DateProxy.prototype.toObject = function () {
  return this.__obj;
};

module.exports = DateProxy;
