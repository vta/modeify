var config = require('config');
var debug = require('debug')(config.name() + ':map');
var page = require('page');
var plugins = require('./leaflet-plugins');

/**
 * Expose `map`
 */

module.exports = function(el, opts) {
  opts = opts || {};
  opts.tileLayer = opts.tileLayer || {
    detectRetina: true
  };

  // create a map in the el with given options
  if (config.map_provider && config.map_provider() === 'AmigoCloud') {
    return new Map(L.amigo.map(el, opts));
  } else {
    return new Map(L.mapbox.map(el, config.mapbox_map_id(), opts));
  }
};

/**
 * Expose `createMarker`
 */

module.exports.createMarker = function(opts) {
  debug('creating marker %s', opts);

  var marker;

  if (config.map_provider && config.map_provider() === 'AmigoCloud') {
    marker = L.marker(new L.LatLng(opts.coordinate[1], opts.coordinate[0]), {
      icon: L.amigo.marker.icon({
        'marker-size': opts.size || 'medium',
        'marker-color': opts.color || '#ccc',
        'marker-symbol': opts.icon || ''
      }),
      title: opts.title || ''
    });
  } else {
    marker = L.marker(new L.LatLng(opts.coordinate[1], opts.coordinate[0]), {
      icon: L.mapbox.marker.icon({
        'marker-size': opts.size || 'medium',
        'marker-color': opts.color || '#ccc',
        'marker-symbol': opts.icon || ''
      }),
      title: opts.title || ''
    });
  }

  if (opts.url) {
    marker.on('click', function() {
      page(opts.url);
    });
  }
  return marker;
};

/**
 * Expose `realtime`
 */


if (config.map_provider() === 'AmigoCloud') {
    module.exports.realtime = function() {
        debug('setting up empty socket connection');

        // L.amigo.realtime.setAccessToken(config.realtime_access_token());
        // L.amigo.realtime.connectDatasetByUrl(config.realtime_dataset_url());
    };
}

module.exports.getRealtimeVehicles = function (validVehicles) {
  var currRoutes = module.exports.currRoutes,
      agencyForRoute = module.exports.agencyForRoute,
      requests = [],
      endpoint = '/api/transitime/vehiclesDetails';

  $.each(currRoutes, function (routeId, direction) {
    // currRoutes is on obj containing current route legs stored as:
    // key: routeId, value: direction of travel (1 or 0)
    requests.push($.get(endpoint, {
      r: routeId,
      format: 'json',
      agency: agencyForRoute[routeId]
    }).then(function (data) {
      // find vehicles in route heading direction that matches legs in currRoutes
      var vehicle = {};
      for (var j = 0; j < data.vehicles.length; j++) {
        vehicle = data.vehicles[j];
        if (vehicle.direction === currRoutes[vehicle.routeShortName]) {
          validVehicles.push(vehicle);
        }
      }
    }));
  });

  return requests;
};

/**
 * Toggle realtime
 */
module.exports.toggleRealtime = function(viewMap) {
  var map = viewMap;
  debug('toggling realtime');

  var loadRealtime = function () {
      map = module.exports.realtimeMap = viewMap;

      if (!map.realtime) {
        map.realtime = {
          points: []
        };
      }

      map.realtime.active = true;

      var pollForVehicles = function () {
        var validVehicles = [];
        getValidVehicles = module.exports.getRealtimeVehicles(validVehicles);
        $.when.apply($, getValidVehicles).done(function () {
          if (map.realtime.active && validVehicles.length) {
            for (var i = 0; i < validVehicles.length; i++) {
              var existingPoint = module.exports.findPoint(map, validVehicles[i]);
              if (existingPoint === -1) {
                module.exports.addPoint(map, validVehicles[i]);
              } else if (module.exports.hasVehicleMoved(map.realtime.points[existingPoint], validVehicles[i])) {
                module.exports.movePoint(map, validVehicles[i]);
              }
            }
          }
          module.exports.vehiclePoller = setTimeout(function () {
            pollForVehicles();
          }, 3000);
        });
      };

      pollForVehicles(); // recursive, fires at least 3 seconds after it last completed
  };

  var clearRealtime = function () {
      clearTimeout(module.exports.vehiclePoller);
      map.realtime.active = false;
      // L.amigo.realtime.socket.removeAllListeners('realtime'); // I left this in for reduncency when switching to polling - Luke
      for (var i = 0; i < map.realtime.points.length; i++) {
        map.removeLayer(map.realtime.points[i].marker);
      }
      map.realtime.points = [];
  };

  if (!map.realtime || !map.realtime.active) {
      loadRealtime();
  } else {
      clearRealtime();
  }
};

