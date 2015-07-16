var q = require('q');
var _ = require('lodash');
var util = require('util');
var joi = require('joi');
var etag = require('etag');
var debug = require('debug')('outpost-models:model');
var bson = require('bson');

var ObjectProxy = require('./object-proxy');
var ArrayProxy = require('./array-proxy');

var Model = {};

Model.extend = function (definition, superModel) {

  var schema = {};
  _.defaults(definition, {
    abstract: false,
    final: false
  });

  if (!definition.name) {
    throw new Error('A model name is required');
  }

  if (!definition.abstract && !definition.collection) {
    throw new Error('A model must have a collection unless marked as abstract');
  }

  var constr = function (db, data) {
    if (definition.abstract) {
      throw new Error('An abstract model cannot be instantiated');
    }
    this._db = db;
    ObjectProxy.call(this, data);
    Object.defineProperty(this, '__modified', {
      enumerable: false,
      writable: true,
      value: {}
    });
    this.on('change', function (event) {
      this.markAsModified(event.path, event.newValue, event.oldValue);
    }.bind(this));
  };

  definition.properties._id = { type: 'objectId' };
  definition.properties._etag = { type: 'string' };

  if (superModel) {
    util.inherits(constr, superModel);
    _.defaults(constr, superModel);
    constr = ObjectProxy.extend(constr, definition);
  } else {
    constr = ObjectProxy.create(definition, constr);
  }
  definition = constr.prototype.__definition;

  for (var p in definition.properties) {
    var propertyDef = definition.properties[p];
    if (propertyDef.type !== 'virtual') {
      schema[p] = buildPropertySchema(p, propertyDef);
    }
  }

  constr.prototype.init = function (obj, options) {
    ObjectProxy.prototype.init.apply(this, arguments);
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
    joi.validate(this.toObject({ virtuals: false }), schema, options, function (err, value) {
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
              var where = { _id: { $in: [this._id] }, _etag: this._etag };
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
                    this.set(Array.isArray(result.ops) ? result.ops[0] : result.ops);
                    this.__modified = {};
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
    var where = { _id: { $in: [this._id] }, _etag: this._etag };
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
          return afterFunc.apply(this, arguments);
        });
      } else {
        return afterFunc.apply(this, arguments);
      }
    };
  };

  constr.prototype.before = function (method, beforeFunc) {
    var oFunc = this[method];
    this[method] = function composedFunc () {
      var val = beforeFunc.apply(this, arguments);
      if (val instanceof q.Promise) {
        return val.then(function () {
          return oFunc.apply(this, arguments);
        });
      } else {
        return oFunc.apply(this, arguments);
      }
    };
  };

  constr.create = function (db, data, options) {
    var doc = new constr(db, data);
    return doc.save(options);
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
          var found = new ArrayProxy([]);
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
      if ('undefined' !== typeof propertyDef.items) {
        schema = schema.items(buildPropertySchema(name + '.items', propertyDef.items));
      }
      if ('undefined' !== typeof propertyDef.sparse) { schema = schema.sparse(propertyDef.sparse); }
      if (propertyDef.unique) { schema = schema.unique(); }
      break;
    case 'binary':
      schema = joi.binary();
      if ('undefined' !== typeof propertyDef.encoding) { schema = schema.encoding(propertyDef.encoding); }
      break;
    case 'boolean':
      schema = joi.boolean();
      break;
    case 'date':
      schema = joi.date();
      if (propertyDef.iso) { schema = schema.iso(); }
      if ('undefined' !== typeof propertyDef.format) { schema = schema.format(propertyDef.format); }
      break;
    case 'number':
      schema = joi.number();
      if ('undefined' !== typeof propertyDef.greater) { schema = schema.greater(propertyDef.greater); }
      if ('undefined' !== typeof propertyDef.less) { schema = schema.less(propertyDef.less); }
      if ('undefined' !== typeof propertyDef.integer) { schema = schema.integer(propertyDef.integer); }
      if ('undefined' !== typeof propertyDef.precision) { schema = schema.precision(propertyDef.precision); }
      if ('undefined' !== typeof propertyDef.multiple) { schema = schema.multiple(propertyDef.multiple); }
      if (propertyDef.negative) { schema = schema.negative(); }
      if (propertyDef.positive) { schema = schema.positive(); }
      break;
    case 'object':
      schema = joi.object();
      if ('undefined' !== typeof propertyDef.constr) {
        schema = schema.type(propertyDef.constr);
      }
      if ('undefined' !== typeof propertyDef.properties) {
        var keys = {};
        for (var p in propertyDef.properties) {
          if (propertyDef.properties[p].type !== 'virtual') {
            keys[p] = buildPropertySchema(name + '.' + p, propertyDef.properties[p]);
          }
        }
        schema = schema.keys(keys);
      }
      if ('undefined' !== typeof propertyDef.unknown) { schema = schema.unknown(propertyDef.unknown); }
      if ('undefined' !== typeof propertyDef.rename) { schema = schema.rename(propertyDef.rename); }
      if ('undefined' !== typeof propertyDef.requiredKeys) { schema = schema.requiredKeys(propertyDef.requiredKeys); }
      break;
    case 'string':
      schema = joi.string();
      if (propertyDef.insensitive) { schema = schema.insensitive(); }
      if (propertyDef.creditCard) { schema = schema.creditCard(); }
      if ('undefined' !== typeof propertyDef.regex) { schema = schema.regex(propertyDef.regex); }
      if (propertyDef.alphanum) { schema = schema.alphanum(); }
      if (propertyDef.token) { schema = schema.token(); }
      if (propertyDef.email) { schema = schema.email(); }
      if (propertyDef.guid) { schema = schema.guid(); }
      if (propertyDef.hostname) { schema = schema.hostname(); }
      if (propertyDef.lowercase) { schema = schema.lowercase(); }
      if (propertyDef.uppercase) { schema = schema.uppercase(); }
      if (propertyDef.trim) { schema = schema.trim(); }
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
  if ('undefined' !== typeof propertyDef.min) { schema = schema.min(propertyDef.min); }
  if ('undefined' !== typeof propertyDef.max) { schema = schema.max(propertyDef.max); }
  if ('undefined' !== typeof propertyDef.length) { schema = schema.length(propertyDef.length); }
  if ('undefined' !== typeof propertyDef.allow) { schema = schema.allow(propertyDef.allow); }
  if ('undefined' !== typeof propertyDef.valid) { schema = schema.valid(propertyDef.valid); }
  if ('undefined' !== typeof propertyDef.invalid) { schema = schema.invalid(propertyDef.invalid); }
  if (propertyDef.forbidden) { schema = schema.forbidden(); }
  if (propertyDef.strip) { schema = schema.strip(); }
  if (propertyDef.required) { schema = schema.required(); }
  if ('undefined' !== typeof propertyDef.strict) { schema = schema.strict(propertyDef.strict); }
  if ('undefined' !== typeof propertyDef.label) { schema = schema.label(propertyDef.label); }
  if (propertyDef.raw) { schema = schema.raw(); }
  if ('undefined' !== typeof propertyDef.default) { schema = schema.default(propertyDef.default, 'default'); }
  return schema;

}
