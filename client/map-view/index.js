var config = require('config');
var mapModule = require('map');
var plugins = require('./leaflet_plugins');
var polyUtil = require('./polyline_encoded.js');
var routeboxer = require('./leaflet_routeboxer.js');
var leaflet_label = require('./leaflet_label/leaflet.label-src.js');
var collision = require('./leaflet_layergroup_collision.js');

var session = require('session');

var center = config.geocode().center.split(',').map(parseFloat)
if (config.map_provider && config.map_provider() === 'Mapbox') {
    L.mapbox.accessToken = config.mapbox_access_token();
}

module.exports = function (el) {
    var map, realtime, southWest, northEast, blurLayer;
    localStorage.removeItem('dataplan');
    sessionStorage.removeItem('dataplan');
    southWest = L.latLng(35.946877085397, -123.480610897013);
    northEast = L.latLng(40.763279543715, -118.789317362500);

    if (config.map_provider && config.map_provider() === 'AmigoCloud') {
        map = (new L.amigo.map(el, {
            amigoLogo: 'right',
            loadAmigoLayers: false,
            inertia: false,
            zoomAnimation: true,
            maxBounds: L.latLngBounds(southWest, northEast),
            minZoom: 8
        })).setView([center[1], center[0]], config.geocode().zoom);

        L.amigo.auth.setToken(config.support_data_token());

        blurLayer = L.tileLayer(
            'https://www.amigocloud.com/api/v1/users/' +
            '23/projects/3019/datasets/23835/tiles/{z}/{x}/{y}.png?' +
            'token=' + config.support_data_token(), {
                name: 'Uncovered Area'
            }
        );

        map.addAuthLayer({
            id: config.mapbox_map_id(),
            accessToken: config.mapbox_access_token(),
            name: 'Gray',
            provider: 'mapbox'
        });
        map.addBaseLayer(L.amigo.AmigoSatellite);
        map.addBaseLayer(L.amigo.AmigoStreet);
        map.addBaseLayer(L.amigo.AmigoGray);
        map.layersControl.addBaseLayer(
            L. bingLayer(
                config.bing_key(), {
                    type: 'Road',
                    attribution: 'Bing Maps'
                }
            ),
            'Bing Road'
        );
        map.layersControl.addOverlay(blurLayer);
        blurLayer.addTo(map);

        //L.control.locate().addTo(map);

        map.routes = []; // array to hold all route objects

        module.exports.activeMap = map;

        //map.realtimeControl = L.control.toggleRealTime().addTo(map);

        realtime = mapModule.realtime();


    } else if (config.map_provider && config.map_provider() === 'GoogleV3') {

        map = (new L.modeify.map(el, {
            loadGoogleLayers: true,
            inertia: false,
            zoomAnimation: true,
            maxBounds: L.latLngBounds(southWest, northEast),
            minZoom: 8
        })).setView([center[1], center[0]], config.geocode().zoom);

        L.modeify.auth.setToken(config.support_data_token());

        // map.addControl(L.control.locate({
        //     locateOptions: {
        //         enableHighAccuracy: true
        //     },
        //     // position: 'bottomright',
        // }));

        map.routes = []; // array to hold all route objects

        module.exports.activeMap = map;

        realtime = mapModule.realtime();

    } else if (config.map_provider && config.map_provider() === 'ESRI') {
        southWest = L.latLng(35.946877085397, -123.480610897013);
        northEast = L.latLng(40.763279543715, -118.789317362500);

        map = (new L.map(el, {
            zoomAnimation: true,
            maxBounds: L.latLngBounds(southWest, northEast),
            minZoom: 8
        })).setView([center[1], center[0]], config.geocode().zoom);

        /**
         * @todo Add Layer Controls for switching ESRI basemaps
         * @see https://esri.github.io/esri-leaflet/examples/switching-basemaps.html
         *
         */
        var esriTopo = L.esri.basemapLayer('Topographic');
        var esriImage = L.esri.basemapLayer('Imagery');
        var esriStreet = L.esri.basemapLayer('Streets');
        var esriTerrain = L.esri.basemapLayer('Terrain');
        var esriGray = L.esri.basemapLayer('Gray');

        esriStreet.addTo(map);

        L.control.layers({
            Streets: esriStreet,
            Imagery: esriImage,
            // Terrain: esriTerrain,
            Topographic: esriTopo,
            Gray: esriGray,
        }, {}, {
            collapsed: false
        }).addTo(map);

        map.routes = []; // array to hold all route objects

        module.exports.activeMap = map;

        // realtime = mapModule.realtime();

    } else {

        map = L.mapbox.map(el, config.mapbox_map_id(), {
            attributionControl: false,
            inertia: false,
            zoomAnimation: false
        }).setView([center[1], center[0]], config.geocode().zoom);
    }

    return map;
};

