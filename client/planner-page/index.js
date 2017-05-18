var config = require('config');
var FeedbackModal = require('feedback-modal');
var FilterView = require('filter-view');
var HelpMeChoose = require('help-me-choose-view');
var LeafletTransitiveLayer = require('Leaflet.TransitiveLayer');
var LocationsView = require('locations-view');
var log = require('./client/log')('planner-page');
var showMapView = require('map-view');
var OptionsView = require('options-view');
var PlannerNav = require('planner-nav');
var querystring = require('querystring');
var scrollbarSize = require('scrollbar-size');
var scrolling = require('scrolling');
var session = require('session');
var textModal = require('text-modal');
//var transitive = require('transitive');
var ua = require('user-agent');
var view = require('view');
var showWelcomeWizard = require('welcome-flow');
var showPlannerWalkthrough = require('planner-walkthrough');
var geocode = require('geocode');
var dateTime = require('view/dateTime');

var FROM = config.geocode().start_address;
var TO = config.geocode().end_address;

var isMobile = window.innerWidth <= 480;
var center = config.geocode().center.split(',').map(parseFloat);

var View = view(require('./template.html'), function(view, model) {
  view.scrollable = view.find('.scrollable');
  view.panelFooter = view.find('.footer');

  if (scrollbarSize > 0) {
    if (ua.os.name === 'Windows' || ua.browser.name !== 'Chrome')
      view.scrollable.style.marginRight = -scrollbarSize + 'px';

    // Scrollbars are fun and implemented the same on every OS/Browser...right
    if (ua.os.name === 'Windows' && ua.browser.name === 'Chrome')
      view.scrollable.style.paddingRight = scrollbarSize + 'px';
  }
});

/**
 * Expose `render`
 */

module.exports = function(ctx, next) {
  log('render');

  var plan = ctx.plan;
  var query = querystring.parse(window.location.search);

  // Set up the views
  var views = {
    'filter-view': new FilterView(plan),
    'locations-view': new LocationsView(plan),
    'options-view': new OptionsView(plan),
    'planner-nav': new PlannerNav(session)
  };

  ctx.view = new View(views);
  ctx.view.on('rendered', function() {
    // Set plan to loading
    plan.loading(true);

    for (var key in views) {
      views[key].emit('rendered', views[key]);
    }

    // Show the map
    var map = showMapView(ctx.view.find('.MapView'));

    // Update map on plan change

    updateMapOnPlanChange(plan, map);

    map.on('click', function(e) {
      var from = plan.from_ll();
      var to = plan.to_ll();
      if (!plan.coordinateIsValid(from)) {
        plan.journey({
          places: [{
            place_id: 'from',
            place_lat: e.latlng.lat,
            place_lon: e.latlng.lng,
            place_name: 'From'
          }, {
            place_id: 'to',
            place_lat: (plan.to_ll() ? plan.to_ll().lat : 0),
            place_lon: (plan.to_ll() ? plan.to_ll().lng : 0),
            place_name: 'To'
          }]
        });
        plan.setAddress('from', e.latlng.lng + ',' + e.latlng.lat, function(err, res) {
          plan.updateRoutes();
        });
      } else if (!plan.coordinateIsValid(to)) {
        plan.journey({
          places: [{
            place_id: 'from',
            place_lat: plan.from_ll().lat,
            place_lon: plan.from_ll().lng,
            place_name: 'From'
          }, {
            place_id: 'to',
            place_lat: e.latlng.lat,
            place_lon: e.latlng.lng,
            place_name: 'To'
          }]
        });
        plan.setAddress('to', e.latlng.lng + ',' + e.latlng.lat, function(err, res) {
          plan.updateRoutes();
        });
      }
    });



    // Clear plan & cookies for now, plan will re-save automatically on save
    var from = plan.from_ll();
    var to = plan.to_ll();
    //plan.clearStore();

    // If it's a shared URL or welcome is complete skip the welcome screen
    if (query.from && query.to) {
      showQuery(query);
    } else {
      if (plan.coordinateIsValid(from) && plan.coordinateIsValid(to)) {
        plan.setAddresses(
          from.lng + ',' + from.lat, // from
          to.lng + ',' + to.lat, // to
          function(err, res) {
            plan.updateRoutes();

          }
        );
        plan.updateRoutes();
      } else {
        plan.loading(false);
      }
    }



  });

  checkWarnIncognito()

  // plan.on('updating options', function() {
  //   ctx.view.panelFooter.classList.add('hidden');
  // });

  // plan.on('updating options complete', function(res) {
  //   if (res && !res.err) ctx.view.panelFooter.classList.remove('hidden');
  // });

  next();
};

