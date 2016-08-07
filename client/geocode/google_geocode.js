var mapView = require('map-view');

/* 
 * This code is pulled into separate file b/c the mapping makes it unecessarily complicated.
 * This being said, the mapping will allow us to switch back to the amigo geocode with ease
 * in index.js
 */

window.modeify.config['geocode_bounds'] = {}
window.modeify.config['geocode_bounds']['center'] = [37.303626, -121.884750];

/*
 * Utils
 */

var defineProp = function (path, oldVal, newVal) {
  Object.defineProperty(path, newVal, Object.getOwnPropertyDescriptor(path, oldVal));
  delete path[oldVal];
};

var getCurrMap = function () {
  return mapView.getMap();
};

/*
 * Suggestions geocoding
 */

GoogleSuggestions = function (text, res) {
  this.text = text;
  this.res = res;

  this.futureRes = {
    body: {}
  };
}

GoogleSuggestions.prototype = {
  responseMapper: function (res) {
    var execute = function (func) { func(); };
    var toMap = [
      function getData () {
        defineProp(res.body, 'result', 'features');
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
      }
    ];

    toMap.forEach(execute);
    return res;
  },

  _getPlaces: function () {
    var dfd = $.Deferred(),
        futureRes = this.futureRes,
        text = this.text;

    var getMapSpecs = function() {
      var map = getCurrMap();
      var mapBoundNorthEast = map.getBounds().getNorthEast();
      return {
	radius: 17000,
	location: {lat: 37.303626, lng: -121.884750}
	// TODO: make this part of a global configuration, using the following as defaults
        // radius: mapBoundNorthEast.distanceTo(map.getCenter()),
        // location: map.getCenter()
      };
    };
    var specs = getMapSpecs();

    var mapToGeocodeRes = function (results) {
      results.forEach(function (feature, idx) {
        feature.formatted_address = feature.name + ', ' + feature.vicinity;
        feature.address_components = {};
        feature.geometry = {
          location: {
            lat: feature.geometry.location.lat(),
            lng: feature.geometry.location.lng()
          } 
        };
      });

      if (!futureRes.body.result) {
        futureRes.body.result = results
      } else {
        var method = $.isNumeric(text.charAt(0)) ? 'push' : 'unshift';
        Array.prototype[method].apply(futureRes.body.result, results);
      }
      dfd.resolve();
    }

    var config = {
      'keyword': this.text,
      'location': specs.location,
      'radius': specs.radius
    };

    var service = new google.maps.places.PlacesService(document.createElement('div'));
    service.nearbySearch(config, mapToGeocodeRes);
    return dfd.promise();
  },

  _getGeocode: function () {
    var futureRes = this.futureRes,
        text = this.text;

    var endpoint = 'https://maps.googleapis.com/maps/api/geocode/json';
    var parameter = {
      'address': text,
      'key': 'AIzaSyBmJ2NvVf5Om1u1-YuA8lFKzEwZ2BHhd9U',
      'components': 'administrative_area:CA|country:US'
    };

    if (this.res && this.res.body && this.res.body.boundingbox) {
      var boundsArr = this.res.body.boundingbox.split(','),
          westArr = boundsArr[0].split(' '),
          eastArr = boundsArr[1].split(' '),
          bounds = westArr[0] + '|' + westArr[1] + '|' + eastArr[0] + '|' + eastArr[1];

      parameter.bounds = bounds;
    }

    return $.get(endpoint, parameter).then(function (geoRes) {
      if (!futureRes.body.result) {
        futureRes.body.result = geoRes.results
      } else {
        var method = $.isNumeric(text.charAt(0)) ? 'unshift' : 'push';
        Array.prototype[method].apply(futureRes.body.result, geoRes.results);
      }
    });
  },

  get: function () {
    var apiCalls = [],
        that = this;
    apiCalls.push(that._getGeocode(), that._getPlaces());
    return $.when.apply($, apiCalls).then(function () { 
      return that.futureRes; 
    });
  }
};

/*
 * Reverse geocoding
 */

GoogleReverse = function (ll) {
  this.ll = ll;
  this.parameter = this.getParameter();
}

GoogleReverse.prototype = {
  endpoint: 'https://maps.googleapis.com/maps/api/geocode/json',

  responseMapper: function (res) {
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
  },

  getParameter: function () {
    return {
      latlng: this.ll[1] + ', ' + this.ll[0],
      'key': 'AIzaSyBmJ2NvVf5Om1u1-YuA8lFKzEwZ2BHhd9U'
    }
  }
};

module.exports = {
  googleSuggestions: function (text, res) {
    return new GoogleSuggestions(text, res);
  },
  googleReverse: function (ll) {
    return new GoogleReverse(ll);
  }
};