module.exports.getMap = function () {
    return this.activeMap;
};

module.exports.cleanRoute = function () {
    module.exports.activeRoute.removeLayer();
    module.exports.activeRoute = null;
};

module.exports.polyline_creadas = [];
module.exports.marker_creadas = [];
module.exports.makerpoint_creadas = [];
module.exports.collision_group = {};
module.exports.marker_collision_group = [];
module.exports.last_marker_collision_group = [];
module.exports.addedRouteStops = [];
module.exports.addedRouteBuses = [];

module.exports.drawMakerCollision = function () {
    var collision_group = L.layerGroup.collision();
    var marker_collision_group = [];
    for (i in this.marker_collision_group) {
        for (j in this.marker_collision_group[i]) {
            marker_collision_group.push(this.marker_collision_group[i][j]);
        }
    }
    collision_group.addLayer(marker_collision_group);
    collision_group.onAdd(this.activeMap);
    this.collision_group = collision_group;

};

module.exports.drawItinerationMakerCollision = function (i) {
    var collision_group = L.layerGroup.collision();
    var marker_collision_group = [];
    var selection_marker_collision_group = [];

    for (j in this.last_marker_collision_group[i]) {
        marker_collision_group.push(this.last_marker_collision_group[i][j]);
        var objmarker = this.last_marker_collision_group[i][j];
        selection_marker_collision_group.push(objmarker);
    }

    for (j in this.last_marker_collision_group) {
        if (j != i) {

            for (k in this.last_marker_collision_group[j]) {
                var collision = false;
                var objmarker = this.last_marker_collision_group[j][k].getLatLng();
                for (m in selection_marker_collision_group) {
                    var iobjmarker = selection_marker_collision_group[m].getLatLng();
                    if (objmarker.lat == iobjmarker.lat && objmarker.lng == iobjmarker.lng) {
                        collision = true;
                        break;
                    } else {
                        collision = false;
                    }
                }

                if (!collision) {
                    marker_collision_group.push(this.last_marker_collision_group[j][k]);
                }

            }
        }

    }
    collision_group.addLayer(marker_collision_group);
    collision_group.onAdd(this.activeMap);
    this.collision_group = collision_group;

};

module.exports.getpolyline_creadas = function () {
    return this.polyline_creadas;
};

module.exports.getMarker_creadas = function () {
    return this.marker_creadas;
};

module.exports.cleanPolyline = function () {
    var polyline_creadas = this.getpolyline_creadas();
    var map = this.activeMap;
    for (i in polyline_creadas) {
        try {
            map.removeLayer(polyline_creadas[i]);

        } catch (e) {
            console.log("problema al eliminar " + e);
        }

    }
    this.polyline_creadas = [];

};

module.exports.cleanMarkerCollision = function () {

    for (i in this.marker_collision_group) {
        for (j in this.marker_collision_group[i]) {
            this.collision_group.removeLayer(this.marker_collision_group[i][j]);
        }
    }

    for (i in this.last_marker_collision_group) {
        for (j in this.last_marker_collision_group[i]) {
            this.collision_group.removeLayer(this.last_marker_collision_group[i][j]);
        }
    }

    this.last_marker_collision_group = this.marker_collision_group;

    this.marker_collision_group = [];
};

