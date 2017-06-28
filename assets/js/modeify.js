/**
 * AmigoCloud L.Util.ajax extension
 * @param url
 * @param cb
 * @returns {XMLHttpRequest}
 */
L.Util.ajax = function (url, cb) {
	// the following is from JavaScript: The Definitive Guide
	// and https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest_in_IE6
	if (window.XMLHttpRequest === undefined) {
		window.XMLHttpRequest = function () {
			/*global ActiveXObject:true */
			try {
				return new ActiveXObject("Microsoft.XMLHTTP");
			}
			catch  (e) {
				throw new Error("XMLHttpRequest is not supported");
			}
		};
	}
	var response, request = new XMLHttpRequest();
	request.open("GET", url);
	request.onreadystatechange = function () {
		/*jshint evil: true */
		if (request.readyState === 4 && request.status === 200) {
			if (window.JSON) {
				response = JSON.parse(request.responseText);
			} else {
				response = eval("(" + request.responseText + ")");
			}
			cb(response);
		}
	};
	request.send();
	return request;
};

/**
 * @package AmigoCloud-JS core
 * @internal Refactoring AmigoCloud-JS to be modular and use separate Leaflet libraries
 */


/**
 * AmigoCloud Constants array
 * @type {{amigoLayersData: [*], baseUrl: string, socketServerUrl: string, amigoLogoUrl: string, apiUrl: string}}
 */
var constants = {
    amigoLayersData: [
        {
            name: 'AmigoStreet',
            url: 'https://www.amigocloud.com/api/v1/base_layers/2',
            tiles: 'https://cdnamigocloud.global.ssl.fastly.net/api/v1/base_layers/2/tiles'
        },
        {
            name: 'AmigoGray',
            url: 'https://www.amigocloud.com/api/v1/base_layers/392',
            tiles: 'https://cdnamigocloud.global.ssl.fastly.net/api/v1/base_layers/392/tiles'
        },
        {
            name: 'AmigoSatellite',
            url: 'https://www.amigocloud.com/api/v1/base_layers/3',
            tiles: 'https://cdnamigocloud.global.ssl.fastly.net/api/v1/base_layers/3/tiles'
        }
    ],
    baseUrl: 'https://www.amigocloud.com',
    socketServerUrl: 'https://www.amigocloud.com/amigosocket',
    amigoLogoUrl: 'https://cdnamigocloud.global.ssl.fastly.net/static/homepage/img/press-kit/amigocloud.png',
    apiUrl: '/api/v1'
};

/**
 * AmigoCloud Authorization tokens
 * @type {{setToken: auth.setToken, getToken: auth.getToken, getTokenParam: auth.getTokenParam}}
 */
var auth = {
    setToken: function (token) {
        this.token = token;
    },
    getToken: function () {
        return this.token;
    },
    getTokenParam: function () {
        if (this.token) {
            return '?token=' + this.token;
        } else {
            return '';
        }
    }
};

/**
 * AmigoCloud Utils
 * @type {{parseUrl: utils.parseUrl, http: utils.http, me: utils.me, get: utils.get, post: utils.post, params: utils.params, buildPopupHTML: utils.buildPopupHTML, buildPopupQuery: utils.buildPopupQuery, showPopup: utils.showPopup, processAdditionalDatasetConfig: utils.processAdditionalDatasetConfig, processPopupDatasetConfig: utils.processPopupDatasetConfig}}
 */
