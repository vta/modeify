/**
 * Seconds to minutes
 */

exports.secondsToMinutes = function(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  sec = sec < 10 ? '0' + sec : sec;
  return m + ':' + sec;
};


/**
 * Meters to MPH
*/
exports.metersToMph = function(meters)
{
  return meters * 2.23694;
};

/* This will take meters/s and distance
 * and will return an estimated arrival time
 * based on the two variables
 * @param: speed: double : speed of mode in meters
 * @param: distance: double : distance in meters for step
*/
exports.metersToTime = function(distance, speed)
{
  // time is generated into seconds
  var time = distance / speed;
  return exports.secondsToHms(time);
};
/* This will be used when converting seconds
 * To hours, minutes, or maintaing seconds if under 60
 * If there are hours, minutes, and seconds they will be added together
 * @param : t(time) : number : seconds for the ETA based on distance / speed
*/
exports.secondsToHms = function(t)
{
    t = Number(t);
    var h = Math.floor(t / 3600);
    var m = Math.floor(t % 3600 / 60);
    var s = Math.floor(t % 3600 % 60);
    // add all possible times together - hr + min +_sec
    // make plural if more or less than 1
    var hs = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var ms = m > 0 ? m + (m == 1 ? " min, " : " mins, ") : "";
    var ss = s > 0 ? s + (s == 1 ? " sec" : " secs") : "";
    var a = hs + ms + ss;
    // only show one untill more room is provided on sidebar
    // ex : 25m instead of 1hr, 25m, 35s
    // only show biggest time ex: hr first
    return a.split(",")[0] + " - "; 
};

/**
 * Meters to miles
 */

exports.metersToMiles = function(meters) 
{
  return milesToString(meters * 0.000621371);
};

/*
 * Convert meters to miles
 * if meters are under 300 convert to feet
*/
exports.metersToAny = function(meters)
{
  if (meters > 335.28)
  {
    // return 1 decimal point for miles
    return Math.round(meters * 0.000621371 * 10) / 10 + " mi";
  }
  // convert to feet if less than 0.2 mile
  else if (meters < 335.28)
  {
    return parseInt(meters * 3.28084) + " ft";
  }
};


/**
 * MPH to m/s
 */

exports.mphToMps = function(mph) {
  return mph * 0.44704;
};

/**
 * Calories to pounds
 */

exports.caloriesToPounds = function(cals) {
  return cals / 3500;
};

/**
 * Number to short string
 */

exports.roundNumberToString = function(n) {
  if (n > 1000) {
    return toFixed(n, 0).toLocaleString();
  } else if (n > 100) {
    return Math.round(n);
  } else if (n > 10) {
    return toFixed(n, 1);
  } else if (n > 1) {
    return toFixed(n, 2);
  }
};

/**
 * Miles to CO2 tonnage
 */

exports.milesToCO2 = function(m) {

};

/**
 * Expose `toFixed`
 */

exports.toFixed = toFixed;

/**
 * To fixed without trailing zero
 */

function toFixed(n, f) {
  var m = Math.pow(10, f);
  return ((n * m) | 0) / m;
}

/**
 * Expose `milesToString`
 */

exports.milesToString = milesToString;

/**
 * Miles to string
 */

function milesToString(miles) 
{
  if (miles > 10) 
  {
    return miles.toFixed(0) + " mi";
  } 
  else if (miles > 0.1)
  {
    return ((miles * 10) | 0) / 10 + " mi";
  }
  // convert to feet instead
  else if (miles < 0.1 && miles > 0)
  {
    return parseInt(miles * 5280) + " ft";
  }
  else return 0;
}



exports.dateToHumanTime = function (date){
  var hh = date.getHours() % 12 === 0 ? '12' : (date.getHours() % 12);
  var mm = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()
  var ampm = date.getHours() > 11 ? 'PM' : 'AM'
  return hh + ':' + mm + ampm;
}

/**
 * TODO: this should be aliased in CSS
 */

exports.modeToIcon = function(m) {
  m = m || '';
  m = m.toLowerCase();
  switch (m) {
    case 'bicycle':
      return 'bike';
    case 'pedestrian':
      return 'walk';
    case 'rail':
    case 'subway':
    case 'tram':
      return 'train';
    case 'bicycle_rent':
      return 'cabi';
    default:
      return m;
  }
};

/**
 * Route to color converter
 */

exports.routeToColor = function(type, agency, line, color) {
  if (agency === 'dc') {
    if (type === 1 || type === 'TRANSIT') return colors[line];
    return colors.metrobus;
  }

  if (colors[agency] || color)
    return colors[agency] || '#' + color;

  return '#333';
};

/**
 * Predefined Transit Colors
 */

var colors = {
  '1': '#55b848', // ART TODO: Dont have hacky agency
  'agency#1': '#55b848', // ART
  'agency#3': '#2c9f4b', // Maryland Commute Bus
  art: '#55b848',
  blue: '#0076bf',
  cabi: '#d02228',
  'fairfax connector': '#ffff43',
  green: '#00a84f',
  mcro: '#355997',
  metrobus: '#173964',
  orange: '#f7931d',
  prtc: '#5398a0',
  red: '#e21836',
  silver: '#a0a2a0',
  yellow: '#ffd200'
};

/*
  ART green #55b848
  Maryland green #2c9f4b
  Montgomery blue #355997
  Potomac blue #5398a0
  Fairfax yellow #faff4c
  Fairfax yellow type #c9b80d
  VRE red #de003a
  VRE blue #255393

  Metrobus #173964
  CaBI #d02228
  Metro Red #e21836
  Metro Orange #f7931d
  Metro Silver #a0a2a0
  Metro Blue #0076bf
  Metro Yellow #ffd200
  Metro Green #00a84f
*/