module.exports.cleanMarker = function () {
    var map = this.activeMap;
    for (i in this.marker_creadas) {
        try {
            map.removeLayer(this.marker_creadas[i]);

        } catch (e) {
            console.log("problema al eliminar " + e);
        }
    }

    this.marker_creadas = [];

};

module.exports.cleanMarkerpoint = function () {
    var map = this.activeMap;
    for (i in this.makerpoint_creadas) {
        try {
            map.removeLayer(this.makerpoint_creadas[i]);

        } catch (e) {
            console.log("problema al eliminar " + e);
        }
    }

    this.makerpoint_creadas = [];

};

module.exports.marker_map = function (from, to) {
    var IconStart = L.icon({
        iconUrl: 'assets/images/graphics/start.svg',
        iconSize: [28, 28],
        iconAnchor: [0, 0],
        popupAnchor: [0, -50]
    });
    var IconEnd = L.icon({
        iconUrl: 'assets/images/graphics/end.svg',
        iconSize: [28, 28],
        iconAnchor: [0, 0],
        popupAnchor: [0, -50]
    });

    var markerform = new L.marker([from[0], from[1]], {
            icon: IconStart,
            draggable: true
        })
        .addTo(this.activeMap);
    var markerto = new L.marker([to[0], to[1]], {
            icon: IconEnd,
            draggable: true
        })
        .addTo(this.activeMap);
    var _this = this;

    markerform.on('dragend', function (e) {
        var marker = e.target;
        var result = marker.getLatLng();
        _this.cleanPolyline();
        _this.cleanMarkerpoint();
        _this.cleanMarkerCollision();
        var plan = session.plan();

        plan.setAddress('from', result.lng + ',' + result.lat, function (err, rees) {
            plan.updateRoutes();
        });
    });

    markerto.on('dragend', function (e) {
        var marker = e.target;
        var result = marker.getLatLng();
        _this.cleanPolyline();
        _this.cleanMarkerpoint();
        _this.cleanMarkerCollision();
        var plan = session.plan();
        plan.setAddress('to', result.lng + ',' + result.lat, function (err, rees) {
            plan.updateRoutes();
        });
    });

    this.marker_creadas.push(markerform);
    this.marker_creadas.push(markerto);
};

module.exports.marker_map_point = function (to, map, itineration) {

    var name = to[2];
    var class_name = 'leaflet-div-icon1 circle-fade-' + itineration;
    var html = "<span class='leaflet-label'>" + name + "</span>";

    var marker = L.marker({
        "lat": to[0],
        "lng": to[1]
    }, {
        icon: L.divIcon({
            className: class_name,
            iconSize: [15, 15],
            iconAnchor: [0, 0],
            html: html
        }),
        interactive: false,
        clickable: false
    });

    if (this.marker_collision_group[itineration] === undefined) {
        this.marker_collision_group[itineration] = [];
        this.marker_collision_group[itineration].push(marker);
    } else {
        this.marker_collision_group[itineration].push(marker);
    }
};

module.exports.toggleMapElement = function (el, showHide) {
    if (!el || !showHide) {
        return;
    }
    $(el)[showHide]();
};