var utils = {
    parseUrl: function (url) {
        if (url.substr(0, 4) === 'http') {
            return url;
        } else {
            return L.modeify.constants.baseUrl + L.modeify.constants.apiUrl + url;
        }
    },
    http: function (method, url, data, headers, async) {
        var xmlHttp = new XMLHttpRequest(),

        url = L.modeify.utils.parseUrl(url);

        xmlHttp.then = function (callback, errorCallback) {
            this.onreadystatechange = function () {
                if (xmlHttp.readyState === 4) {
                    if (xmlHttp.status === 200) {
                        callback(JSON.parse(this.responseText));
                    } else {
                        errorCallback(JSON.parse(this.responseText));
                    }
                }
            };

            return xmlHttp;
        };

        xmlHttp.open(
            method,
            url,
            (async === undefined) ? true : async
        );

        if (data) {
            xmlHttp.send(L.modeify.utils.params(data));
        } else {
            xmlHttp.send();
        }

        return xmlHttp;
    },
    me: function () {
        return L.modeify.utils.get('/me');
    },
    get: function (url, data) {
        if (typeof data !== 'undefined') {
            url += '?' + L.modeify.utils.params(data) + '&token=' + L.modeify.auth.getToken() + '&format=json';
        } else {
            url += '?token=' + L.modeify.auth.getToken() + '&format=json';
        }
        return L.modeify.utils.http('GET', url);
    },
    post: function (url, data, headers) {
        if (headers) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else {
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            };
        }
        return L.modeify.utils.http('POST', url, data, headers);
    },
    params: function (params) {
        var parts = [];
        for (var attr in params) {
            parts.push([attr, encodeURIComponent(params[attr])].join('='));
        }
        return parts.join('&');
    },
    buildPopupHTML: function (data, config) {
        var header =  '<h3 class="title">';
        var body = '<div class="content"><ul>';
        var name;

        if (config.popupTitle) {
            header += data.data[0][config.popupTitle];
        }

        header += '</h3>';

        for (var i = 0; i < data.columns.length; i++) {
            if (data.columns[i].type === 'geometry') {
                continue;
            }
            name = data.columns[i].name;
            body += '<li class="row-attribute">'
            body += '<label>' + name + ': </label>';
            body += '<span>' + data.data[0][name] + '</span>';
            body += '</li>';
        }

        body += '</ul></div>';

        return header + body;
    },
    buildPopupQuery: function (e, config) {
        var query = 'SELECT ';

        if (config.displayFields) {
            query += config.displayFields.join(',');
        } else {
            query += '*'
        }
        query += ' FROM ' + e.target.options.datasetData.table_name +
            " WHERE amigo_id='" + e.data.amigo_id + "'";

        return query;
    },
    showPopup: function (e, config, map) {
        var datasetData = e.target.options.datasetData,
            popupHTMLString, queryString, queryURL;
        if (e.data) {
            // First request the row's data'
            queryURL = datasetData.project;
            queryString = L.modeify.utils.buildPopupQuery(e, config);
            L.modeify.utils.get(
                queryURL + '/sql',
                {
                    query: queryString
                }
            ).then(function (data) {
                //Now build the HTML for the popup with data
                popupHTMLString = L.modeify.utils.buildPopupHTML(data, config);

                L.popup({
                    className: 'ac-feature-popup ' + config.className
                }).setLatLng(e.latlng)
                    .setContent(popupHTMLString)
                    .openOn(map);
            }, function (error) {
                L.popup({
                    className: 'ac-feature-popup error' + config.className
                }).setLatLng(e.latlng)
                    .setContent(
                        'There was an error requesting the data. ' +
                            'Please check that the display fields are exact matches of column names on this dataset.'
                    ).openOn(map);
            });
        }
    },
    processAdditionalDatasetConfig: function (datasetLayer, config, map) {
        if (config.popup) {
            L.modeify.utils.processPopupDatasetConfig(
                datasetLayer,
                config.popup,
                map
            );
        }

        return datasetLayer;
    },
    processPopupDatasetConfig: function (datasetLayer, popupConfig, map) {
        var name = datasetLayer.options.datasetData.name;

        if (!map.utfGrids) {
            map.utfGrids = {};
        }

        map.on('overlayadd', function (e) {
            map.utfGrids[name] = new L.UtfGrid(
                e.layer.options.datasetData.tiles + '/{z}/{x}/{y}.json' +
                    L.modeify.auth.getTokenParam(),
                {
                    useJsonP: false,
                    minZoom: 0,
                    maxZoom: 20,
                    datasetData: e.layer.options.datasetData
                }
            );

            map.utfGrids[name].on('click', function (e) {
                if (popupConfig.overrideCallback) {
                    popupConfig.overrideCallback(e, map);
                } else {
                    L.modeify.utils.showPopup(e, popupConfig, map);
                }

                if (popupConfig.additionalCallback) {
                    popupConfig.additionalCallback(e, map);
                }
            });

            map.addLayer(map.utfGrids[name]);
        });

        map.on('overlayremove', function (e) {
            map.removeLayer(map.utfGrids[name]);
            delete map.utfGrids[name];
        });
    },

};

/**
 * AmigoCloud marker definition
 * @type {{icon: marker.icon}}
 */
