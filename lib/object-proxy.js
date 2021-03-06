var util = require('util');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('outpost:object-proxy');
var q = require('q');
var bson = require('bson');

var helpers = require('./helpers');

function createChangeListener(propertyName) {
  return function (event) {
    event = event || {};
    var fullpath = propertyName + (event.path ? '.' + event.path : '');
    this.emit('change', {
      path: fullpath,
      currentPath: propertyName,
      newValue: event.newValue,
      oldValue: event.oldValue
    });
  };
}

function ObjectProxy(obj) {
  this.init(obj);
}

util.inherits(ObjectProxy, EventEmitter);

ObjectProxy.prototype.init = function (obj, options) {
  Object.defineProperty(this, '__obj', {
    enumerable: false,
    configurable: true,
    writable: false,
    value: obj || {}
  });
  for (var p in this.__definition.properties) {
    var value = this.__obj[p];
    if (typeof value === 'undefined' || value === null) {
      continue;
    }
    var propertyDef = this.__definition.properties[p];
    var type = propertyDef.type;
    if (type === 'object' || type === 'array' || type === 'date' || type === 'objectid') {
      this.set(p, value, { silent: true });
    }
  }
  var init = this.__definition.init || this.__definition.initialize;
  if (init && typeof init === 'function') {
    init.call(this);
  }
};

ObjectProxy.prototype.set = function (path, value, options) {
  var propertyDef, oldValue, type, changeListener;

  var cast = function (value, type) {
    if (typeof value === 'undefined') {
      value = undefined;
    } else if (type === 'string' && typeof value !== 'string') {
      value = String(value);
    } else if (type === 'number' && typeof value !== 'number') {
      value = Number(value);
    } else if (type === 'boolean' && typeof value !== 'boolean') {
      value = Boolean(value);
    } else if (type === 'array' && !util.isArray(value)) {
      value = new Array(value);
    } else if (type === 'date' && !util.isDate(value)) {
      value = new Date(value);
    } else if (type === 'object' && typeof value !== 'object') {
      value = Object(value);
    } else if (type === 'objectid' || type === 'objectId') {
      value = bson.ObjectId(value.toString());
    }
    return value;
  };

  if (path === null || typeof path === 'undefined') {
    throw new Error('invalid path value');
  }

  if (typeof path === 'object' && !util.isArray(path)) {
    options = value || {};
    _.defaults(options, {
      silent: false
    });
    value = path;
    for (var p in value) {
      this.set(p, value[p], options);
    }
  } else {
    options = options || {};
    _.defaults(options, {
      silent: false
    });
    if (!util.isArray(path)) {
      path = path.split('.');
    }
    propertyDef = this.__definition.properties[path[0]];
    type = propertyDef && propertyDef.type ? propertyDef.type : 'undefined';
    value = cast(value, type);
    if (path.length === 1) {
      if (type === 'virtual') {
        // TODO should virtual setter emit change?
        // oldValue = propertyDef.get.call(this);
        // if (oldValue !== value) {
          propertyDef.set.call(this, value);
          // if (!options.silent) {
            // this.emit('change', path[0], value, oldValue);
          // }
        // }
      } else if (type === 'object' || type === 'array' || type === 'date') {
        oldValue = this.__obj[path[0]] && this.__obj[path[0]].toObject ? this.__obj[path[0]].toObject() : undefined;
        if (!_.isEqual(oldValue, value)) {
          if (typeof this.__obj[path[0]] !== 'undefined' && this.__obj[path[0]].__changeListener) {
            this.__obj[path[0]].removeListener('change', this.__obj[path[0]].__changeListener);
          }
          this.__obj[path[0]] = new propertyDef.proxy(value);
          changeListener = createChangeListener(path[0]).bind(this);
          Object.defineProperty(this.__obj[path[0]], '__changeListener', changeListener);
          this.__obj[path[0]].addListener('change', changeListener);
          if (!options.silent) {
            this.emit('change', { path: path[0], currentPath: path[0], newValue: this.__obj[path[0]], oldValue: oldValue });
          }
        }
      } else {
        oldValue = this.__obj[path[0]];
        if (!_.isEqual(oldValue, value)) {
          this.__obj[path[0]] = value;
          if (!options.silent) {
            this.emit('change', { path: path[0], currentPath: path[0], newValue: value, oldValue: oldValue });
          }
        }
      }
    } else {
      if (type === 'object' && !this.__obj[path[0]]) {
        this.set(path[0], {}, { silent: true });
      } else if (type === 'array' && !this.__obj[path[0]]) {
        this.set(path[0], [], { silent: true });
      }
      var child = this.get(path.shift());
      child.set(path, value, options);
    }
  }
};