module.exports.drawRoute = function (marker) {
  var routeId = marker.realtimeData.routeId,
      url = config.bus_routes_url(),
      tokens = url.split('/'),
      datasetId = tokens[tokens.length - 1],
      projectUrl = tokens.slice(0, tokens.length - 2).join('/'),
      routeStyle = {
  	    color: '#8ec449',
  	    opacity: 1,
  	    weight: 4,
        className:'realtimemarker'
      },
      queryUrl;

  var query = 'SELECT st_asgeojson(wkb_geometry) FROM dataset_' + datasetId +
    " WHERE lineabbr='" + routeId + "'";
  queryUrl = projectUrl + '/sql?token=' + config.realtime_access_token() +
    '&query=' + query + '&limit=1000';

  L.amigo.utils.get(queryUrl).
    then(function (data) {
      if (!data.data.length) {
        return;
      }

      module.exports.activeRoute = L.geoJson(

      JSON.parse(data.data[0].st_asgeojson), {
	      style: routeStyle
	    }).addTo(module.exports.realtimeMap);
    });
};

module.exports.deleteRoute = function (marker) {
  if (!module.exports.activeRoute) {
    return;
  }

  module.exports.realtimeMap.removeLayer(module.exports.activeRoute);
  module.exports.activeRoute.clearLayers();
  module.exports.activeRoute = null;
};

/**
 * REALTIME FUNCTIONS
 */
L.NumberedDivIcon = L.Icon.extend({
    options: {
    iconUrl: '',
    number: '',
    className: 'leaflet-div-icon',
    divClass: 'number'
  },

  createIcon: function () {
    var div = document.createElement('div');
    var text = document.createElement('span');
    var img = this._createImg(this.options['iconUrl']);
    var numdiv = document.createElement('div');

    numdiv.setAttribute ( "class", this.options['divClass'] );
    text.innerHTML = this.options['number'] || '';
    numdiv.appendChild(text);
    img.setAttribute('style', 'max-width:' + this.options.iconSize[0] + 'px !important;' +
		     'max-height:' + this.options.iconSize[1] + 'px !important');
    div.appendChild ( img );

    if (this.options['number']) {
      div.appendChild ( numdiv );
    }

    this._setIconStyles(div, 'icon');

    return div;
  }
});

module.exports.findPoint = function (map, point) {
  for (var i = 0; i < map.realtime.points.length; i++) {
    if (map.realtime.points[i].id === point.id) {
      return i;
    }
  }

  return -1;
};

module.exports.hasVehicleMoved = function (oldPoint, newPoint) {
  return oldPoint.lat !== newPoint.loc.lat && oldPoint.lon !== newPoint.loc.lon;
};

module.exports.addPoint = function (map, point) {
  var routeId = point.routeId,
      routeShortName = point.routeShortName,
      iconUrl = 'assets/images/graphics/',
      line, newPoint;

  line = L.polyline(
    [
      [parseFloat(point.loc.lat), parseFloat(point.loc.lon)],
      [parseFloat(point.loc.lat), parseFloat(point.loc.lon)],
    ],
    {
      className: "realtimemarker"
    }

  );

  newPoint = {
    id: point.id,
    lat: point.loc.lat,
    lon: point.loc.lon,
    marker: L.animatedMarker(line.getLatLngs()).addTo(map)
  };

  iconUrl += point.vehicleType === '0' ? 'tram-realtime.png' : 'bus-realtime.png';

  newPoint.marker.setIcon(new L.NumberedDivIcon({
    iconUrl: iconUrl,
    iconSize: [47, 47],
    iconAnchor: [20, 45],
    popupAnchor:  [0, -50],
    className: 'tint',
    number: routeShortName
  }));

  newPoint.marker.realtimeData = point;
  newPoint.marker.bindPopup(module.exports.makePopup(point));
  newPoint.marker.on('popupopen', function () {
    // Workaround for bug where you can no longer
    // click on start and end markers after opening
    // a real-time popup
    var zoomHideEl = document.querySelectorAll('svg.leaflet-zoom-hide')[0];

    if (zoomHideEl) {
      zoomHideEl.style.display = 'inherit';
    }

    module.exports.drawRoute(this);
  });

  newPoint.marker.on('popupclose', function () {
    // Workaround counterpart
    var zoomHideEl = document.querySelectorAll('path.realtimemarker');
    for (i in zoomHideEl) {
      var parent = zoomHideEl[i].parentNode;
    }
    module.exports.deleteRoute(this);
  });

  map.realtime.points.push(newPoint);
};