var marker = {
    icon: function (fp, options) {
        var sizes, size, symbol, color;

        fp = fp || {};

        sizes = {
            small: [20, 50],
            medium: [30, 70],
            large: [35, 90]
        };
        size = fp['marker-size'] || 'medium';
        symbol = ('marker-symbol' in fp && fp['marker-symbol'] !== '') ?
            '-' + fp['marker-symbol'] : '';
        color = (fp['marker-color'] || '7e7e7e').replace('#', '');

        return L.icon({
            iconUrl: url('/marker/' +
                         'pin-' + size.charAt(0) + symbol + '+' + color +
                         // detect and use retina markers, which are x2 resolution
                         (L.Browser.retina ? '@2x' : '') + '.png', options && options.accessToken),
            iconSize: sizes[size],
            iconAnchor: [sizes[size][0] / 2, sizes[size][1] / 2],
            popupAnchor: [0, -sizes[size][1] / 2]
        });
    }
};

/**
 * AmigoCloud featureLayer construction
 * @type {L.featureGroup}
 */
var featureLayer = L.featureGroup;

/**
 * AmigoCloud realtime construction
 * @type {{authenticate: realtime.authenticate, emit: realtime.emit, on: realtime.on, setAccessToken: realtime.setAccessToken, connectDatasetById: realtime.connectDatasetById, connectDatasetByUrl: realtime.connectDatasetByUrl, startListening: realtime.startListening}}
 */
/*
var realtime = {
    authenticate: function (userId, websocketSession, extra) {
        var data = {
            'userid' : userId,
            'websocket_session': websocketSession
        };

        for (var attr in extra) {
            data[attr] = extra[attr];
        }

        this.socket.emit('authenticate', data);
    },
    emit: function (eventName, data, callback) {
        var _this = this;
        this.socket.emit(eventName, data, function () {
            var args = arguments;
            if (callback) {
                callback.apply(_this.socket, args);
            }
        });
    },
    on: function (eventName, callback) {
        this.socket.on(eventName, callback);
    },
    setAccessToken: function (token) {
        this.token = token;
    },
    connectDatasetById: function (userId, projectId, datasetId) {
        this.userId = userId;
        this.projectId = projectId;
        this.datasetId = datasetId;

        this.startListening(
            L.modeify.constants.baseUrl + L.modeify.constants.apiUrl +
                '/users/' + userId +
                '/projects/' + projectId +
                '/datasets/' + datasetId +
                '/start_websocket_session'
        );
    },
    connectDatasetByUrl: function (url) {
        var tokens;

        if (url.indexOf('start_websocket_session') === -1) {
            url += '/start_websocket_session';
        }

        tokens = url.split('/');

        this.userId = tokens[tokens.indexOf('users') + 1];
        this.projectId = tokens[tokens.indexOf('projects') + 1];
        this.datasetId = tokens[tokens.indexOf('datasets') + 1];

        this.startListening(url);
    },
    startListening: function (url) {
        var _this = this,
            get = L.modeify.utils.get,
            constants = L.modeify.constants;

        get(constants.baseUrl + constants.apiUrl +
            '/me?token=' + this.token + '&format=json').
            then(function (meData) {
                _this.userId = parseInt(meData.id);
                get(url + '?token=' + _this.token + '&format=json').
                    then(function (data) {
                        _this.authenticate(
                            parseInt(_this.userId),
                            data.websocket_session,
                            {
                                datasetid: parseInt(_this.datasetId)
                            }
                        );
                    });
            });
    }
};
*/

/**
 * AmigoCloud events construction
 * @type {{token: string, socket, authenticate: events.authenticate, emit: events.emit, on: events.on, startListening: events.startListening}}
 */
/*
var events = {
    token: '',
    // socket: io.connect(constants.socketServerUrl, {port: 443}),
    authenticate: function () {
        var data = {
            'userid' : this.userId,
            'websocket_session': this.websocketSession
        };

        this.socket.emit('authenticate', data);
    },
    emit: function (eventName, data, callback) {
        var _this = this;
        this.socket.emit(eventName, data, function () {
            var args = arguments;
            if (callback) {
                callback.apply(_this.socket, args);
            }
        });
    },
    on: function (eventName, callback) {
        this.socket.on(eventName, callback);
    },
    startListening: function () {
        var _this = this,
            get = L.modeify.utils.get,
            constants = L.modeify.constants,
            auth = L.modeify.auth;

        _this.token = auth.getToken();
        get(constants.baseUrl + constants.apiUrl + '/me').
            then(function (meData) {
                _this.userId = parseInt(meData.id);
                get(meData.start_websocket_session).
                    then(function (data) {
                        _this.websocketSession = data.websocket_session;
                        _this.authenticate();
                    });
            });
    }
};
*/

