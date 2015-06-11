var util = require('util');

exports.defineProxyProperty = function (obj, name, propertyDef) {
  Object.defineProperty(obj, name, {
    enumerable: true,
    get: function () {
      return this.get(name);
    },
    set: function (value) {
      this.set(name, value);
    }
  });
};

exports.descGetterAndSetterVirtual = function (name) {
  var capName = name[0].toUpperCase() + name.slice(1);
  var getterName = 'get' + capName;
  var setterName = 'set' + capName;
  return {
    type: 'virtual',
    get: function () { return this.__obj[getterName](); },
    set: function (value) {
      var oldValue = this.__obj[getterName]();
      if (oldValue !== value) {
        this.__obj[setterName](value);
        this.emit('change', {
          path: name,
          currentPath: name,
          newValue: value,
          oldValue: oldValue
        });
      }
    }
  };
};

exports.wrapSetterFunction = function (name) {
  var capName = name[0].toUpperCase() + name.slice(1);
  var getterName = 'get' + capName;
  var setterName = 'set' + capName;
  return function (value) {
    var oldValue = this.__obj[getterName]();
    if (oldValue !== value) {
      this.__obj[setterName](value);
      this.emit('change', {
          path: name,
          currentPath: name,
          newValue: value,
          oldValue: oldValue
        });
    }
  };
};

exports.wrapFunction = function (name) {
  return function () {
    return this.__obj[name].apply(this.__obj, arguments);
  };
};

exports.toJson = function (o, options) {
  var json, type = typeof o;
  if (type === 'undefined' || type === 'function') {
    return;
  } else if (util.isArray(o)) {
    var arr = [];
    for (var i = 0, l = o.length; i < l; i++) {
      json = exports.toJson(o[i]);
      if (typeof json !== 'undefined') {
        arr.push(json);
      }
    }
    return arr;
  } else if (o !== null && type === 'object') {
    if(typeof o.toJSON === 'function') {
      return o.toJSON(options);
    } else {
      var obj = {};
      for (var p in o) {
        json = exports.toJson(o[p]);
        if (typeof json !== 'undefined') {
          obj[p] = json;
        }
      }
      return obj;
    }
  } else {
    return o;
  }
};

exports.toObject = function (o, options) {
  var obj, type = typeof o;
  if (type === 'undefined' || type === 'function') {
    return;
  } else if (util.isArray(o)) {
    var arr = [];
    for (var i = 0, l = o.length; i < l; i++) {
      obj = exports.toObject(o[i]);
      if (typeof obj !== 'undefined') {
        arr.push(obj);
      }
    }
    return arr;
  } else if (o._bsontype) {
    return o;
  } else if (o !== null && type === 'object') {
    if(typeof o.toObject === 'function') {
      return o.toObject(options);
    } else {
      var child = {};
      for (var p in o) {
        obj = exports.toObject(o[p]);
        if (typeof obj !== 'undefined') {
          child[p] = obj;
        }
      }
      return child;
    }
  } else {
    return o;
  }
};
