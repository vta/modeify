var convert = require('convert');
var model = require('model');
var defaults = require('model-defaults');
var session = require('session');
var each = require('each');
var Modes;
/**
 * MPS to MPH
 */

var MPS_TO_MPH = 2.23694;

/**
 * Expose `Route`
 */

var Route = module.exports = model('Route')
  .use(defaults({
    costPenalty: false,
    costSavings: false,
    modes: [],
    timeSavings: false,
    transit: [],
    weightLost: false
  }))
  .attr('id')
  .attr('access')
  .attr('bikeCalories')
  .attr('bikeDistance')
  .attr('bikeTime')
  .attr('calories')
  .attr('cost')
  .attr('costPenalty')
  .attr('costSavings')
  .attr('driveDistance')
  .attr('egress')
  .attr('emissions')
  .attr('emissionsDifference')
  .attr('hasTransit')
  .attr('modes')
  .attr('score')
  .attr('stats')
  .attr('summary')
  .attr('time')
  .attr('timeInTransit')
  .attr('timeSavings')
  .attr('transfers')
  .attr('transitCost')
  .attr('transit')
  .attr('trips')
  .attr('walkCalories')
  .attr('walkDistance')
  .attr('walkTime')
  .attr('weightLost')
  .attr('plan');

/**
 * Changes to emit on rescore
 */

var emitAfterRescore = ['average', 'bikeTime', 'calculatedCost', 'totalCalories', 'transitCosts', 'tripsPerYear',
  'carParkingCost', 'vmtRate', 'walkTime'
];

/**
 * Update scoring
 */

Route.prototype.rescore = function(scorer) {
  var data = scorer.processOption(this.toJSON());

  for (var i in data) {
    if (this.hasOwnProperty(i) && i !== 'transitCost') {
      this[i](data[i]);
    }
  }

  for (i in emitAfterRescore) {
    var attr = emitAfterRescore[i];
    this.emit('change ' + attr, this[attr]());
  }
};

/**
 * Set car data
 */

Route.prototype.setCarData = function(data) {
  var m = this.tripm();

  var costDifference = data.cost * m - this.cost() * m;
  var emissions = (data.emissions - this.emissions()) / data.emissions * 100;
  var timeSavings = (this.timeInTransit() - (data.time - this.time())) * m;

  if (this.directCar()) {
    costDifference = data.cost * m / 2;
    emissions = 50;
    timeSavings = this.average() * m / 2; // Assume split driving
  }

  if (costDifference > 0) {
    this.costSavings(costDifference);
  }

  if (this.calories() !== 0) {
    this.weightLost(parseInt(convert.caloriesToPounds(this.calories()) * m, 10));
  }

  if (timeSavings > 60) {
    this.timeSavings(parseInt(timeSavings / 60 / 60, 10));
  }

  if (emissions > 0) {
    this.emissionsDifference(parseInt(emissions, 10));
  }
};

/**
 * Direct car?
 */

Route.prototype.directCar = function() {
  return this.modes().length === 1 && this.hasCar();
};

/**
 * Is this a direct bike or walk journey?
 */

Route.prototype.directBikeOrWalk = function() {
  return !this.hasTransit() && !this.hasCar();
};



Route.prototype.isMobile = function() {
  if (!L.Browser.mobile)
  {
    return true;
  }
};

/**
 * Average trip length in minutes
 */

Route.prototype.average = function() {
    return Math.round(this.plan().duration / 60);
  if (this.hasTransit() || !this.hasCar()) {
    return Math.round(this.time() / 60);
  } else {
    return Math.round(this.time() / 60 * 1.35);
  }
};

/**
 * Freeflow
 */

Route.prototype.freeflowTime = function() {
  if (this.hasTransit() || !this.hasCar()) {
    return false;
  } else {
    return Math.round(this.time() / 60);
  }
};

Route.prototype.planStartTime = function(){
  var d = new Date(this.plan().startTime)
  return convert.dateToHumanTime(d)
}

Route.prototype.planEndTime = function(){
  var d = new Date(this.plan().endTime)
  return convert.dateToHumanTime(d)
}

/**
 * Time in transit
 */

/*Route.prototype.timeInTransit = function() {
  if (!this.hasTransit()) {
    return 0;
  } else {
    return this.transit().reduce(function(m, t) {
      return m + t.waitStats.avg + t.rideStats.avg;
    }, 0) / 60;
  }
};
*/
/**
 * Shorthand helpers
 */

Route.prototype.hasCost = function() {
  return this.cost() > 0;
};

Route.prototype.hasCar = function() {
    return findKeyValuePair(this.plan().legs, 'mode', 'CAR');
  return this.modes().indexOf('car') !== -1;
};

Route.prototype.hasTransit = function() {
  return this.transit().length > 0;
};

