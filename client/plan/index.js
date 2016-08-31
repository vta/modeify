var Batch = require('batch');
var debounce = require('debounce');
var geocode = require('geocode');
var Journey = require('journey');

var log = require('./client/log')('plan');
var defaults = require('model-defaults');
var model = require('model');
var ProfileQuery = require('profile-query');
var ProfileScorer = require('otp-profile-score');
var qs = require('querystring');

var loadPlan = require('./load');
var store = require('./store');
var updateRoutes = require('./update-routes');

module.exports.dataplan = [];
/**
 * Debounce updates to once every 50ms
 */

var DEBOUNCE_UPDATES = 5;
var LIMIT = 2;

/**
 * Expose `Plan`
 */

var Plan = module.exports = model('Plan')
  .use(defaults({
    bike: false,
    bikeShare: false,
    bus: true,
    car: false,
    parkRide: false,
    days: 'M—F',
    date: moment().format('MM:DD:YYYY'),
    arriveBy: false,
    end_time: (new Date()).getHours() + 4,
    from: '',
    from_valid: false,
    loading: true,
    options: [],
    dataplan: [],
    query: new ProfileQuery(),
    scorer: new ProfileScorer(),
    start_time: (new Date()).getHours() - 1,
    minute: moment().minute(),
    to: '',
    to_valid: false,
    train: true,
    tripsPerYear: 235,
    walk: true,
    fast: true,
    safe: true,
    flat: true
  }))
  .attr('bike')
  .attr('bikeShare')
  .attr('bus')
  .attr('car')
  .attr('parkRide')
  .attr('days')
  .attr('date')
  .attr('arriveBy')
  .attr('end_time')
  .attr('from')
  .attr('from_id')
  .attr('from_ll')
  .attr('from_valid')
  .attr('loading')
  .attr('journey')
  .attr('options')
  .attr('query')
  .attr('scorer')
  .attr('start_time')
  .attr('minute')
  .attr('to')
  .attr('to_id')
  .attr('to_ll')
  .attr('to_valid')
  .attr('train')
  .attr('tripsPerYear')
  .attr('walk')
  .attr('fast')
  .attr('safe')
  .attr('flat');

/**
 * Expose `load`
 */

module.exports.load = function(ctx, next) {
  loadPlan(Plan, ctx, next);
};

/**
 * Sync plans with sessionStorage
 */

Plan.on('change', function(plan, name, val) {
  log('plan.%s changed to %s', name, val);

  // Store in sessionStorage & track the change
  if (name !== 'options' && name !== 'journey' && name !== 'loading') plan.store();
});

/**
 * Keep start/end times in sync
 */

Plan.on('change start_time', function(plan, val, prev) {
  if (val >= plan.end_time()) plan.end_time(val + 1);
});

Plan.on('change end_time', function(plan, val, prev) {
  if (val <= plan.start_time()) plan.start_time(val - 1);
});

/**
 * Update routes. Restrict to once every 25ms.
 */

Plan.prototype.updateRoutes = debounce(function(opts, callback) {
  updateRoutes(this, opts, callback);
  this.dataplan = updateRoutes.dataplan;
}, DEBOUNCE_UPDATES);

/**
 * Geocode
 */

Plan.prototype.geocode = function(dest, callback) {
  if (!callback) callback = function() {};

  var plan = this;
  var address = plan[dest]();
  var ll = plan[dest + '_ll']();
  if (address && address.length > 0) {
    geocode(address, function(err, ll) {
      if (err) {
        callback(err);
      } else {
        plan[dest + '_ll'](ll);
        callback(null, ll);
      }
    });
  } else {
    callback(null, ll);
  }
};

/**
 * Save Journey
 */

Plan.prototype.saveJourney = function(callback) {
  var opts = {};
  var skipKeys = ['options', 'journey', 'scorer'];
  for (var key in this.attrs) {
    if (skipKeys.indexOf(key) !== -1 || key.indexOf('to') === 0 || key.indexOf('from') === 0) {
      continue;
    }
    opts[key] = this.attrs[key];
  }

  // Create new journey

  var journey = new Journey({
    locations: [{
      _id: this.from_id()
    }, {
      _id: this.to_id()
    }],
    opts: opts
  });

  // Save
  journey.save(callback);
};