module.exports.drawRouteGoogle = function (legs, mode, itineration) {
    var route = legs.legGeometry.points;
    var circle_from = [legs.from.lat, legs.from.lon, legs.from.name];
    var circle_to = [legs.to.lat, legs.to.lon, legs.to.name];
    var weight = 5;
    var classname = "iteration-" + itineration + " iteration-200";

    var dasharray = '';

    var colors = {
        'CAR': '#ffeda0',
        'BICYCLE': '#f03b20',
        'TRAM': '#74c476',
        'RAIL': '#fe9929',
        'WALK': '#3182bd',
        'BUS': '#6baed6'
    };
    var color = colors[mode] ? colors[mode] : '#000000';

    if (mode === "CAR") {
        dasharray = '6';
        weight = 3;

    } else if (mode === "BICYCLE") {
        if (!(legs.routeColor === undefined)) {
            color = "#" + legs.routeColor;
        }
        dasharray = '5,5';
        weight = 3;

    } else if (mode == "SUBWAY" || mode == "RAIL" || mode === "TRAM") {
        if (!(legs.routeColor === undefined)) {
            if (legs.routeColor != "" || legs.routeColor.length == 6) {
                color = "#" + legs.routeColor;
            }

        }
        weight = 8;
        this.marker_map_point(circle_from, this.activeMap, itineration);
        this.marker_map_point(circle_to, this.activeMap, itineration);

    } else if (mode == "WALK") {
        dasharray = '5,5';
        weight = 3;
    } else if (mode == "BUS") {
        if (!(legs.routeColor === undefined)) {
            if (legs.routeColor != "" || legs.routeColor.length == 6) {
                color = "#" + legs.routeColor;
            }
        }
        weight = 5;
        this.marker_map_point(circle_from, this.activeMap, itineration);
        this.marker_map_point(circle_to, this.activeMap, itineration);
    }
    
    // we don't want white ever
    if (color == "#FFFFFF") {
        color = "#fec44f";
    }
    

    var color_options;
    color_options = {
        color: color,
        weight: weight,
        opacity: 1,
        dashArray: dasharray,
        className: classname
    };

    var argpolyline = L.PolylineUtil.decode(route, 5);
    argpolyline.unshift(circle_from);
    route = new L.Polyline(argpolyline, color_options);
    this.polyline_creadas.push(route);
    var boxes = L.RouteBoxer.box(route, 5);
    var boxpolys = new Array(boxes.length);
    route.addTo(this.activeMap);
    return route;
};

module.exports.drawRouteStops = function (routeId, stops, isBus, agencyId) {
    var stopsGroup = L.featureGroup();
    var endPoint = '/api/transitime/predictions';

    for (var i = 0; i < stops.length; i++) {
        var class_name = 'stops-icon';

        if (i === 0 || i === stops.length - 1) {
            class_name += ' junction';
        }

        var marker = L.marker({
            "lat": stops[i].lat,
            "lng": stops[i].lon
        }, {
            icon: L.divIcon({
                className: class_name,
                iconSize: [15, 15],
                iconAnchor: [0, 0]
            }),
            interactive: true,
            clickable: true
        });

        marker.extra = stops[i];
        marker.bindPopup('<div class="stop-loading"><i class="fa fa-circle-o-notch fa-spin"></i><div>', {
            className: 'stop-popup'
        });

        marker.on('click', function (e) {
            var popup = e.target.getPopup();
            popup.setContent('<div class="stop-loading"><i class="fa fa-circle-o-notch fa-spin"></i><div>');
            popup.update();

            var rtiid = e.target.extra.code;

            $.get(endPoint, {
                rs: routeId + '|' + rtiid,
                format: 'json',
                agency: agencyId
            }).done(function (data) {
                var stopInfo = data.predictions[0];
                var predictions = data.predictions[0].destinations[0].predictions;

                var header = '<div class="popup-header">' + '<h5>' + stopInfo.stopName + '</h5></div>';
                // var rtiidStr = '<strong>RTIID:</strong> ' + rtiid;
                var rtiidStr = '<strong>Stop ID:</strong> ' + stopInfo.stopCode;
                var route = '<strong>Route:</strong> ' + stopInfo.routeShortName + ' - ';

                for (var i = 0; i < predictions.length; i++) {
                    route += predictions[i].min;
                    if (i === predictions.length - 1) {
                        route += predictions[i].min !== 1 ? 'mins' : 'min';
                    } else {
                        route += ', ';
                    }
                }

                var string = '<div class="stop-popup-content">' + header + '<div class="popup-body">' +
                             rtiidStr + '<br/>' + route + '</div></div>';

                popup.setContent(string);
                popup.update();
            });
        });

        marker.addTo(stopsGroup);
    }

    this.addedRouteStops.push(stopsGroup);
    stopsGroup.addTo(this.activeMap);
};

