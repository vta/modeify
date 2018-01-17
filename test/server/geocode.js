/**
 * Dependencies
 */

var async = require('async');
var geocode = require('../../lib/geocode');
var request = require('./supertest');
var should = require ('should');

/**
 * Valid addresses
 */

var valid = [{
  address: '3331 N 1st St',
  city: 'San Jose',
  state: 'CA',
  zip: 95134,
  ll: {
    lng: -121.93961371980717,
    lat: 37.40183512021567
  }
}, {
  address: '755 E El Camino Real',
  city: 'Sunnyvale',
  state: 'CA',
  zip: 94086,
  ll: {
    lng: -122.02010381499235,
    lat: 37.35784917127341
  },
}];

/**
 * Invalid addresses
 */

/**
 * BDD
 */

describe('gecoder', function() {
  describe('#encode()', function() {
    it('should correctly convert the valid addresses into ll points',
      function(done) {
        async.each(valid, function(row, next) {
          geocode.encode(row, function(err, addresses) {
            if (err) return next(err);
            var ll = addresses[0].coordinate;
            row.ll.should.eql({
              lng: ll.lng,
              lat: ll.lat
            });
            next();
          });
        }, done);
      });
  });

  describe('#reverse()', function() {
    it('should correctly convert the valid ll points into addresses',
      function(done) {
        async.each(valid, function(row, next) {
          geocode.reverse(row.ll, function(err, address) {
            if (err) return next(err);
            address.address.should.eql(row.address);
            next();
          });
        }, done);
      });
  });
});
