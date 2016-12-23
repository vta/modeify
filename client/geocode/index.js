var config = require('config');
var log = require('./client/log')('geocode');
var get = require('./client/request').get;
var googleGeocode = require('./google_geocode');
/**
 * Geocode
 */

module.exports = geocode;
module.exports.geocode = geocode;
module.exports.reverseAmigo = reverseAmigo;
module.exports.suggestAmigo = suggestAmigo;
module.exports.lookupPlaceId = lookupPlaceId;



/**
 * Geocoding options (google or amigo)
 **/

var geocodingOptions = {
  // amigoSuggestions: function (text, res) {
  //   var bounding = res.body.boundingbox;
  //   var bounding_split = bounding.split(",");
  //   var boinding_first = bounding_split[0].split(" ");
  //   var boinding_second = bounding_split[1].split(" ");
  //   var parameter = {
  //       'token': config.realtime_access_token() ,
  //       'boundary.rect.min_lat': boinding_first[1],
  //       'boundary.rect.min_lon': boinding_first[0],
  //       'boundary.rect.max_lat': boinding_second[1],
  //       'boundary.rect.max_lon': boinding_second[0],
  //       'sources':'osm,oa',
  //       'text': text
  //   };

  //   return {
  //     get: function () {
  //       return $.get('https://www.amigocloud.com/api/v1/me/geocoder/search', parameter).then(function (data) {
  //         return {
  //           body: data
  //         };
  //       });
  //     }
  //   };
  // },

  // amigoReverse: function (ll) {
  //   var parameter = {
  //     'token':config.realtime_access_token() ,
  //     'point.lon':ll[0],
  //     'point.lat':ll[1]
  //   };

  //   return {
  //     parameter: parameter,
  //     endpoint: 'https://www.amigocloud.com/api/v1/me/geocoder/reverse'
  //   };
  // },
  googleGeocoder: googleGeocode.googleGeocoder,
  googleSuggestions: googleGeocode.googleSuggestions,
  googlePlacesLookup: googleGeocode.googlePlacesLookup,
  googleReverse: googleGeocode.googleReverse
};

/**
 * Reverse geocode
 */

function reverseAmigo(ll, callback) {
  log('--> reverse geocoding %s', ll);

  // var query = geocodingOptions.amigoReverse(ll);
  var query = geocodingOptions.googleReverse(ll);
  console.log('attempting to reverse geocode', ll)

  get(query.endpoint, query.parameter, function(err, res) {

    if (err) {
      log('<-- geocoding error %e', err);
      //return false;
    } else {
      if (query.responseMapper) {
        res = query.responseMapper(res);
      }

      log('<-- geocoding complete %j', res.body);
      //return res.body;
      callback(false, res.body);
    }
  });
}

/**
 * Suggestions!
 */
function suggestAmigo(text, callback) {
  console.log('getting suggestions for "' + text + '"')
  var res = {
      "body": {
        "boundingbox": "-122.858905792236 36.818080227785,-121.452655792236 38.220919766831"
      }
    }
  var query_text = text;
  //get('https://www.amigocloud.com/api/v1/users/1/projects/661/datasets/22492', {
  //  'token': config.realtime_access_token()
  //}, function(err, res) {
  var query = geocodingOptions.googleSuggestions(text, res);
  query.get().then(function() {
    var res = query.futureRes;
    if (res.body.result) {
      callback(null, res.body.result, query_text);
    }
  });
  //});
}

/**
 * Suggestions!
 */
function geocode(text, callback) {
  console.log('getting geocode for "' + text + '"')
  var res = {
      "body": {
        "boundingbox": "-122.858905792236 36.818080227785,-121.452655792236 38.220919766831"
      }
    }
  var query_text = text;
  //get('https://www.amigocloud.com/api/v1/users/1/projects/661/datasets/22492', {
  //  'token': config.realtime_access_token()
  //}, function(err, res) {
  var query = geocodingOptions.googleGeocoder(text, res);
  query.get().then(function() {
    var res = query.futureRes;
    if (res.body.result) {
      callback(null, res.body.result, query_text);
    }
  });
  //});
}

function lookupPlaceId(placeid, callback){
  console.log('getting Google Places information for place_id=' + placeid + '')
 
  var query = geocodingOptions.googlePlacesLookup(placeid);
  query.get().then(function() {
    var res = query.futureRes;
    if (res.body.result) {
      callback(null, res.body.result);
    }
  });
}