module.exports.movePoint = function (map, point) {
  var routeId = point.routeId,
      routeShortName = point.routeShortName,
      iconUrl = 'assets/images/graphics/',
      line, currentPoint;

  currentPoint = map.realtime.points[module.exports.findPoint(map, point)];
  line = L.polyline(
    [
      [currentPoint.marker.getLatLng().lat, currentPoint.marker.getLatLng().lng],
      [parseFloat(point.loc.lat), parseFloat(point.loc.lon)]
    ],
    {
      className: "realtimemarker"
    }
  );

  iconUrl += point.vehicleType === '0' ? 'tram-realtime.png' : 'bus-realtime.png';

  currentPoint.marker.setIcon(new L.NumberedDivIcon({
    iconUrl: iconUrl,
    iconSize: [47, 47],
    iconAnchor: [20, 45],
    popupAnchor:  [0, -50],
    className: 'tint',
    number: routeShortName
  }));

  currentPoint.marker.realtimeData = point;
  currentPoint.marker.setLine(line.getLatLngs());
  currentPoint.marker.setPopupContent(
    module.exports.makePopup(point)
  );
  currentPoint.marker.animate();
};

module.exports.makePopup = function (point) {
  var routeName = point.routeName;
  var buildRow = function (label, val) {
    var openRow = '<tr class="popup-row"><td class="label">',
        switchTd = ' </td><td class="value">',
        closeRow = '</td></tr>';
    return openRow + label + switchTd + val + closeRow;
  };

  if (parseInt(routeName, 10) !== NaN && routeName.indexOf(' - ') !== -1) {
    routeName = routeName.slice(routeName.indexOf(' - ') + 3);
  }

  var string = '<div class="bus-popup"><div class="popup-header">';
  string += '<h5><i class="fa fa-bus"></i> ' + point.routeShortName + ': ';
  // string += '<a target="_blank" href="http://www.vta.org/routes/rt' + point.routeId + '">';
  string += routeName + '</a></h5></div>';

  string += '<div class="popup-body"><table>';

  string += buildRow('Vehicle:', point.id);
  string += buildRow('Headsign:', point.headsign);
  string += buildRow('Next Stop:', point.nextStopName);

  string += '</table></div></div>';

  return string;
};


/**
 * Map
 */

function Map(map) {
  this.map = map;
  if (config.map_provider && config.map_provider() === 'AmigoCloud') {
    this.featureLayer = L.amigo.featureLayer().addTo(map);
  } else {
    this.featureLayer = L.mapbox.featureLayer().addTo(map);
  }
}

/**
 * Add Marker
 */

Map.prototype.addMarker = function(marker) {
  this.featureLayer.addLayer(marker);
};

/**
 * Add Layer
 */

Map.prototype.addLayer = function(layer) {
  this.map.addLayer(layer);
};

/**
 * Fit bounds
 */

Map.prototype.fitLayer = function(layer) {
  debug('fitting layer %s', layer);
  var map = this.map;
  map.whenReady(function() {
    debug('map ready');
    setTimeout(function() {
      var bounds = layer.getBounds();
      debug('fitting to bounds %s', bounds);
      map.fitBounds(bounds);
    }, 200);
  });
};

/**
 * Fit to multiple layers
 */

Map.prototype.fitLayers = function(layers) {
  debug('fitting to %s layers', layers.length);
  var map = this.map;
  map.whenReady(function() {
    debug('map ready');
    setTimeout(function() {
      var bounds = layers[0].getBounds();
      for (var i = 1; i < layers.length; i++) {
        bounds.extend(layers[i].getBounds());
      }
      map.fitBounds(bounds);
    }, 200);
  });
};

/**
 * Featureify
 */

function featureify(opts) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: opts.coordinate
    },
    properties: {
      title: opts.title || '',
      description: opts.description || '',
      'marker-size': opts.size || 'medium',
      'marker-color': opts.color || '#ccc',
      'marker-symbol': opts.icon || ''
    }
  };
}
