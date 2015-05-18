
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