function checkWarnIncognito(){

  function warnUserForIncognito(message){
    console.warn(message)
    alert(message)
  }

  // because incognito/private mode is not supported,
  // check and notify the user if we are
  // see http://stackoverflow.com/a/27081419/940217
  if (typeof localStorage === 'object') {
    try {
        localStorage.setItem('localStorage', 1);
        localStorage.removeItem('localStorage');
    } catch (e) {
        Storage.prototype._setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function() {};
        warnUserForIncognito('Your browser is in "Private" or "Incognito" mode. VTA\'s Trip Planner does not work properly in this mode. Please try again in the normal browsing mode. We apologize for the inconvenience.');
    }
  }
}

/**
 * Reverse Commute
 */

View.prototype.reverseCommute = function(e) {
  e.preventDefault();
  var plan = session.plan();
  plan.set({
    from: plan.to(),
    from_id: plan.to_id(),
    from_ll: plan.to_ll(),
    to: plan.from(),
    to_id: plan.from_id(),
    to_ll: plan.from_ll()
  });

  plan.updateRoutes();


};

/**
 * Scroll
 */

View.prototype.scroll = function(e) {
  e.preventDefault();
  this.scrollable.scrollTop += (this.scrollable.scrollHeight / 5);
};

/**
 * On submit
 */

View.prototype.onsubmit = function(e) {
  e.preventDefault();
};

/**
 * Help Me Choose
 */

View.prototype.helpMeChoose = function(e) {
  HelpMeChoose(session.plan().options()).show();
};

/**
 * Show feedback modal
 */
View.prototype.feedback = function(e) {
  e.preventDefault();
  FeedbackModal().show();
};

/**
 * Link to Surveymonkey
 */

View.prototype.surveymonkey = function(e) {
  e.preventDefault();
  window.open('https://www.surveymonkey.com/r/ZB63FHZ')
};

/**
 * Hide Side Panel
 */

View.prototype.hideSidePanel = function(e) {
  var $sidePanelBottom = $('.SidePanel.bottom'),
    $nav = $('nav'),
    $mapWrap = $('.MapView'),
    map = showMapView.getMap();

  var navHeight = $nav.height(),
    topHeight = $(window).height() - navHeight - $mapWrap.height(),
    bottomHeight = $sidePanelBottom.height();

  $nav.css({
    'transition': 'transform 2s',
    '-webkit-transition': '-webkit-transform 2s',
    'transform': 'translate3d(0, -' + navHeight + 'px, 0)'
  });

  $('.SidePanel.top').css({
    'transition': 'transform 2s',
    '-webkit-transition': '-webkit-transform 2s',
    'transform': 'translate3d(0, ' + topHeight + 'px, 0)'
  });

  $sidePanelBottom.fadeOut(2000);

  $mapWrap.css({
    'transition': 'height 2s',
    'height': '100%',
    'transition': 'transform 2s',
    '-webkit-transition': '-webkit-transform 2s',
    'transform': 'translate3d(0, -' + navHeight + 'px, 0)'
  }).children('.hide-map').css('display', 'inline-block');

  setTimeout(function() {
    map.invalidateSize();
  }, 2100)
};

/**
 * Show Side Panel
 */

View.prototype.showSidePanel = function(e) {
  var $sidePanelTop = $('.SidePanel.top'),
    $sidePanelBottom = $('.SidePanel.bottom'),
    $nav = $('nav'),
    $mapWrap = $('.MapView'),
    map = showMapView.getMap();

  var navHeight = $nav.height(),
    topHeight = $(window).height() - navHeight - $mapWrap.height();

  $nav.css({
    'transition': 'transform 2s',
    '-webkit-transition': '-webkit-transform 2s',
    'transform': 'translate3d(0, 0, 0)'
  });

  $sidePanelTop.css({
    'transition': 'transform 2s',
    '-webkit-transition': '-webkit-transform 2s',
    'transform': 'translate3d(0, 0, 0)'
  });

  $sidePanelBottom.fadeIn(2000);

  $mapWrap.css({
    'transition': 'height 2s',
    'height': '280px',
    'transition': 'transform 2s',
    '-webkit-transition': '-webkit-transform 2s',
    'transform': 'translate3d(0, 0, 0)'
  }).children('.hide-map').css('display', 'none');

  setTimeout(function() {
    var plan = session.plan();
    map.invalidateSize();

    plan = session.plan();
    plan.updateRoutes();
    //transitive.updateData(plan.journey());

    plan.journey();

  }, 2100)
};

/**
 * Show Journey
 */