/**
 * @method L.Map.extend() creates the AmigoCloud base map
 *
var map = L.Map.extend({
    initialize: function (element, options) {
        var layersControl, initialLayer = [];

        options.loadAGoogleLayers =
            (options.loadGoogleLayers === undefined) ? true :
                options.loadGoogleLayers;

        layersControl = this.buildGoogleLayers(options.loadGoogleLayers);
        if (options.loadGoogleLayers) {
            initialLayer = L.modeify.GoogleRoadmap;
        }

        L.Map.prototype.initialize.call(
            this,
            element,
            L.extend(
                L.Map.prototype.options,
                L.extend(
                    {},
                    options,
                    {
                        // layers: initialLayer
                    }
                )
            )
        );

        initialLayer.addTo(this);

        // layersControl.addTo(this);

        if (!this.options.center) {
            this.setView([0.0, 0.0], 10);
        }
    },

    buildGoogleLayers: function (loadGoogleLayers) {
        this.systemLayers = {};
        this.baseLayers = {};
        this.datasetLayers = {};

        var trafficMutant = L.gridLayer.googleMutant({
            maxZoom: 24,
            type:'roadmap'
        });
        trafficMutant.addGoogleLayer('TrafficLayer');

        layersControl = L.control.layers({
            Roadmap: L.modeify.GoogleRoadmap,
            Aerial: L.modeify.GoogleSatellite,
            Terrain: L.modeify.GoogleTerrain,
            Hybrid: L.modeify.GoogleHybrid,
            Traffic: trafficMutant
        }, {}, {
            collapsed: false
        });

        return layersControl;
    }

});

 *
 **/


/**
 * Modeify map container with layers
 * @type {{map, marker: {icon: marker.icon}, featureLayer: L.featureGroup, constants: {amigoLayersData: *[], baseUrl: string, socketServerUrl: string, amigoLogoUrl: string, apiUrl: string}, utils: {parseUrl: utils.parseUrl, http: utils.http, me: utils.me, get: utils.get, post: utils.post, params: utils.params, buildPopupHTML: utils.buildPopupHTML, buildPopupQuery: utils.buildPopupQuery, showPopup: utils.showPopup, processAdditionalDatasetConfig: utils.processAdditionalDatasetConfig, processPopupDatasetConfig: utils.processPopupDatasetConfig}, auth: {setToken: auth.setToken, getToken: auth.getToken, getTokenParam: auth.getTokenParam}, realtime: {authenticate: realtime.authenticate, emit: realtime.emit, on: realtime.on, setAccessToken: realtime.setAccessToken, connectDatasetById: realtime.connectDatasetById, connectDatasetByUrl: realtime.connectDatasetByUrl, startListening: realtime.startListening}, events: {token: string, socket, authenticate: events.authenticate, emit: events.emit, on: events.on, startListening: events.startListening}, GoogleRoadmap, GoogleSatellite, GoogleTerrain, GoogleHybrid, GoogleTraffic: *, version: string}}
 */
L.modeify = {
    map: {},
    marker: marker,
    // featureLayer: featureLayer,
    constants: constants,
    utils: utils,
    auth: auth,
    // realtime: realtime,
    // events: events,
    // GoogleRoadmap: L.gridLayer.googleMutant({
    //     maxZoom: 24,
    //     type:'roadmap',
    //     name: 'Roadmap'
    // }),
    // GoogleSatellite: L.gridLayer.googleMutant({
    //     maxZoom: 24,
    //     type:'satellite',
    //     name: 'Satellite'
    // }),
    // GoogleTerrain: L.gridLayer.googleMutant({
    //     maxZoom: 24,
    //     type:'terrain',
    //     name: 'Terrain'
    // }),
    // GoogleHybrid: L.gridLayer.googleMutant({
    //     maxZoom: 24,
    //     type:'hybrid',
    //     name: 'Hybrid'
    // }),
    version: '1.0.3'
};


