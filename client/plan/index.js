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
    from: '',
    from_valid: false,
    loading: true,
    options: [],
    dataplan: [],
    query: new ProfileQuery(),
    scorer: new ProfileScorer(),
    arriveBy: false,
    date: moment().format('MM:DD:YYYY'),
    hour: moment().hour(),
    minute: moment().minute(),
    to: '',
    to_valid: false,
    train: true,
    walk: true,
    fast: false,
    safe: true,
    flat: true
  }))
  .attr('bike')
  .attr('bikeShare')
  .attr('bus')
  .attr('car')
  .attr('parkRide')
  .attr('days')
  .attr('from')
  .attr('from_id')
  .attr('from_ll')
  .attr('from_valid')
  .attr('loading')
  .attr('journey')
  .attr('options')
  .attr('query')
  .attr('scorer')
  .attr('arriveBy')
  .attr('date')
  .attr('hour')
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


Plan.on('change hour', function(plan, val, prev) {
  // window.console.log('"change hour" event fired', {'val':val, 'prev':prev})
});
Plan.on('change minute', function(plan, val, prev) {
  // window.console.log('"change minute" event fired', {'val':val, 'prev':prev})
});
Plan.on('change arriveBy', function(plan, val, prev) {
  // window.console.log('"change arriveBy" event fired', {'val':val, 'prev':prev})
});

/**
 * Update routes. Restrict to once every 25ms.
 */

