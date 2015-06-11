var q = require('q');
var _ = require('lodash');
var util = require('util');
var joi = require('joi');
var etag = require('etag');
var debug = require('debug')('outpost-models:model');
var bson = require('bson');

var ObjectProxy = require('./object-proxy');

var Model = {};

Model.extend = function (definition) {

  var schema = {};

  if (!definition.name) {
    throw new Error('A model name is required');
  }

  definition.properties._id = { type: 'objectid' };

  definition.properties._etag = { type: 'string' };

  for (var p in definition.properties) {
    var propertyDef = definition.properties[p];
    if (propertyDef.type !== 'virtual') {
      schema[p] = buildPropertySchema(p, propertyDef);
    }
  }

  var proxy = ObjectProxy.create(definition);

  var constr = function (db, data) {
    proxy.call(this, data);
    this._db = db;
    Object.defineProperty(this, '__modified', {
      enumerable: false,
      writable: true,
      value: {}
    });
    this.on('change', function (event) {
      this.markAsModified(event.path, event.newValue, event.oldValue);
    }.bind(this));
    var init = definition.init || definition.initialize;
    if (init && typeof init === 'function') {
      init.call(this);
    }
  };

  util.inherits(constr, proxy);
  Object.defineProperty(constr, 'modelName', {
    value: definition.name,
    writable: false
  });

  constr.prototype._reset = function (obj, options) {
    proxy.prototype._reset.apply(this, arguments);
    this.__modified = {};
  };

  constr.prototype.validate = function (options) {
    var deferred = q.defer();
    _.defaults(options, {
      abortEarly: false,
      convert: true,
      allowUnknown: false,
      skipFunctions: true,
      stripUnknown: true,
    });
    joi.validate(this.toJSON({ virtuals: false }), schema, options, function (err, value) {
      if (err) { return deferred.reject(err); }
      deferred.resolve(value);
    });
    return deferred.promise;
  };

  constr.prototype.save = function (options) {
    return this.validate(options)
      .then(
        function (value) {
          this.set(value);
          if (!this.isModified()) {
            return this;
          } else {
            var obj = this.toObject({ virtuals: false });
            obj._etag = etag(JSON.stringify(obj));
            if (this._id) {
              var where = { _id: this._id, _etag: this._etag };
              var $set = { _etag: obj._etag };
              for (var p in this.__modified) {
                $set[p] = obj[p];
              }
              $set = { $set: $set };
              debug('updating ' + JSON.stringify(where) + ' in ' + definition.collection + ': ' + JSON.stringify($set));
              return this._db.collection(definition.collection)
                .then(function(collection) {
                  var deferred = q.defer();
                  collection.updateOne(where, $set, function (err, result) {
                    if (err) { return deferred.reject(err); }
                    debug('update into ' + definition.collection + ' successful');
                    this.__modified = {};
                    this.__obj._etag = obj._etag;
                    return deferred.resolve(this);
                  }.bind(this));
                  return deferred.promise;
                }.bind(this));
            } else {
              debug('inserting into ' + definition.collection + ': ' + JSON.stringify(obj));
              return this._db.collection(definition.collection)
                .then(function(collection) {
                  var deferred = q.defer();
                  collection.insertOne(obj, function (err, result) {
                    if (err) { return deferred.reject(err); }
                    debug('insert into ' + definition.collection + ' successful');
                    this._reset(Array.isArray(result.ops) ? result.ops[0] : result.ops);
                    return deferred.resolve(this);
                  }.bind(this));
                  return deferred.promise;
                }.bind(this));
            }
          }
        }.bind(this),
        function (err) {
          console.log(err);
          throw err;
        }.bind(this)
      );
  };

  constr.prototype.remove = function () {
    var where = { _id: this._id, _etag: this._etag };
    debug('removing ' + JSON.stringify(where) + ' in ' + definition.collection);
    return this._db.collection(definition.collection)
      .then(function(collection) {
        var deferred = q.defer();
        collection.deleteOne(where, function (err, result) {
          if (err) { return deferred.reject(err); }
          debug('remove from ' + definition.collection + ' successful');
          this._id = undefined;
          this._etag = undefined;
          this.__modified = [];
          return deferred.resolve();
        }.bind(this));
        return deferred.promise;
      }.bind(this));
  };

  constr.prototype.markAsModified = function (path, _newValue, _oldValue) {
    var partialPath = null;
    if (!util.isArray(path)) {
      path = path.split('.');
    }
    for (var i = 0, l = path.length - 1; i < l; i++) {
      partialPath = partialPath ? partialPath + '.' + path[i] : path[i];
      debug('marking ' + partialPath + ' as modified');
      this.__modified[partialPath] = true;
    }
    debug('marking ' + path.join('.') + ' as modified');
    this.__modified[path.join('.')] = { oldValue: _oldValue, newValue: _newValue };
  };

  constr.prototype.isModified = function (path) {
    if (util.isArray(path)) {
      path = path.join('.');
    }
    return !path ? Object.keys(this.__modified).length > 0 : !!this.__modified[path];
  };

  constr.prototype.after = function (method, afterFunc) {
    var oFunc = this[method];
    this[method] = function composedFunc () {
      var val = oFunc.apply(this, arguments);
      if (val instanceof q.Promise) {
        return val.then(function () {
          afterFunc.apply(this, arguments);
        });
      } else {
        afterFunc.apply(this, arguments);
      }
    };
  };

  constr.prototype.before = function (method, beforeFunc) {
    var oFunc = this[method];
    this[method] = function composedFunc () {
      beforeFunc.apply(this, arguments);
      return oFunc.apply(this, arguments);
    };
  };

  constr.count = function (db, where, options) {
    where = where || {};
    options = options || {};
    for (var p in where) {
      var propertyDef = definition.properties[p];
      if (propertyDef) {
        where[p] = castProperty(p, where[p], propertyDef);
      } else {
        delete where[p];
      }
    }
    debug('counting ' + JSON.stringify(where) + ' in ' + definition.collection);
    return db.collection(definition.collection)
      .then(function (collection) {
        var deferred = q.defer();
        collection.count(where, options, function (err, count) {
          if (err) { return deferred.reject(err); }
          deferred.resolve(count);
        });
        return deferred.promise;
      });
  };

  constr.find = function (db, where, options) {
    where = where || {};
    options = options || {};
    for (var p in where) {
      var propertyDef = definition.properties[p];
      if (propertyDef) {
        where[p] = castProperty(p, where[p], propertyDef);
      } else {
        delete where[p];
      }
    }
    debug('finding ' + JSON.stringify(where) + ' in ' + definition.collection);
    return db.collection(definition.collection)
      .then(function (collection) {
        var deferred = q.defer();
        var query = collection.find(where);
        if (typeof options.limit !== 'undefined') {
          query.limit(options.limit);
        }
        if (typeof options.skip !== 'undefined') {
          query.skip(options.skip);
        }
        if (typeof options.sort !== 'undefined') {
          query.sort(options.sort);
        }
        query.toArray(function (err, docs) {
          if (err) { return deferred.reject(err); }
          var found = [];
          for (var i = 0, l = docs.length; i < l; i++) {
            found.push(new constr(db, docs[i]));
          }
          return deferred.resolve(found);
        });
        return deferred.promise;
      });
  };

  constr.findOne = function (db, where, options) {
    where = where || {};
    options = options || {};
    for (var p in where) {
      var propertyDef = definition.properties[p];
      if (propertyDef) {
        where[p] = castProperty(p, where[p], propertyDef);
      } else {
        delete where[p];
      }
    }
    debug('finding one ' + JSON.stringify(where) + ' in ' + definition.collection);
    return db.collection(definition.collection)
      .then(function (collection) {
        var deferred = q.defer();
        var query = collection.findOne(where, function (err, doc) {
          if (err) { return deferred.reject(err); }
          deferred.resolve(doc ? new constr(db, doc) : null);
        });
        return deferred.promise;
      });
  };

  constr.remove = function (db, where, options) {
    where = where || {};
    options = options || {};
    for (var p in where) {
      var propertyDef = definition.properties[p];
      if (propertyDef) {
        where[p] = castProperty(p, where[p], propertyDef);
      } else {
        delete where[p];
      }
    }
    debug('removing ' + JSON.stringify(where) + ' in ' + definition.collection);
    return db.collection(definition.collection)
      .then(function (collection) {
        var deferred = q.defer();
        var query = collection.deleteMany(where, function (err) {
          if (err) { return deferred.reject(err); }
          deferred.resolve();
        });
        return deferred.promise;
      });
  };

  return constr;
};

