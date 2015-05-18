var chai = require('chai');

chai.use(require('chai-datetime'));
var expect = chai.expect;

describe('ArrayProxy', function () {
  
  var ArrayProxy = require('../lib/array-proxy');

  describe.skip('.copyWithin()', function () {
    it('should proxy call to array method', function () {
      var arr = [1, 2, 3, 4, 5];
      var proxy = new ArrayProxy(arr);
      proxy.copyWithin(0, 3, 4);
      expect(arr).to.equal([4, 2, 3, 4, 5]);
    });
  });

  describe.skip('.fill()', function () {
    it('should proxy call to array method', function () {
      var arr = [1, 2, 3];
      var proxy = new ArrayProxy(arr);
      proxy.fill(4, 1, 2);
      expect(arr).to.equal([1, 4, 3]);
    });
  });

  describe('.pop()', function () {
    it('should proxy call to array method', function () {
      var arr = ['angel', 'clown', 'mandarin', 'sturgeon'];
      var proxy = new ArrayProxy(arr);

      var expected = ['angel', 'clown', 'mandarin' ];
      expect(proxy.pop()).to.equal('sturgeon');
      for (var i = 0, l = arr.length; i < l; i++) {
        expect(arr[i]).to.equal(expected[i]);
      }
    });
  });

  describe('.push()', function () {
    it('should proxy call to array method', function () {
      var arr = ['soccer', 'baseball'];
      var proxy = new ArrayProxy(arr);

      expect(proxy.push('football', 'swimming')).to.equal(4);
      var expected = ['soccer', 'baseball', 'football', 'swimming'];
      for (var i = 0, l = arr.length; i < l; i++) {
        expect(arr[i]).to.equal(expected[i]);
      }
    });
  });

  describe('.reverse()', function () {
    it('should proxy call to array method', function () {
      var arr = ['one', 'two', 'three'];
      var proxy = new ArrayProxy(arr);
      proxy.reverse();

      var expected = ['three', 'two', 'one'];
      for (var i = 0, l = arr.length; i < l; i++) {
        expect(arr[i]).to.equal(expected[i]);
      }
    });
  });

  describe('.shift()', function () {
    it('should proxy call to array method', function () {
      var arr = ['angel', 'clown', 'mandarin', 'surgeon'];
      var proxy = new ArrayProxy(arr);
      
      expect(proxy.shift()).to.equal('angel');
      var expected = ['clown', 'mandarin', 'surgeon'];
      for (var i = 0, l = arr.length; i < l; i++) {
        expect(arr[i]).to.equal(expected[i]);
      }
    });
  });

  describe('.sort()', function () {
    it('should proxy call to array method', function () {
      var arr = ['apples', 'bananas', 'Cherries'];
      var proxy = new ArrayProxy(arr);
      
      proxy.sort();
      var expected = ['Cherries', 'apples', 'bananas'];
      for (var i = 0, l = arr.length; i < l; i++) {
        expect(arr[i]).to.equal(expected[i]);
      }
    });
  });

  describe('.splice()', function () {
    it('should proxy call to array method', function () {
      var arr = ['angel', 'clown', 'mandarin', 'surgeon'];
      var proxy = new ArrayProxy(arr);
      
      expect(proxy.splice(2, 0, 'drum')).to.have.length(0);
      var expected = ['angel', 'clown', 'drum', 'mandarin', 'surgeon'];
      for (var i = 0, l = arr.length; i < l; i++) {
        expect(arr[i]).to.equal(expected[i]);
      }
    });
  });

  describe('.unshift()', function () {
    it('should proxy call to array method', function () {
      var arr = [1, 2];
      var proxy = new ArrayProxy(arr);
      
      expect(proxy.unshift(0)).to.equal(3);
      var expected = [0, 1, 2];
      for (var i = 0, l = arr.length; i < l; i++) {
        expect(arr[i]).to.equal(expected[i]);
      }
    });
  });

});