function showQuery(query) {
  var plan = session.plan();
  // If no querystring, see if we have them in the plan already
  var from = query.from || plan.from() || FROM;
  var to = query.to || plan.to() || TO;
  var sameAddresses = from === plan.from() && to === plan.to();

  // Set plan from querystring
  if (query.from !== undefined) plan.from(query.from);
  if (query.to !== undefined) plan.to(query.to);
  if (query.modes) plan.setModes(query.modes);
  if (query.days !== undefined) plan.days(query.days);
  if (query.arriveBy !== undefined) plan.arriveBy(query.arriveBy === 'true');
  if (query.date !== undefined) plan.date(query.date);
  if (query.hour !== undefined) plan.hour(parseInt(query.hour, 10));
  if (query.minute !== undefined) plan.minute(parseInt(query.minute, 10));
  if (query.flat !== undefined) plan.flat(query.flat === 'true')
  if (query.safe !== undefined) plan.safe(query.safe === 'true')
  if (query.fast !== undefined) plan.fast(query.fast === 'true')
  // console.log('bike triangle set to ', {'flat':plan.flat(), 'safe':plan.safe(), 'fast':plan.fast()})


  // set dateTimePicker to match query
  dateTime.picker.setTime(dateTime.picker.generateMoment());

  // If has valid coordinates, load
  if (plan.validCoordinates() && sameAddresses) {
    plan.journey({
      places: plan.generatePlaces()
    });
    plan.updateRoutes();

  } else {
    plan.setAddresses(from, to, function(err) {
      if (err) {
        log.error('%e', err);
      } else {
        plan.journey({
          places: plan.generatePlaces()
        });
        plan.updateRoutes();

      }
    });
  }
}

/**
 * Update Map on plan change
 */

function updateMapOnPlanChange(plan, map) {

  plan.on('change journey', function(journey) {
    showMapView.cleanPolyline();
    showMapView.cleanMarker();
    showMapView.cleanMarkerpoint();
    showMapView.cleanMarkerCollision();
    showMapView.marker_collision_group = [];
    showMapView.clearExistingRoutes(); // remove old realtime & stop data from map

    var sesion_plan = JSON.parse(sessionStorage.getItem('dataplan'));
    if (journey) {
      try {

        if (!(sesion_plan === null)) {
          sesion_plan = sesion_plan.plan;

          var itineraries = sesion_plan.itineraries;

          showMapView.marker_map(
            [sesion_plan.from.lat, sesion_plan.from.lon], [sesion_plan.to.lat, sesion_plan.to.lon]
          );



          var route;
          map.routes = []; // empty the routes array
          for (i = 0; i < itineraries.length; i++) {
            for (ii = 0; ii < itineraries[i].legs.length; ii++) {
              route = showMapView.drawRouteGoogle(itineraries[i].legs[ii], itineraries[i].legs[ii].mode, i);
              map.routes.push(route);
            }
          }

          // set zoom to encapuslate all routes
          if (map.routes.length) {
            var routeBoundaries = new L.featureGroup(map.routes);
            map.fitBounds(routeBoundaries.getBounds());
          }

          showMapView.drawMakerCollision();
        }

      } catch (e) {
        map.setView([center[1], center[0]], config.geocode().zoom);
      }

    }
  });
}


function get_data_route(new_plan) {
  var itineraries = new_plan.plan.itineraries;
  var timeInTransit = 0;
  var bikeTime = 0;
  var bikeDistance = 0;
  var walkTime = 0;
  var walkDistance = 0;

  for (var i = 0; i < itineraries.length; i++) {
    for (var j = 0; j < itineraries[i].legs.length; j++) {
      var fare = (itineraries[i].fare ? itineraries[i].fare.fare.regular.cents : 0);
      if (itineraries[i].legs[j].transitLeg) {
        timeInTransit += itineraries[i].legs[j].duration;
      } else {
        if (itineraries[i].legs[j].mode === 'BICYCLE') {
          bikeTime += itineraries[i].legs[j].duration;
          bikeDistance += itineraries[i].legs[j].distance;
        } else if (itineraries[i].legs[j].mode === 'WALK') {
          walkTime += itineraries[i].legs[j].duration;
          walkDistance += itineraries[i].legs[j].distance;
        }
      }

      data = {
        from: new_plan.plan.from.name,
        to: new_plan.plan.to.name,
        time: timeInTransit + bikeTime + walkTime,
        timeInTransit: timeInTransit / 60,
        cost: fare / 100,
        transitCost: fare / 100,
        bikeTime: bikeTime,
        bikeDistance: bikeDistance,
        walkDistance: walkDistance,
        walkTime: walkTime,
        plan: itineraries[i]
      }


    }

  }
  return data
}