/**
 * Valid coordinates
 */

Plan.prototype.validCoordinates = function() {
  return this.coordinateIsValid(this.from_ll()) && this.coordinateIsValid(this.to_ll());
};

/**
 * Set Address
 */

Plan.prototype.setAddress = function(name, address, callback, extra) {
  callback = callback || function() {}; // noop callback
  var plan = this;
  var c = address.split(',');
  var isCoordinate = c.length === 2 && !isNaN(parseFloat(c[0])) && !isNaN(parseFloat(c[1]));

  if (!address || address.length < 1) return callback();

    if (isCoordinate) {

      var callbackAmigo = function (err, reverse) {
        var changes = {};
            if (reverse) {
              var geocode_features = reverse.features;
              changes[name] = name;
              if (isCoordinate) {
                if (!(extra === undefined)) {
                    changes[name] = extra.properties.label;
                }else {
                    changes[name] = geocode_features[0].properties.label;
                }

              }else {
                if (!(extra === undefined)) {
                    changes[name] = extra.properties.label;
                }else {
                    changes[name] = geocode_features[0].properties.label;
                }

              }


              changes[name + '_ll'] = {lat: parseFloat(geocode_features[0].geometry.coordinates[1]), lng: parseFloat(geocode_features[0].geometry.coordinates[0])};
              changes[name + '_id'] = geocode_features[0].properties.id;
              changes[name + '_valid'] = true;

              plan.set(changes);
              callback(null, reverse);

            } else {

              if (isCoordinate) {
                changes[name] = extra.properties.label;
                changes[name + '_ll'] = { lat: parseFloat(c[1]),lng: parseFloat(c[0])};
                changes[name + '_valid'] = true;
                plan.set(changes);
                callback(null, extra);
              } else {
                callback(err);
              }

            }
        };

        geocode.reverseAmigo(c, callbackAmigo);
    }else {
      plan.setAddress('', '', callback);
    }
};

/**
 * Set both addresses
 */

Plan.prototype.setAddresses = function(from, to, callback) {
  // Initialize the default locations
  var plan = this;

  Batch()
    .push(function(done) {
      plan.setAddress('from', from, done);
    })
    .push(function(done) {
      plan.setAddress('to', to, done);
    }).end(callback);
};

/**
 * Rescore Options
 */

Plan.prototype.rescoreOptions = function() {
  var scorer = this.scorer();
  var options = this.options();

  options.forEach(function(o) {
    o.rescore(scorer);
  });

  this.store();
};

/**
 * To Lower Case
 */

function toLowerCase(s) {
  return s ? s.toLowerCase() : '';
}

Plan.prototype.coordinateIsValid = function(c) {
  return !!c && !!parseFloat(c.lat) && !!parseFloat(c.lng) && parseFloat(c.lat) !== 0.0 && parseFloat(c.lng) !== 0.0;
};

/**
 * Modes as a CSV
 */

Plan.prototype.modesCSV = function() {
  var modes = [];
  if (this.bike()) modes.push('BICYCLE');
  if (this.bikeShare()) modes.push('BICYCLE_RENT');
  if (this.bus()) modes.push('BUSISH');
  if (this.train()) modes.push('TRAINISH');
  if (this.walk()) modes.push('WALK');
  if (this.car()) modes.push('CAR');

  return modes.join(',');
};

/**
 * Set modes from string
 */

Plan.prototype.setModes = function(csv) {
  if (!csv || csv.length < 1) return;
  var modes = csv.split ? csv.split(',') : csv;

  this.bike(modes.indexOf('BICYCLE') !== -1);
//  this.bikeShare(modes.indexOf('BICYCLE_RENT') !== -1);
  this.bikeShare(false);
  this.bus(true);
//  this.bus(modes.indexOf('BUSISH') !== -1);
  this.train(modes.indexOf('TRAINISH') !== -1);
  this.car(modes.indexOf('CAR') !== -1);
};

Plan.prototype.triangulateBikeOptions = function () {
  var totalOpts = 0,
      opts = [this.flat(), this.safe(), this.fast()];

  opts.forEach(function (opt) {
    totalOpts += opt ? 1 : 0;
  });

  if (!totalOpts) {
    return [0.333, 0.333, 0.334];
  } else {
    return opts.map(function (opt) {
      return opt ? +(1 / totalOpts).toFixed(3) : 0;
    });
  }
}

