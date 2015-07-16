var chai = require('chai');

chai.use(require('chai-datetime'));
var expect = chai.expect;

describe('ObjectProxy', function () {

  var ObjectProxy = require('../lib/object-proxy');
  var ArrayProxy = require('../lib/array-proxy');
  var DateProxy = require('../lib/date-proxy');

  var MyObjectProxy = ObjectProxy.create({
    name: 'MyObjectProxy',
    properties: {
      str: { type: 'string' },
      num: { type: 'number' },
      bool: { type: 'boolean' },
      any: { type: 'any' },
      any2: { type: '*' },
      any3: {},
      virt: {
        type: 'virtual',
        get: function () {
          return this.any + '.' + this.any2;
        },
        set: function (value) {
          var parts = value.split('.');
          this.any = parts[0];
          this.any2 = parts[1];
        }
      },
      obj: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'string' }
        }
      },
      obj2: {
        type: 'object',
        properties: {
          bar: { type: 'string' }
        }
      },
      arr: { type: 'array' },
      date: { type: 'date' }
    }
  });

  describe('.define()', function () {

    it('should return a constructor function', function () {
      expect(typeof MyObjectProxy).to.equal('function');
    });

    it('should return prototype with properties defined', function () {
      expect(MyObjectProxy.prototype).to.contain.keys('str', 'num', 'bool', 'any',
        'any2', 'any3', 'virt', 'obj', 'obj2', 'arr', 'date');
    });

    describe('#constructor', function () {

      it('should create new object with defined properties', function () {
        var obj = new MyObjectProxy({
          str: 'test string'
        });
        expect(obj).to.be.instanceOf(MyObjectProxy);
        var props = [];
        for (var p in obj) {
          if (typeof obj[p] !== 'function') {
            props.push(p);
          }
        }
        expect(props).to.contain('str', 'num', 'bool', 'any', 'any2', 'any3',
          'virt', 'obj', 'obj2', 'arr', 'date');
      });

      it('should populate values given to constructor', function () {
        var obj = new MyObjectProxy({
          str: 'this is a string'
        });
        expect(obj.str).to.equal('this is a string');
      });

      it('should wrap given nested objects in appropriate proxies', function () {
        var obj = new MyObjectProxy({
          obj: { foo: 'foo' },
          arr: [ 'a', 'b', 'c' ],
          date: new Date()
        });
        expect(obj.obj).to.be.instanceOf(ObjectProxy);
        expect(obj.arr).to.be.instanceOf(ArrayProxy);
        expect(obj.date).to.be.instanceOf(DateProxy);
      });

    });

  });

  describe('.set()', function () {

    it('should throw exception if given invalid args', function () {
      var obj = new MyObjectProxy();
      expect(obj.set).to.throw(Error);
    });

    it('should wrap given nested objects in appropriate proxies', function () {
      var obj = new MyObjectProxy();
      obj.set({
        obj: { foo: 'foo' },
        arr: [ 'a', 'b', 'c' ],
        date: new Date()
      });
      expect(obj.obj).to.be.instanceOf(ObjectProxy);
      expect(obj.arr).to.be.instanceOf(ArrayProxy);
      expect(obj.date).to.be.instanceOf(DateProxy);
    });

    it('should except a single object of values', function () {
      var obj = new MyObjectProxy();
      obj.set({
        str: 'str',
        any: 'blah',
        bool: false,
        num: 10
      });

      expect(obj.str).to.equal('str');
      expect(obj.any).to.equal('blah');
      expect(obj.bool).to.be.false;
      expect(obj.num).to.equal(10);
    });

    it('should except a string path and value', function () {
      var obj = new MyObjectProxy();
      obj.set('str', 'str');
      obj.set('obj.foo', 'foo');
      obj.set('obj2', {});

      expect(obj.str).to.equal('str');
      expect(obj.obj.foo).to.equal('foo');
      expect(typeof obj.obj2).to.equal('object');
    });

    it('should except an array path and value', function () {
      var obj = new MyObjectProxy();
      obj.set(['str'], 'str');
      obj.set(['obj', 'foo'], 'foo');
      obj.set(['obj2'], {});

      expect(obj.str).to.equal('str');
      expect(obj.obj.foo).to.equal('foo');
      expect(typeof obj.obj2).to.equal('object');
    });

    it('should trigger change event', function (done) {
      var obj = new MyObjectProxy();
      obj.on('change', function (event) {
        expect(event.currentPath).to.equal('str');
        expect(event.path).to.equal('str');
        expect(event.newValue).to.equal('str');
        expect(event.oldValue).to.not.exist;
        done();
      });
      obj.set('str', 'str');
    });

    it('should trigger change event on an array', function (done) {
      var obj = new MyObjectProxy({
        arr: []
      });
      obj.on('change', function (event) {
        expect(event.currentPath).to.equal('arr');
        expect(event.path).to.equal('arr');
        done();
      });
      obj.arr.push('a');
    });

    it('should trigger change event on a date', function (done) {
      var obj = new MyObjectProxy({
        date: new Date()
      });
      obj.on('change', function (event) {
        expect(event.currentPath).to.equal('date');
        expect(event.path).to.equal('date.month');
        done();
      });
      obj.date.month += 1;
    });

    it('should trigger change event on nested change', function (done) {
      var obj = new MyObjectProxy();
      obj.on('change', function (event) {
        expect(event.currentPath).to.equal('obj');
        expect(event.path).to.equal('obj.foo');
        expect(event.newValue).to.equal('foo');
        expect(event.oldValue).to.not.exist;
        done();
      });
      obj.set('obj.foo', 'foo');
    });

    it('should not trigger change event if silent option given', function (done) {
      var obj = new MyObjectProxy();
      obj.on('change', function (event) {
        expect(false).to.be.true;
        done();
      });
      obj.set('str', 'str', { silent: true });
      setTimeout(function () {
        done();
      }, 10);
    });

    it('should call virtual setter', function () {
      var obj = new MyObjectProxy();
      obj.virt = 'boo.blah';
      expect(obj.any).to.equal('boo');
      expect(obj.any2).to.equal('blah');
    });

  });

  describe('.get()', function () {

    it('should return undefined for undefine properties', function () {
      var obj = new MyObjectProxy({
        str: 'test string',
        obj: { foo: 'foo' }
      });
      expect(obj.get('blahblahblah')).to.not.exist;
    });

    it('should except a string path', function () {
      var obj = new MyObjectProxy({
        str: 'test string',
        obj: { foo: 'foo' }
      });
      expect(obj.get('str')).to.equal('test string');
      expect(obj.get('obj.foo')).to.equal('foo');
    });

    it('should except an array path', function () {
      var obj = new MyObjectProxy({
        str: 'test string',
        obj: { foo: 'foo' }
      });
      expect(obj.get(['str'])).to.equal('test string');
      expect(obj.get(['obj', 'foo'])).to.equal('foo');
    });

    it('should call virtual setter', function () {
      var obj = new MyObjectProxy();
      obj.virt = 'boo.blah';
      expect(obj.virt).to.equal('boo.blah');
    });

  });

  describe('.has()', function () {

    it('should except a string path', function () {
      var obj = new MyObjectProxy({
        str: 'test string',
        obj: { foo: 'foo' }
      });
      expect(obj.has('str')).to.be.true;
      expect(obj.has('obj.foo')).to.be.true;
    });

    it('should except an array path', function () {
      var obj = new MyObjectProxy({
        str: 'test string',
        obj: { foo: 'foo' }
      });
      expect(obj.has(['str'])).to.be.true;
      expect(obj.has(['obj', 'foo'])).to.be.true;
    });
  });

  describe('.toJSON()', function () {

    it('should return the correct JSON object', function () {
      var now = new Date();
      var obj = new MyObjectProxy({
        str: 'str',
        arr: ['a', 'b', 'c'],
        obj: { foo: 'foo' },
        date: now,
        any: 'boo',
        any2: 'blah'
      });
      obj.date.setFullYear(1976);
      var expected = {
        str: 'str',
        arr: ['a', 'b', 'c'],
        obj: { foo: 'foo' },
        date: now.toISOString(),
        any: 'boo',
        any2: 'blah',
        virt: 'boo.blah'
      };
      var json = obj.toJSON();
      expect(json).eql(expected);
    });

  });

});
