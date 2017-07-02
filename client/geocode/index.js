var config = require('config');
var log = require('./client/log')('geocode');
var get = require('./client/request').get;
var googleGeocode = require('./google_geocode');
/**
 * Geocode
 */

module.exports = geocode;
module.exports.geocode = geocode;
module.exports.reverseGoogle = reverseGoogle;
module.exports.suggestGoogle = suggestGoogle;
module.exports.lookupPlaceId = lookupPlaceId;

/**
 * Geocoding options (google or Google)
 **/

var geocodingOptions = {
  googleGeocoder: googleGeocode.googleGeocoder,
  googleSuggestions: googleGeocode.googleSuggestions,
  googlePlacesLookup: googleGeocode.googlePlacesLookup,
  googleReverse: googleGeocode.googleReverse
};

/**
 * Reverse geocode
 */

function reverseGoogle(ll, callback) {
  log('--> reverse geocoding %s', ll);

  // var query = geocodingOptions.GoogleReverse(ll);
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
function suggestGoogle(text, callback) {
    const regex = /(.*?,)(.*?,)(.*?,)(.*?,)\s(USA)/g;
    // const str = `Gilroy Transit Center, 7250 Monterey Street, Gilroy, CA 95020, USA`;
    const subst = '$2$3$4$5';

    var str = text;
    var suggest_text = str;
    console.log('This text: '+suggest_text);

    if (regex.test(str)) {
        suggest_text = str.replace(regex, subst);
    }
    console.log('GoogleSuggestions text: '+suggest_text);
  var res = {
      "body": {
        "boundingbox": "-122.858905792236 36.818080227785,-121.452655792236 38.220919766831"
      }
    }
  var query_text = suggest_text;
  var query = geocodingOptions.googleSuggestions(suggest_text, res);
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