/**
 * Generate Query Parameters for this plan
 */

Plan.prototype.generateQuery = function() {
  var from = this.from_ll() || {};
  var to = this.to_ll() || {};

  // Transit modes
  var modes = [];//['WALK'];

  if (this.bikeShare()) {
    modes.push('BICYCLE_RENT');
  }

  if (this.car()) {
    modes.push('CAR');
  }

  if (this.bike()) {
    modes.push('BICYCLE');
  } else {
    modes.push('WALK');
  }

  if (this.parkRide()) {
    modes.push('CAR');
    modes.push('BUSISH');
    modes.push('TRAINISH');
  } else {
    if (this.bus()) {
      modes.push('BUSISH');
    }
    if (this.train()) {
      modes.push('TRAINISH');
    }
  }

  if (modes.length==0) modes.push('WALK');

  var startTime = this.start_time();
  var endTime = this.end_time();
  var scorer = this.scorer();
  var arriveBy = this.arriveBy();
  var triangleFactors = this.triangulateBikeOptions();

  // Get correct hour, add minutes and convert to string
  var time = arriveBy ? endTime : startTime;
  time += ':' + this.minute()

  return {
    date: this.nextDate(),
    mode: modes.join(','),
      time: time,
      fromPlace: (from.lat + ',' + from.lng),
      toPlace: (to.lat + ',' + to.lng),
      numItineraries: 3,
      maxWalkDistance: 5000,
      bikeSpeed: 10,
//      bikeBoardCost: 15,
//      walkReluctance: 10,
//      clampInitialWait: 60,
//      bikeBoardCost: 40,
//      walkBoardCost: 30,
      walkReluctance: 15,
//      clampInitialWait: 60,
      maxTransfers: 5,
//      waitAtBeginningFactor: 0.5,
      triangleSlopeFactor: triangleFactors[0],
      triangleSafetyFactor: triangleFactors[1],
      triangleTimeFactor: (triangleFactors[2] === 0.333) ? triangleFactors[2] + 0.001 : triangleFactors[2], // must add to one
      optimize: 'TRIANGLE',
      arriveBy: arriveBy
  };
};

/**
 * Store in localStorage. Restrict this I/O to once every 25ms.
 */

Plan.prototype.store = debounce(function() {
  store(this);
}, DEBOUNCE_UPDATES);

/**
 * Clear sessionStorage
 */

Plan.prototype.clearStore = store.clear;

/**
 * Save URL
 */

Plan.prototype.saveURL = function() {
  window.history.replaceState(null, '', '/planner?' + this.generateQueryString());
};

/**
 * Get next date for day of the week
 */

Plan.prototype.nextDate = function() {
  var now = new Date();
  var date = now.getDate();
  var dayOfTheWeek = now.getDay();
  switch (this.days()) {
    case 'M—F':
      if (dayOfTheWeek === 0) now.setDate(date + 1);
      if (dayOfTheWeek === 6) now.setDate(date + 2);
      break;
    case 'Sat':
      now.setDate(date + (6 - dayOfTheWeek));
      break;
    case 'Sun':
      now.setDate(date + (7 - dayOfTheWeek));
      break;
  }
  return now.toISOString().split('T')[0];
};

/**
 * Generate `places` for transitive
 */

Plan.prototype.generatePlaces = function() {
  var fll = this.from_ll();
  var tll = this.to_ll();
  if (!fll || !tll) return [];

  return [{
    place_id: 'from',
    place_lat: fll.lat,
    place_lon: fll.lng,
    place_name: 'From'
  }, {
    place_id: 'to',
    place_lat: tll.lat,
    place_lon: tll.lng,
    place_name: 'To'
  }];
};

/**
 * Generate QueryString
 */

Plan.prototype.generateQueryString = function() {
  return qs.stringify({
    from: this.from(),
    to: this.to(),
    modes: this.modesCSV(),
    start_time: this.start_time(),
    end_time: this.end_time(),
    days: this.days(),
    date: this.date(),
    minute: this.minute()
  });
};