Plan.prototype.updateRoutes = debounce(function(opts, callback) {

  // Removed: this is too aggressive in preventing duplicate searches, should find a different way to do this.
  // check if we've already done the search for these from/to pairs and for the same time
  //if (this.attrs.from_ll && this.attrs.to_ll && this.dataplan){
  //  var current_fromto = [this.attrs.from_ll.lat + ',' + this.attrs.from_ll.lng, this.attrs.to_ll.lat + ',' + this.attrs.to_ll.lng]
  //  var previous_fromto = [this.dataplan.requestParameters.fromPlace, this.dataplan.requestParameters.toPlace]
  //  if (current_fromto[0] === previous_fromto[0] && current_fromto[1] === previous_fromto[1]){
  //    var this_date_raw = this.attrs.date.split(':').concat([ this.attrs.hour, this.attrs.minute])
  //    var this_date = new Date(this_date_raw[2], this_date_raw[0]-1, this_date_raw[1]).setHours(this_date_raw[3], this_date_raw[4])
  //    if (this_date === this.dataplan.plan.date){
  //      console.log('nope');
  //      return;
  //    }
  //  }
  //}

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
  var isCoordinate = false;
  var c = null;
  var places_id = null;
  var physical_addr = null;
  console.log('setAddress:' + address);
  if (address instanceof Object){
    console.log('address instanceof Object');
    console.log(Object(address));
    physical_addr = address['physical_addr'] || null
    places_id = address['places_id'] || null
    c = (physical_addr || '').split(',')
  } else {
    c = address.split(',');
  }
  console.log('c: '+c);
  
  isCoordinate = c.length === 2 && !isNaN(parseFloat(c[0])) && !isNaN(parseFloat(c[1]));

  if (!address || address.length < 1) return callback();

  if (isCoordinate) {
    var callbackGoogle = function (err, reverse) {
      var changes = {};
      if (reverse) {
        var geocode_features = reverse.features;
        changes[name] = name;
        if (isCoordinate) {
          if (!(extra === undefined)) {
            changes[name] = extra.properties.label;
          } else {
            changes[name] = geocode_features[0].properties.label;
          }
        } else {
          if (!(extra === undefined)) {
            changes[name] = extra.properties.label;
          } else {
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
    geocode.reverseGoogle(c, callbackGoogle);
  } else if (places_id !== null){
    // it's already got the placesId, so just do the lookup
    // this happens when the user clicks on one of the suggestions
    // or hits enter in the from/to textbox
    console.log('Looking up the Google Places details for place_id='+places_id+'')
    var cb_google_places =  function(err, place){
      console.log('Places ID callback', place)
      if (place){
        console.log(Object(place));
        var lat_lng = place.geometry.location.lat()+','+place.geometry.location.lng();
        var changes = {};
        // if (place['types'][0] === "street_address" || place['types'][0] === "route" || place['types'][0] === "establishment"){
          changes[name] = place['formatted_address'];
        // } else {
        //   changes[name] = place['name'] + ', ' + place['formatted_address'];
        // }
        changes[name + '_ll'] = {lat: parseFloat(place.geometry.location.lat()), lng: parseFloat(place.geometry.location.lng())};
        changes[name + '_id'] = place.place_id;
        changes[name + '_valid'] = true;
        plan.set(changes);
        callback(null, extra);
      } else {
        console.log('no ejecuta nada', {'err':err,'suggestions':suggestions})
        plan.setAddress('', '', callback);
      }
    }
    geocode.lookupPlaceId(places_id, cb_google_places);
  } else {
    // it's whole or part of a physical address/place name
    // this happens when opening a link to Trip Planner which has addresses already in place


    // this works, but gives partially incomplete results sometimes.
    // seems it's better to use the first result of the autocomplete
    //var cb_Google =  function(err, suggestions){
    //  if (suggestions && suggestions.length > 0){
    //    var changes = {};
    //    changes[name + '_ll'] = {lat: suggestions[0].geometry.location.lat, lng: suggestions[0].geometry.location.lng};
    //    changes[name + '_id'] = suggestions[0].place_id;
    //    changes[name + '_valid'] = true;
    //    plan.set(changes);
    //    callback(null, extra);
    //  } else {
    //    console.log('no ejecuta nada', {'err':err,'suggestions':suggestions})
    //    plan.setAddress('', '', callback);
    //  }
    //}
    //geocode.geocode(address, cb_Google);

    var autocompleteCallback = function(err, suggestions, query_text) {
      console.log('autocompleteCallback', err, suggestions, query_text)
      if (err) {
        log.error('%e', err);
      } else {
        if (suggestions && suggestions.length > 0) {
          var item_suggestion = suggestions[0];
          var suggestion_obj = {
            "physical_addr": item_suggestion['formatted_address'],
            "places_id": item_suggestion['place_id']
          };
          plan.setAddress(name, suggestion_obj, callback);
        }
      }
    }
    geocode.suggestGoogle(address, autocompleteCallback);
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
  
  if(this.bus() && this.train()){
    modes.push('TRANSIT')
  }
  else{
    if (this.bus()) modes.push('BUS');
    if (this.train()) {
        modes.push('TRAM')
        modes.push('SUBWAY')
        modes.push('RAIL')
    }    
  }
  if (this.walk()) modes.push('WALK');
  if (this.parkRide()) modes.push('CAR');
  return modes.join(',');
};

/**
 * Set modes from string
 */

Plan.prototype.setModes = function(csv) {
  if (!csv || csv.length < 1) return;
  var modes = csv.split ? csv.split(',') : csv;
  this.bike(modes.indexOf('BICYCLE') !== -1);
  this.bus(modes.indexOf('BUS') !== -1 || modes.indexOf('TRANSIT') !== -1);
  this.train(modes.indexOf('TRAM') !== -1 || modes.indexOf('TRANSIT') !== -1);
  this.walk(modes.indexOf('WALK') !== -1);
  this.parkRide(modes.indexOf('CAR') !== -1);
};

Plan.prototype.triangulateBikeOptions = function () {
  var opts = [this.flat(), this.safe(), this.fast()];

  var sum = opts.reduce(function(a, b) {
    return Number(a) + Number(b);
  }, 0);

  if (sum === 0) {
    return [0.333, 0.333, 0.334];
  } else {
    var b_triangle = opts.map(function (opt) {
      return opt ? +(1 / sum).toFixed(3) : 0;
    });
    // console.log('bike triangle : ', b_triangle)
    return b_triangle
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

  } 
  if (this.bus() && this.train()){
    modes.push('TRANSIT')
  }else{
    if (this.bus()) {
        modes.push('BUS');
    }
    if (this.train()) {
        modes.push('TRAM');
        modes.push('SUBWAY');
        modes.push('RAIL');
    }
  }

  if (modes.length==0) modes.push('WALK');

  var scorer = this.scorer();
  var arriveBy = this.arriveBy();
  var triangleFactors = this.triangulateBikeOptions();

  // Get correct hour, add minutes and convert to string
  var time = this.hour() + ':' + this.minute()

  return {
    date: this.nextDate(),
    mode: modes.join(','),
      time: time,
      fromPlace: (from.lat + ',' + from.lng),
      toPlace: (to.lat + ',' + to.lng),
      numItineraries: 3,
      maxWalkDistance: 5000,
      bikeSpeed: 4.9,
//      bikeBoardCost: 15,
//      clampInitialWait: 60,
//      bikeBoardCost: 40,
      // walkBoardCost: 30,
      walkReluctance: 0,
     // clampInitialWait: 60,
      maxTransfers: 5,
//      waitAtBeginningFactor: 0.5,
      triangleSlopeFactor: triangleFactors[0],
      triangleSafetyFactor: triangleFactors[1],
      ///triangleTimeFactor : triangleFactors[2],
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
    days: this.days(),
    arriveBy : this.arriveBy(),
    date: this.date(),
    hour: this.hour(),
    minute: this.minute(),
    fast: Boolean(this.fast()),
    safe: Boolean(this.safe()),
    flat: Boolean(this.flat())
  });
};