Route.prototype.hasBiking = function() {
    return findKeyValuePair(this.plan().legs, 'mode', 'BICYCLE') ||
	findKeyValuePair(this.plan().legs, 'mode', 'BICYCLE_RENT');
  return this.modes().indexOf('bicycle') !== -1 || this.modes().indexOf('bicycle_rent') !== -1;
};

Route.prototype.hasWalking = function() {
    return findKeyValuePair(this.plan().legs, 'mode', 'WALK');
  return this.modes().indexOf('walk') !== -1;
};

/**
 * Days
 */

Route.prototype.tripsPerYear = function() {
  return session.plan().tripsPerYear();
};

/**
 * Trip multiplier
 */

Route.prototype.tripm = function() {
  return session.plan().tripsPerYear();
};

/**
 * Cost
 */

Route.prototype.calculatedCost = function() {
  if (this.cost() === 0) {
    return false;
  }

  var cost = 0;
  if (this.transitCost()) {
    cost += this.transitCost();
  }
  if (this.hasCar()) {
    cost += this.vmtRate() * this.driveDistances();
    cost += this.carParkingCost();
  }

  var total = cost * this.tripm();
  if (total > 100) {
    return parseInt(total, 10);
  } else {
    return total.toFixed(2);
  }
};

/**
 * Transit Cost
 */

Route.prototype.transitCosts = function() {
  if (!this.transitCost()) {
    return false;
  } else {
    return this.transitCost().toFixed(2);
  }
};

/**
 * Total Calories
 */

Route.prototype.totalCalories = function() {
  if (this.walkDistances() === 0 && this.bikeDistances() === 0) return 0;

//  var cals = walkingCaloriesBurned(this.walkSpeed(), this.weight(), this.walkDistances() / this.walkSpeed() / 60 / 60);
  var cals = walkingCaloriesBurned(this.walkSpeed(), this.weight(), this.walkDistances() / this.walkSpeed());
  if (this.hasBiking()) {
//    cals += bikingCaloriesBurned(this.bikeSpeed(), this.weight(), this.bikeDistances() / this.bikeSpeed() / 60 / 60);
    cals += bikingCaloriesBurned(this.bikeSpeed(), this.weight(), this.bikeDistances() / this.bikeSpeed());
  }

  return Math.round(cals);
};

/**
 * Walk/Bike distances rounded
 */

Route.prototype.driveDistances = function() 
{
  return this.distances('car', 'driveDistance');
};

Route.prototype.bikeDistances = function() 
{
    var legs = this.plan().legs;
    var distance = 0;
    for (var i = 0; i < legs.length; i++) 
    {
        if (legs[i].mode === 'BICYCLE') 
        {
          distance += legs[i].distance;
        }
    }
    return convert.metersToMiles(distance);
  return this.distances('bicycle', 'bikeDistance') || this.distances('bicycle_rent', 'bikeDistance');
};

Route.prototype.walkDistances = function() 
{

    var legs = this.plan().legs;
    var distance = 0;
    var modes = [];
    for (var i = 0; i < legs.length; i++) 
    {
        modes.push(legs[i].mode);
        if (legs[i].mode === 'WALK') 
        {
          distance += legs[i].distance;
        }
    }
    Modes = modes;
    // substring to search for within array
    var sub = "BICYCLE";
    // if the mode does not include biking - display walk distance
    if (modes.indexOf(sub) == -1) return convert.metersToMiles(distance);
  if (modes.indexOf(sub) == -1) return this.distances('walk', 'walkDistance');
};

Route.prototype.distances = function(mode, val) 
{
  if (this.modes().indexOf(mode) === -1) 
  {
    return false;
  } 
  else 
  {
    return convert.metersToMiles(this[val]());
  }
};

/**
 * Walk/bike speed in MPH
 */

Route.prototype.bikeSpeedMph = function() {
  return toFixed(this.bikeSpeed() * MPS_TO_MPH, 1);
};

Route.prototype.walkSpeedMph = function() {
  return toFixed(this.walkSpeed() * MPS_TO_MPH, 1);
};

/**
 * Walk/bike time in minutes
 */

Route.prototype.bikeTime = function() {
  if (Modes.length > 1) return "/ about " + convert.metersToTime(this.bikeDistance(), this.bikeSpeed()).replace(" - ", "");
};

Route.prototype.walkTime = function() {
  if (Modes.length > 1) return "/ about " + convert.metersToTime(this.walkDistance(), this.walkSpeed()).replace(" - ", "");
};

function timeFromSpeedAndDistance(s, d) {
  var t = d / s;
  if (t < 60) {
    return '< 1';
  } else {
    return parseInt(t / 60, 10);
  }
}

/**
 * Retrieve from scorer
 */

Route.prototype.bikeSpeed = function() {
  return session.plan().scorer().rates.bikeSpeed;
};

