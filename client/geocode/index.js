var config = require('config');
var log = require('./client/log')('geocode');
var get = require('./client/request').get;

/**
 * Geocode
 */

module.exports = geocode;
module.exports.reverseAmigo = reverseAmigo;
module.exports.suggestAmigo = suggestAmigo;

/**
 * Geocode (not currently in use!)
 */

function geocode(address, callback) {
  log('--> geocoding %s', address);
  get('/geocode/' + address, function(err, res) {
    if (err) {
      log('<-- geocoding error %s', err);
      callback(err, res);
    } else {
      log('<-- geocoding complete %j', res.body);
      callback(null, res.body);
    }
  });
}

/**
 * Geocoding options (google or amigo)
 **/

var defineProp = function (path, oldVal, newVal) {
  Object.defineProperty(path, newVal, Object.getOwnPropertyDescriptor(path, oldVal));
  delete path[oldVal];
};

var geocodingOptions = {
  amigoSuggestions: function (text, res) {
    var bounding = res.body.boundingbox;
    var bounding_split = bounding.split(",");
    var boinding_first = bounding_split[0].split(" ");
    var boinding_second = bounding_split[1].split(" ");
    var parameter = {
        'token': config.realtime_access_token() ,
        'boundary.rect.min_lat': boinding_first[1],
        'boundary.rect.min_lon': boinding_first[0],
        'boundary.rect.max_lat': boinding_second[1],
        'boundary.rect.max_lon': boinding_second[0],
        'sources':'osm,oa',
        'text': text
    };

    return {
      parameter: parameter,
      endpoint: 'https://www.amigocloud.com/api/v1/me/geocoder/search'
    }
  },

  amigoReverse: function (ll) {
    var parameter = {
      'token':config.realtime_access_token() ,
      'point.lon':ll[0],
      'point.lat':ll[1]
    };

    return {
      parameter: parameter,
      endpoint: 'https://www.amigocloud.com/api/v1/me/geocoder/reverse'
    };
  },

  googleSuggestions: function (text, res) {
    var mapper = function (res) {
      var execute = function (func) { func(); };
      var toMap = [
        function getData () {
          defineProp(res.body, 'results', 'features');
        },

        function mapLocations () {
          res.body.features.forEach(function (feature, idx) {
            defineProp(feature, 'address_components', 'properties');
            feature.properties = {
              country_a: "USA", // google results are always filtered to USA
              region_a: "CA",
              label: res.body.features[idx].formatted_address
            };

            defineProp(feature.geometry, 'location', 'coordinates');
            var lat = feature.geometry.coordinates.lat,
                lng = feature.geometry.coordinates.lng;
            feature.geometry.coordinates = [lng, lat];
          });
        },
      ];

      toMap.forEach(execute);
      return res;
    };

    var parameter = {
      'address': text,
      'key': 'AIzaSyBmJ2NvVf5Om1u1-YuA8lFKzEwZ2BHhd9U',
      'components': 'administrative_area:CA|country:US'
    };

    if (res && res.body && res.body.boundingbox) {
      var boundsArr = res.body.boundingbox.split(','),
          westArr = boundsArr[0].split(' '),
          eastArr = boundsArr[1].split(' '),
          bounds = westArr[0] + '|' + westArr[1] + '|' + eastArr[0] + '|' + eastArr[1];

      parameter.bounds = bounds;
    }

    return {
      endpoint: 'https://maps.googleapis.com/maps/api/geocode/json',
      parameter: parameter,
      responseMapper: mapper
    }
  },

  googleReverse: function (ll) {
    var mapper = function (res) {
      var execute = function (func) { func(); };
      var toMap = [
        function getData () {
          defineProp(res.body, 'results', 'features');
        },

        function setLabel () {
          var feature = res.body.features[0],
              props = feature.properties = {};
          props.label = feature.formatted_address;
        },

        function mapCoords () {
          var geo = res.body.features[0].geometry,
              lat = geo.location.lat,
              lng = geo.location.lng;
          defineProp(res.body.features[0].geometry, 'location', 'coordinates');
          geo.coordinates = [lng, lat];
        },

        function setId () {
          var feature = res.body.features[0],
              id = feature.place_id;
          feature.properties.id = id;
          delete feature.place_id;
        }
      ];
      
      toMap.forEach(execute);
      return res;
    };

    var parameter = {
      latlng: ll[1] + ', ' + ll[0],
      'key': 'AIzaSyBmJ2NvVf5Om1u1-YuA8lFKzEwZ2BHhd9U'
    };

    return {
      endpoint: 'https://maps.googleapis.com/maps/api/geocode/json',
      parameter: parameter,
      responseMapper: mapper
    };
  }
};

/**
 * Reverse geocode
 */

function reverseAmigo(ll, callback) {
  log('--> reverse geocoding %s', ll);

  // var query = geocodingOptions.amigoReverse(ll);
  var query = geocodingOptions.googleReverse(ll);

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

    var databoundary = [];
    get('https://www.amigocloud.com/api/v1/users/1/projects/661/datasets/22492', {'token' : config.realtime_access_token()}, function(err, res) {

        if (err) {
            console.log("error");
        }else {
            var list_address;
            
            // var query = geocodingOptions.amigoSuggestions(text, res);
            var query = geocodingOptions.googleSuggestions(text, res);

            get(query.endpoint, query.parameter, function(err, res) {

                    if(err) {
                        log("Amigo Cloud Response Error ->", err);

                    }else{
                        if (query.responseMapper) {
                          res = query.responseMapper(res);
                        }

                        if(res.body.features) {

                            list_address = res.body.features;
                            if (list_address.length > 0) {
                                 callback(
                                    null,
                                    list_address
                                );
                            }else {
                                callback(true, res);
                            }

                        }
                    }
            });
        }

    });
}

function suggest(text, callback) {
  var bingSuggestions, nominatimSuggestions, totalSuggestions;
  log('--> getting suggestion for %s', text);

  get('/geocode/suggest/'+ text, function(err, res){

    if (err) {
      log('<-- suggestion error %s', err);
      callback(err, res);
    } else {
      log('<-- got %s suggestions', res.body.length);

	bingSuggestions = res.body;

	get('http://nominatim.openstreetmap.org/search' +
	    '?format=json&addressdetails=1&' +
	    'viewbox=' + southWest[0] + ',' +
	    northEast[1] + ',' + northEast[0] + ',' + southWest[1] +
	    '&bounded=1' +
	    'countrycodes=us&q=' + text, function (err, nRes) {
		var inside = false;
	    nominatimSuggestions = [];
            for (var i = 0; i < nRes.body.length; i++) {
                    nominatimSuggestions.push(nRes.body[i]);
            }
            callback(
		null,
		nominatimSuggestions.slice(0,2).concat(bingSuggestions.slice(0,3))
	    );
	});
    }
  });

}