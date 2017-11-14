var convert = require('convert');
var hogan = require('hogan.js');
var session = require('session');
var toSentenceCase = require('to-sentence-case');
var view = require('view');
var mode_speed = "";
var rowTemplate = require('./row.html');
var template = require('./template.html');

var row = hogan.compile(rowTemplate);

var View = module.exports = view(template);

/**
 * To/from
 */

View.prototype.from = function() {
  return session.plan().from().split(',')[0];
};
View.prototype.to = function() {
  return session.plan().to().split(',')[0];
};


function set_mode_speed(speed)
{
  mode_speed = speed;
}
function get_mode_speed()
{
  return mode_speed;
}


/**
 * Details, details
 */

View.prototype.directions = function() 
{
    var legs = this.model.plan().legs;
    var i = 0;
  //  var access = this.model.access()[0];
  //  var egress = this.model.egress();
  //  var segments = this.model.transit();
  //  var length = segments.length;
  var details = '';

  // Add a detail
  function addDetail(d) 
  {
    details += row.render(d);
  }
  // @param : string
  // @return : true : mode == "TRANSIT"
  function isTransit(mode) 
  {
      return (mode !== 'WALK' && mode !== 'CAR' && mode !== 'BICYCLE');
  }

  function sstimes(leg)
  {
    var res = ['<div class="start_stop_times"><span>'];
    res.push(convert.dateToHumanTime(new Date(leg.startTime)))
    res.push('</span> - <span>');
    res.push(convert.dateToHumanTime(new Date(leg.endTime)))
    res.push('</span></div>');
    return res.join('');
  }
  
  if (!isTransit(legs[0].mode)) 
  {
	  details += narrativeDirectionsForSteps(legs[i].steps, legs[0].mode);
	  i++;
  }

  var lastColor = null;
  for (var i = 1; i < legs.length; ) 
  {
    var leg = legs[i];
    var fromName = leg.from.name;
    var color = '#000';

    if (!isTransit(leg.mode)) 
    {
      details += narrativeDirectionsForSteps(legs[i].steps, legs[i].mode);
            
      if ((i + 1) < legs.length && isTransit(legs[i + 1].mode)) 
      {
        i++;

        addDetail(
        {
            color: color,
            description: strong(legs[i].from.name),
            transfer: 'transfer board'
        });

        addDetail({
            color: color,
            description: 'Take ' + (legs[i].routeShortName || legs[i].routeLongName) + sstimes(legs[i]),
            segment: true
        });

        addDetail({
            color: color,
            description: strong(legs[i].to.name),
            transfer: 'transfer alight'
        });
      }
    } 
    else 
    {
      addDetail(
      {
          color: color,
          description: strong(legs[i].from.name),
          transfer: 'transfer board'
      });

      addDetail(
      {
          color: color,
          description: 'Take ' + (legs[i].routeShortName || legs[i].routeLongName) + sstimes(legs[i]),
          segment: true
      });

      addDetail(
      {
          color: color,
          description: strong(legs[i].to.name),
          transfer: 'transfer alight'
      });
    }
    i++;
    lastColor = color;
  }
  return details;

  details += narrativeDirections(access.streetEdges);

  // Add transit segments
  var transferType = true;
  var lastColor = null;
  for (var i = 0; i < length; i++) 
  {
    var segment = segments[i];
    var fromName = segment.fromName;
    var patterns = segment.segmentPatterns;
    var color = patterns[0].color;

    // Check for a walking distance to see if you are boarding or transferring
    if (segment.walkTime !== 0 || i === 0) 
    {
      if (i > 0) 
      {
        addDetail({
          description: 'Walk ' + (Math.ceil(segment.walkTime / 60) + 1) + ' min',
          icon: 'walk'
        });
      }

      addDetail(
      {
        color: color,
        description: strong(fromName),
        transfer: 'transfer board'
      });
    } 
    else 
    {
      addDetail(
      {
        color: 'linear-gradient(to bottom, ' + lastColor + ' 0%, ' +
          lastColor + ' 50%,' + color + ' 50%, ' + color + ' 100%)',
        description: strong(fromName),
        transfer: 'transfer'
      });
    }

    addDetail(
    {
      color: color,
      description: 'Take ' + getUniquePatternNames(patterns).map(strong).join(' / '),
      segment: true
    });

    // Check if you are debaording
    if (i + 1 >= length || segments[i + 1].walkTime > 0) 
    {
      addDetail(
      {
        color: color,
        description: strong(segment.toName),
        transfer: 'transfer alight'
      });
    }

    lastColor = color;
  }

  if (egress && egress.length > 0) 
  {
    details += narrativeDirections(egress[0].streetEdges);
  }

  return details;
};

function getUniquePatternNames(patterns) 
{
  return patterns.map(function(p) 
  {
    return p.shortName || p.longName;
  }).reduce(function(names, name) 
  {
    if (names.indexOf(name) === -1) names.push(name);
    return names;
  }, []);
}

function strong(s) 
{
  return '<strong>' + s + '</strong>';
}

/**
 * Add narrative directions
 */