Route.prototype.walkSpeed = function() {
  return session.plan().scorer().rates.walkSpeed;
};

Route.prototype.vmtRate = function() {
  return session.plan().scorer().rates.mileageRate;
};

Route.prototype.weight = function() {
  return session.plan().scorer().rates.weight;
};

Route.prototype.carParkingCost = function() {
  return session.plan().scorer().rates.carParkingCost;
};

/**
 * Construct a simple mode-based descriptor (e.g. "Drive to Transit")
 */

Route.prototype.modeDescriptor = function() {
  var modeStr = '';
  var accessMode = this.plan().legs[0].mode.toLowerCase();//this.access()[0].mode.toLowerCase();
//  var egressMode = this.egress() ? this.egress()[0].mode.toLowerCase() : false;
  var modes = this.modes();

  switch (accessMode) {
    case 'bicycle_rent':
      modeStr = 'bikeshare';
      break;
    case 'bicycle':
      modeStr = 'bike';
      break;
    case 'car':
      if (this.hasTransit()) {
        modeStr = 'drive';
      } else {
        modeStr = 'rideshare';
      }
      break;
    case 'walk':
      if (!this.hasTransit()) {
        modeStr = 'walk';
      }
      break;
  }

    function isTransit(mode) {
        return (mode !== 'WALK' && mode !== 'CAR' && mode !== 'BICYCLE');
    }

    function hasTransit(legs) {
	for (var i = 0; i < legs.length; i++) {
	    if (isTransit(legs[i])) {
		return true;
	    }
	}
	return false;
    };

  if (hasTransit(this.plan().legs)) {
    if (modeStr.length > 0) modeStr += ' to ';
    modeStr += 'transit';
  }

/*  if (egressMode && egressMode !== 'walk') {
    modeStr += ' to ';
    switch (egressMode) {
      case 'bicycle_rent':
        modeStr += 'bikeshare';
        break;
    }
  }
*/
  return modeStr;
};

/**
 * Walking Calories
 *
 * CB = [0.0215 x KPH3 - 0.1765 x KPH2 + 0.8710 x KPH + 1.4577] x WKG x T
 * http://www.shapesense.com/fitness-exercise/calculators/walking-calorie-burn-calculator.aspx
 */

function walkingCaloriesBurned(mps, wkg, hours) {
  var kph = mps / 1000 * 60 * 60;
  var kph2 = kph * kph;
  var kph3 = kph2 * kph;
  return (0.0215 * kph3 - 0.1765 * kph2 + 0.8710 * kph) * wkg * hours;
}

/**
 * Biking Calories
 *
 * http://en.wikipedia.org/wiki/Bicycle_performance
 */

var GRADE = 1;
var GRAVITY = 9.8;
var K1 = 0.0053; // frictional losses
var K2 = 0.185; // aerodynamic drag
var WATTS_TO_CALS_PER_SECOND = 0.2388;

function bikingCaloriesBurnedOld(mps, wkg, hours) {
  var mps3 = Math.pow(mps, 3);
  var seconds = hours * 60 * 60;
  var watts = GRAVITY * wkg * mps * (K1 + GRADE) + K2 * mps3;
  return watts * WATTS_TO_CALS_PER_SECOND * seconds;
}

function bikingCaloriesBurned(mps, wkg, hours) {
  return 8 * wkg * hours;
}

function toFixed(n, f) {
  var m = Math.pow(10, f);
  return ((n * m) | 0) / m;
}

/**
 * Tags
 */

Route.prototype.tags = function(plan) {
  var tags = [];

  // add the access mode tags
  each(this.get('access'), function(accessLeg) {
    if (accessLeg.mode === 'bicycle_rent')
      tags.push('bicycle');
    tags.push(accessLeg.mode);
  });

  // add tags for each transit leg
  each(this.transit(), function(transitLeg) {
    tags.push(transitLeg.mode); // add the transit mode tag
    if (transitLeg.routes.length > 0) { //add the agency tag
      tags.push(transitLeg.routes[0].id.split(':')[0]);
    }
  });

  // add a generic 'transit' tag
  if (this.hasTransit()) tags.push('transit');

  // add tags for the from/to locations
  if (plan) {
    var from = locationToTags(plan.from());
    var to = locationToTags(plan.to());
    tags = tags.concat(from).concat(to);
  }

  tags = tags.map(function(tag) {
    return tag.toLowerCase().trim();
  });
  return tags;
};

function locationToTags(location) {
  // strip off the zip code, if present
  var endsWithZip = /\d{5}$/;
  if (endsWithZip.test(location)) {
    location = location.substring(0, location.length - 5);
  }
  return location.split(',').slice(1);
}

function findKeyValuePair(array, key, value) {
    for (var i = 0; i < array.length; i++) {
        if (array[i][key] && array[i][key] === value) {
            return true;
        }
    }
    return false;
};