ObjectProxy.prototype.get = function (path) {
  if (util.isString(path)) {
    path = path.split('.');
  } else if (!util.isArray(path)) {
    path = [path];
  }
  return path.reduce(function (obj, prop) {
    var propertyDef = obj.__definition.properties[prop];
    return propertyDef && propertyDef.type === 'virtual' ?
      propertyDef.get.call(obj) : obj.__obj[prop];
  }, this);
};

ObjectProxy.prototype.has = function (path) {
  if (!util.isArray(path)) {
    path = path.split('.');
  }
  if (path.length === 1) {
    return typeof this.__obj[path[0]] !== 'undefined';
  }
  return this.get(path.shift()).has(path);
};

ObjectProxy.prototype.getProxiedObject = function () {
  return this.__obj;
};

ObjectProxy.prototype.toObject = function (options) {
  options = options || {};
  _.defaults(options, {
    virtuals: true
  });
  var obj = {};
  for (var p in this.__definition.properties) {
    var propertyDef = this.__definition.properties[p];
    if (!options.virtuals && propertyDef.type === 'virtual') {
      continue;
    }
    var o = helpers.toObject(this[p], options);
    if (typeof o !== 'undefined') {
      obj[p] = o;
    }
  }
  return obj;
};

ObjectProxy.prototype.toJSON = function (options) {
  options = options || {};
  _.defaults(options, {
    virtuals: true
  });
  var obj = {};
  for (var p in this.__definition.properties) {
    var propertyDef = this.__definition.properties[p];
    if (!options.virtuals && propertyDef.type === 'virtual') {
      continue;
    }
    var j = helpers.toJson(this[p], options);
    if (typeof j !== 'undefined') {
      obj[p] = j;
    }
  }
  return obj;
};

ObjectProxy.create = function (definition) {
  var constr = function (obj) {
    ObjectProxy.call(this, obj);
  };
  util.inherits(constr, ObjectProxy);
  ObjectProxy.define(definition, constr);
  return constr;
};

ObjectProxy.define = function (definition, proxy) {
  var DateProxy = require('./date-proxy');
  var ArrayProxy = require('./array-proxy');
  for (var p in definition.properties) {
    var propertyDef = definition.properties[p];
    var type = propertyDef.type ?
      propertyDef.type.trim().toLowerCase() : '*';
    switch (type) {
      case 'object':
        if (!propertyDef.proxy) {
          propertyDef.name = 'ObjectProxy:' + p;
          propertyDef.proxy = ObjectProxy.create(propertyDef);
        }
        helpers.defineProxyProperty(proxy.prototype, p, propertyDef);
        break;
      case 'array':
        propertyDef.proxy = ArrayProxy;
        helpers.defineProxyProperty(proxy.prototype, p, propertyDef);
        break;
      case 'date':
        propertyDef.proxy = DateProxy;
        helpers.defineProxyProperty(proxy.prototype, p, propertyDef);
        break;
      case 'virtual':
        helpers.defineProxyProperty(proxy.prototype, p, propertyDef);
        break;
      case 'objectid':
      case 'string':
      case 'number':
      case 'boolean':
      case 'any':
      case '*':
        helpers.defineProxyProperty(proxy.prototype, p, propertyDef);
        break;
    }
    propertyDef.type = type;
  }
  Object.defineProperty(proxy.prototype, '__definition', {
    writable: false,
    enumerable: false,
    value: definition
  });
};

module.exports = ObjectProxy;
