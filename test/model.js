var chai = require('chai');
var util = require('util');

chai.use(require('chai-datetime'));
var expect = chai.expect;

describe('Model', function () {

  var db = require('outpost-db').connect(process.DB_URI);
  var Model = require('../lib/model');
  var FullTestModel = require('./support/full-test-model');

  describe('.extend()', function () {

    it('should return prototype with static methods defined', function () {
      expect(FullTestModel).to.include.keys('extend', 'find', 'findOne', 'remove');
    });

    it('should allow subclassing of a model', function () {
      var ModelA = Model.extend({
        name: 'ModelA',
        abstract: true,
        properties: {
          'strA': { type: 'string' }
        }
      });
      var ModelB = ModelA.extend({
        name: 'ModelB',
        collection: 'modelb',
        properties: {
          'strB': { type: 'string' }
        }
      });
      expect(ModelB.modelName).to.equal('ModelB');
      var myModel = new ModelB(db, {
        strA: 'abc',
        strB: '123'
      });
      expect(myModel.strA).to.equal('abc');
      expect(myModel.strB).to.equal('123');
    });

    describe('#constructor', function () {

      var newModel;

      before(function () {
        newModel = new FullTestModel(db, {
          str: 'this is a string'
        });
      });

      it('should have run initialized', function () {
        expect(newModel.bool).to.be.true;
      });

    });

  });

  describe('.markAsModified(), .isModified()', function () {

    var model;

    before(function () {
      model = new FullTestModel(db, {
        str: 'test string',
        obj: { prop1: 'foo', prop2: 'bar' }
      });
    });

    it('should except a string path', function () {
      model.markAsModified('str');
      model.markAsModified('obj.deep.blah');

      expect(model.isModified('str')).to.be.true;
      expect(model.isModified('obj')).to.true;
      expect(model.isModified('obj.deep')).to.true;
      expect(model.isModified('obj.deep.blah')).to.true;
    });

    it('should except an array path', function () {
      model.markAsModified(['str']);
      model.markAsModified(['obj', 'deep', 'blah']);

      expect(model.isModified(['str'])).to.be.true;
      expect(model.isModified(['obj'])).to.true;
      expect(model.isModified(['obj', 'deep'])).to.true;
      expect(model.isModified(['obj', 'deep', 'blah'])).to.true;
    });

  });

  describe('.before()', function () {

    it('should allow code exectution before a method', function () {
      var model = new FullTestModel(db, { str: '' });
      expect(model.str).to.equal('');
      model.fooString();
      expect(model.str).to.equal('(foo)');

      model.str = '';
      model.before('fooString', function () {
        this.str = 'bar';
      });
      expect(model.str).to.equal('');
      model.fooString();
      expect(model.str).to.equal('bar(foo)');
    });

  });

  describe('.after()', function () {

    it('should allow code exectution after a method', function () {
      var model = new FullTestModel(db, { str: '' });
      expect(model.str).to.equal('');
      model.fooString();
      expect(model.str).to.equal('(foo)');

      model.str = '';
      model.after('fooString', function () {
        this.str += 'bar';
      });
      expect(model.str).to.equal('');
      model.fooString();
      expect(model.str).to.equal('(foo)bar');
    });

  });

  describe('.validate()', function () {

    it('should reject promise if validation fails', function (done) {
      var model = new FullTestModel(db, { str: '' });
      model.validate()
        .then(
          function () {
            expect(false).to.be.true;
          },
          function (err) {
            expect(err).to.exist;
            done();
          })
        .done(null, done);
    });

    it('should resolve promise if validation succeeds', function (done) {
      var model = new FullTestModel(db, { str: 'bar' });
      model.validate()
        .then(function () {
          expect(true).to.be.true;
          done();
        })
        .catch(function (err) {
          expect(err).to.not.exist;
        })
        .done(null, done);
    });

  });

  describe('.save()', function () {

    var _collection;
    var model;

    before(function (done) {
      model = new FullTestModel(db, {
        str: 'test string',
        obj: { foo: 'bar' }
      });
      db.collection('mocha_test')
        .done(
          function (collection) {
            _collection = collection;
            done();
          },
          function (err) {
            return done(err);
          }
        );
    });

    after(function (done) {
      _collection.removeMany({}, done);
    });

    it('should insert a new document', function (done) {
      model.save()
        .then(function () {
          expect(model._id).to.exist;
          expect(model._etag).to.exist;
          expect(model.isModified()).to.be.false;
          _collection.count({}, function (err, count) {
            if (err) { return done(err); }
            expect(count).to.equal(1);
            _collection.find({ _id: model._id }).toArray(function (err, docs) {
              if (err) { return done(err); }
              var expected = {
                _etag: docs[0]._etag,
                _id: docs[0]._id.toString(),
                bool: docs[0].bool,
                date: docs[0].date.toJSON(),
                num: docs[0].num,
                obj: { propv: 'undefined.undefined' },
                str: docs[0].str,
                virt: 'test string.virtual'
              };
              expect(model.toJSON()).to.eql(expected);
              done();
            });
          });
        })
        .done(null, done);
    });

    it('should update an existing document', function (done) {
      model.str = 'test update';
      var _id = model._id.toString();
      var _etag = model._etag;
      expect(model.isModified()).to.be.true;
      model.save()
        .then(function () {
          expect(model._id.toString()).to.equal(_id);
          expect(model._etag).to.not.equal(_etag);
          expect(model.isModified()).to.be.false;
          _collection.count({}, function (err, count) {
            if (err) { return done(err); }
            expect(count).to.equal(1);
            _collection.find({ _id: model._id }).toArray(function (err, docs) {
              if (err) { return done(err); }
              var expected = {
                _etag: docs[0]._etag,
                _id: docs[0]._id.toString(),
                bool: docs[0].bool,
                date: docs[0].date.toJSON(),
                num: docs[0].num,
                obj: { propv: 'undefined.undefined' },
                str: docs[0].str,
                virt: 'test update.virtual'
              };
              expect(model.toJSON()).to.eql(expected);
              done();
            });
          });
        })
        .done(null, done);
    });

  });

  describe('.remove()', function () {
    var _collection;
    var model;

    before(function (done) {
      model = new FullTestModel(db, {
        str: 'test string',
        obj: { foo: 'bar' }
      });
      db.collection('mocha_test')
        .done(
          function (collection) {
            _collection = collection;
            done();
          },
          function (err) {
            return done(err);
          }
        );
    });

    after(function (done) {
      _collection.removeMany({}, done);
    });

    it('should remove the document', function (done) {
      model.save()
        .then(function () {
          expect(model._id).to.exist;
          return model.remove();
        })
        .then(function () {
          expect(model._id).to.not.exist;
          expect(model._etag).to.not.exist;
          expect(model.isModified()).to.be.false;
          _collection.count({}, function (err, count) {
            if (err) { return done(err); }
            expect(count).to.equal(0);
            done();
          });
        })
        .done(null, done);
    });

  });

  describe('.find()', function () {
    var _collection;
    var model;

    before(function (done) {
      model = new FullTestModel(db, {
        str: 'test string',
        obj: { foo: 'bar' }
      });
      db.collection('mocha_test')
        .done(
          function (collection) {
            _collection = collection;
            done();
          },
          function (err) {
            return done(err);
          }
        );
    });

    after(function (done) {
      _collection.removeMany({}, done);
    });

    it('should return an array of objects', function (done) {
      model.save()
        .then(function () {
          expect(model._id).to.exist;
          return FullTestModel.find(db, { _id: model._id });
        })
        .then(function (arr) {
          arr = arr.toObject();
          expect(arr.length).to.equal(1);
          expect(arr[0]._id.toString()).to.equal(model._id.toString());
          done();
        })
        .done(null, done);
    });
  });

  describe('.findOne()', function () {
    var _collection;
    var model;

    before(function (done) {
      model = new FullTestModel(db, {
        str: 'test string',
        obj: { foo: 'bar' }
      });
      db.collection('mocha_test')
        .done(
          function (collection) {
            _collection = collection;
            done();
          },
          function (err) {
            return done(err);
          }
        );
    });

    after(function (done) {
      _collection.removeMany({}, done);
    });

    it('should return an object', function (done) {
      model.save()
        .then(function () {
          expect(model._id).to.exist;
          return FullTestModel.findOne(db, { _id: model._id });
        })
        .then(function (doc) {
          expect(doc).to.exist;
          expect(doc._id.toString()).to.equal(model._id.toString());
          done();
        })
        .done(null, done);
    });
  });

  describe('.remove() [static]', function () {
    var _collection;
    var model;

    before(function (done) {
      model = new FullTestModel(db, {
        str: 'test string',
        obj: { foo: 'bar' }
      });
      db.collection('mocha_test')
        .done(
          function (collection) {
            _collection = collection;
            done();
          },
          function (err) {
            return done(err);
          }
        );
    });

    after(function (done) {
      _collection.removeMany({}, done);
    });

    it('should remove a document', function (done) {
      model.save()
        .then(function () {
          expect(model._id).to.exist;
          return FullTestModel.remove(db, { _id: model._id });
        })
        .then(function () {
          return FullTestModel.findOne(db, { _id: model._id });
        })
        .then(function (doc) {
          expect(doc).to.not.exist;
          done();
        })
        .done(null, done);
    });
  });

});