module.exports.clearExistingRoutes = function () {
    if (this.activeMap) {
        if (this.addedRouteStops) {
            this.removeRouteStops();
        }
        this.manageRealtime.removeRealtimeData(this.activeMap);
        this.toggleMapElement('.leaflet-div-icon1', 'show');
    }
};

module.exports.removeRouteStops = function () {
    for (var r in this.addedRouteStops) {
        this.activeMap.removeLayer(this.addedRouteStops[r]);
    }

    this.addedRouteStops = [];
};

module.exports.removeRouteBuses = function () {
    for (var r in this.addedRouteBuses) {
        this.activeMap.removeLayer(this.addedRouteBuses[r]);
    }

    this.addedRouteBuses = [];
};

module.exports.manageRealtime = {
    currRoutes: {},
    agencyForRoute: {},

    pushToCurrRoutes: function (id, direction, agencyId) {
        this.currRoutes[id] = direction;
        this.agencyForRoute[id] = agencyId;
    },

    removeRealtimeData: function (map) {
        mapModule.currRoutes = this.currRoutes = {};
        if (map.realtime && map.realtime.active) {
            mapModule.toggleRealtime(map);
        }
    },

    renderRealtime: function () {
        mapModule.currRoutes = this.currRoutes;
        mapModule.agencyForRoute = this.agencyForRoute;
        mapModule.toggleRealtime(module.exports.getMap());
    },

    toggleAsyncRealtime: function (apiCalls) {
        $.when.apply($, apiCalls).done($.proxy(this.renderRealtime, this));
    }
};

module.exports.mapRouteStops = function (legs) {
    var deferredRouteDetails = [],
        vehicle = {};

    module.exports.clearExistingRoutes();

    for (var i = 0; i < legs.length; i++) {
        vehicle = legs[i];
        if (vehicle.mode === 'TRAM' || vehicle.mode === 'BUS' || vehicle.mode === 'RAIL') {
            if (vehicle.route.length < 4) {
                deferredRouteDetails.push(
                    module.exports.loadRouteStops(
                        vehicle.route,
                        vehicle.from.stopCode,
                        vehicle.to.stopCode,
                        vehicle.mode === 'BUS',
                        vehicle.agencyId
                    )
                );
            }
        }
    }

    this.manageRealtime.toggleAsyncRealtime(deferredRouteDetails);
};

module.exports.loadRouteStops = function (routeId, from, to, isBus, agencyId) {
    var endPoint = '/api/transitime/routeDetails';

    return $.get(endPoint, {
        r: routeId,
        format: 'json',
        agency: agencyId
    }).success(function (data) {
        var route = data.routes[0],
            foundFrom = false, foundTo = false,
            startAdding = false,
            stops = [],
            i = 0;

        // detecting which direction we need to draw
        for (; i < route.directions.length; i++) {
            for (var j = 0; j < route.directions[i].stops.length; j++) {
                if (foundFrom && foundTo) {
                    break;
                }
                if (route.directions[i].stops[j].code + '' === from) {
                    foundFrom = true;
                }
                if (foundFrom === true && route.directions[i].stops[j].code + '' === to) {
                    foundTo = true;
                }
            }
            if (foundFrom && foundTo) {
                break;
            }
            foundFrom = false;
            foundTo = false;
        }

        // limiting number of stops to draw
        for (var s = 0; s < route.directions[i].stops.length; s++) {
            if (route.directions[i].stops[s].code.toString() === from) {
                startAdding = true;
                stops.push(route.directions[i].stops[s]);
            }
            if (startAdding && route.directions[i].stops[s].code.toString() === to) {
                stops.push(route.directions[i].stops[s]);
                startAdding = false;
            }
            if (startAdding) {
                stops.push(route.directions[i].stops[s]);
            }
        }

        module.exports.drawRouteStops(routeId, stops, isBus, agencyId);
        module.exports.toggleMapElement('.leaflet-div-icon1', 'hide');

        return module.exports.manageRealtime.pushToCurrRoutes(
            routeId,
            i.toString(), // i here matches the route direction and is always 1 or 0
            agencyId
        );
    }).fail(function (msg) {
        console.log('Request returned with error msg:' + msg);
    });
};