function narrativeDirections(edges) 
{
  if (!edges) return '';

  return edges.map(function(se) 
  {
    if (!se.streetName && !se.bikeRentalOffStation) 
    {
      return '';
    }

    var linkOrPath = se.streetName === 'Link' || se.streetName === 'Path';
    if (linkOrPath && se.relativeDirection === 'CONTINUE') 
    {
      return '';
    }

    var streetSuffix = ' on ' + se.streetName;
    var step = {};
    if (se.bikeRentalOnStation) 
    {
      step.description = 'Rent bike from ' + se.bikeRentalOnStation.name + ' and ride ' + se.absoluteDirection.toLowerCase() + streetSuffix;
      step.icon = 'cabi';
    } 
    else if (se.bikeRentalOffStation) 
    {
      step.description = 'Park bike at ' + se.bikeRentalOffStation.name;
      step.icon = 'cabi';
    } 
    else if (se.mode) 
    {
      step.description = MODE_TO_ACTION[se.mode] + ' ' + se.absoluteDirection.toLowerCase() + streetSuffix;
      step.icon = MODE_TO_ICON[se.mode];
    } 
    else 
    {
      step.description = toSentenceCase(se.relativeDirection) + streetSuffix;
      step.direction = DIRECTION_TO_CARDINALITY[se.relativeDirection];
    }

    return row.render(step);
  }).join('');
}

function narrativeDirectionsForSteps(steps, mode) 
{
  if (!steps) return '';

  return steps.map(function(step) 
  {
    if (!step.streetName && !step.bikeRentalOffStation) 
    {
      return '';
    }

    var linkOrPath = step.streetName === 'Link' || step.streetName === 'Path';

    if (linkOrPath && step.relativeDirection === 'CONTINUE') 
    {
      return '';
    }

    if (step.relativeDirection === 'DEPART') 
    {
	    step.mode = mode;
    }

    var streetSuffix = ' on ' + step.streetName;
    var newStep = {};
    if (step.bikeRentalOnStation) 
    {
      newStep.description = 'Rent bike from ' + step.bikeRentalOnStation.name + ' and ride ' + step.absoluteDirection.toLowerCase() + streetSuffix;
      newStep.icon = 'cabi';
    } 
    else if (step.bikeRentalOffStation) 
    {
      newStep.description = 'Park bike at ' + step.bikeRentalOffStation.name;
      newStep.icon = 'cabi';
    }
    // if the description includes steps use MODE_TO_ACTION to create
    else if (step.mode) 
    {
      
      // Setting the speed based on the travel mode
      // to help us get an ETA per step using (m/s)
      switch(step.mode)
      {
        case "WALK":
          // walk speed in m/s
          newStep.speed = 1.33;
          break;
        case "BICYCLE":
          // bike speed in m/s
          newStep.speed = 4.9;
          break;
        case "CAR":
          // car speed in m/s
          newStep.speed = 17.8816;
          break;
        default:
          // set the default to walking
          newStep.speed = 1.33;
          break;
      };
      // Description of the current step
      newStep.description = MODE_TO_ACTION[step.mode] + ' ' + step.absoluteDirection.toLowerCase() + streetSuffix;
      
      // Icon based off the mode: Car, Bike, Walk
      newStep.icon = MODE_TO_ICON[step.mode];
      
      // Travel time based on distance(meters), speed(m/s), and Time(s)
      newStep.travelTime = convert.metersToTime(step.distance, newStep.speed);
      
      // Travel distance converted from Meters to Miles (current step)
      newStep.distance = convert.metersToAny(step.distance);
      
      /* this will set the global mode / speed
       * allowing us to get current speeds when it is using
       * relative directions rather than modes
      */
      set_mode_speed(newStep.speed);
    }
    // If the description is using a relative direction rather than mode
    else 
    {
      
      // Description of the current direction
      newStep.description = toSentenceCase(step.relativeDirection) + streetSuffix;
      
      // current direction being used to navigate the user based on mode
      newStep.direction = DIRECTION_TO_CARDINALITY[step.relativeDirection];
      
      // Travel distance converted from Meters to Miles
      newStep.distance = convert.metersToAny(step.distance);
      
      // Travel time based on distance(meters), speed(m/s), and Time(s)
      newStep.travelTime = convert.metersToTime(step.distance, get_mode_speed());
    
    }

    return row.render(newStep);

  }).join('');
}

var MODE_TO_ACTION = 
{
  BICYCLE: 'Bike',
  BICYCLE_RENT: 'Bike',
  CAR: 'Drive',
  WALK: 'Walk'
};

var MODE_TO_ICON = 
{
  BICYCLE: 'bike',
  BICYCLE_RENT: 'cabi',
  CAR: 'car',
  WALK: 'walk'
};

var DIRECTION_TO_CARDINALITY = 
{
  HARD_LEFT: 'west',
  HARD_RIGHT: 'east',
  RIGHT: 'east',
  LEFT: 'west',
  CONTINUE: 'north',
  SLIGHTLY_RIGHT: 'northeast',
  SLIGHTLY_LEFT: 'northwest'
};