module.exports = Model;

function castProperty (name, value, propertyDef) {
  switch (propertyDef.type.trim().toLowerCase()) {
    case 'array':
      if (!Array.isArray(value)) {
        value = [value];
      }
      break;
    case 'boolean':
      value = !!value;
      break;
    case 'date':
      if (!util.isDate(value)) {
        value = new Date(value);
      }
      break;
    case 'number':
      if ('number' !== typeof value) {
        value = value - 0;
      }
      break;
    case 'string':
      if ('string' !== typeof value) {
        value = value +'';
      }
      break;
    case 'objectid':
      if (!(value instanceof bson.ObjectId)) {
        value = new bson.ObjectId(value);
      }
      break;
  }
  return value;
}

function buildPropertySchema (name, propertyDef) {
  var schema = null;
  switch (propertyDef.type.trim().toLowerCase()) {
    case 'array':
      schema = joi.array();
      if (propertyDef.items) {
        schema.includes(buildPropertySchema(name + '.items', propertyDef.items));
      }
      if (propertyDef.sparse) { schema.sparse(propertyDef.sparse); }
      if (propertyDef.unique) { schema.unique(); }
      break;
    case 'binary':
      schema = joi.binary();
      if (propertyDef.encoding) { schema.encoding(propertyDef.encoding); }
      break;
    case 'boolean':
      schema = joi.boolean();
      break;
    case 'date':
      schema = joi.date();
      if (propertyDef.iso) { schema.iso(); }
      if (propertyDef.format) { schema.format(propertyDef.format); }
      break;
    case 'number':
      schema = joi.number();
      if (propertyDef.greater) { schema.greater(propertyDef.greater); }
      if (propertyDef.less) { schema.less(propertyDef.less); }
      if (propertyDef.integer) { schema.integer(propertyDef.integer); }
      if (propertyDef.precision) { schema.precision(propertyDef.precision); }
      if (propertyDef.multiple) { schema.multiple(propertyDef.multiple); }
      if (propertyDef.negative) { schema.negative(); }
      if (propertyDef.positive) { schema.positive(); }
      break;
    case 'object':
      schema = joi.object();
      if (propertyDef.constr) {
        schema.type(propertyDef.constr);
      }
      if (propertyDef.properties) {
        var keys = {};
        for (var p in propertyDef.properties) {
          if (propertyDef.properties[p].type !== 'virtual') {
            keys[p] = buildPropertySchema(name + '.' + p, propertyDef.properties[p]);
          }
        }
        schema.keys(keys);
      }
      if (propertyDef.unknown) { schema.unknown(propertyDef.unknown); }
      if (propertyDef.rename) { schema.rename(propertyDef.rename); }
      if (propertyDef.requiredKeys) { schema.requiredKeys(propertyDef.requiredKeys); }
      break;
    case 'string':
      schema = joi.string();
      if (propertyDef.insensitive) { schema.insensitive(); }
      if (propertyDef.creditCard) { schema.creditCard(); }
      if (propertyDef.regex) { schema.regex(propertyDef.regex); }
      if (propertyDef.alphanum) { schema.alphanum(); }
      if (propertyDef.token) { schema.token(); }
      if (propertyDef.email) { schema.email(); }
      if (propertyDef.guid) { schema.guid(); }
      if (propertyDef.hostname) { schema.hostname(); }
      if (propertyDef.lowercase) { schema.lowercase(); }
      if (propertyDef.uppercase) { schema.uppercase(); }
      if (propertyDef.trim) { schema.trim(); }
      break;
    case 'objectid':
      schema = joi.object().type(bson.ObjectId);
      break;
    case 'any':
    case '*':
      schema = joi.any();
      break;
    default:
      throw new Error('Invalid type (' + propertyDef.type + ') for property ' + name);
  }
  if (propertyDef.default) { schema.default(propertyDef.default); }
  if (propertyDef.min) { schema.min(propertyDef.min); }
  if (propertyDef.max) { schema.max(propertyDef.max); }
  if (propertyDef.length) { schema.length(propertyDef.length); }
  if (propertyDef.allow) { schema.allow(propertyDef.allow); }
  if (propertyDef.valid) { schema.valid(propertyDef.valid); }
  if (propertyDef.invalid) { schema.invalid(propertyDef.invalid); }
  if (propertyDef.forbidden) { schema.forbidden(); }
  if (propertyDef.strip) { schema.strip(); }
  if (propertyDef.required) { schema.required(); }
  if (propertyDef.strict) { schema.strict(propertyDef.strict); }
  if (propertyDef.label) { schema.label(propertyDef.label); }
  if (propertyDef.raw) { schema.raw(); }
  return schema;

}
