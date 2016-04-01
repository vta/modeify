var analytics = require('analytics');
var convert = require('convert');
var Feedback = require('feedback-modal');
var mouseenter = require('mouseenter');
var mouseleave = require('mouseleave');
var Calculator = require('route-cost-calculator');
var RouteDirections = require('route-directions-table');
var RouteModal = require('route-modal');
var routeSummarySegments = require('route-summary-segments');
var routeResource = require('route-resource');
var session = require('session');
//var transitive = require('transitive');
var view = require('view');
var showMapView = require('map-view');
/**
 * Expose `View`
 */

var View = module.exports = view(require('./template.html'), function(view, model) {
  mouseenter(view.el, function() {
    var itineraries = model.plan();
    var sesion_plan = JSON.parse(localStorage.getItem('dataplan'));
    sesion_plan = sesion_plan.plan;

    showMapView.cleanPolyline();
    showMapView.cleanMarkerpoint();
     for (var i = 0; i < itineraries.legs.length; i++) {
          showMapView.drawRouteAmigo(itineraries.legs[i], itineraries.legs[i].mode);
     }

    //var lat_center_polyline = (sesion_plan.from.lat + sesion_plan.to.lat) / 2;
    //var lon_center_polyline = (sesion_plan.from.lon + sesion_plan.to.lon) / 2;
    //showMapView.getMap.setView([lat_center_polyline, lon_center_polyline], 11);

  });

  mouseleave(view.el, function() {
    if (!view.el.classList.contains('expanded')) {
      //var itineraries = model.plan();
      console.log("mouseleave");
      //for (var i = 0; i < itineraries.legs.length; i++) {
      //  showMapView.drawRouteAmigo(itineraries.legs[i], itineraries.legs[i].mode);
      //
      //}

      var sesion_plan = JSON.parse(localStorage.getItem('dataplan'));
      sesion_plan = sesion_plan.plan;
      var itineraries = sesion_plan.itineraries;
      for (i = 0; i < itineraries.length; i++) {
          for (ii=0; ii < itineraries[i].legs.length; ii++) {
            showMapView.drawRouteAmigo(itineraries[i].legs[ii], itineraries[i].legs[ii].mode);
          }
      }

      var lat_center_polyline = (sesion_plan.from.lat + sesion_plan.to.lat) / 2;
      var lon_center_polyline = (sesion_plan.from.lon + sesion_plan.to.lon) / 2;
      showMapView.getMap.setView([lat_center_polyline, lon_center_polyline], 8);

    }
  });
});

View.prototype.calculator = function() {
  return new Calculator(this.model);
};

View.prototype.directions = function() {
  return new RouteDirections(this.model);
};

View.prototype.segments = function() {
  return routeSummarySegments(this.model);
};

View.prototype.costSavings = function() {
  return convert.roundNumberToString(this.model.costSavings());
};

View.prototype.timeSavingsAndNoCostSavings = function() {
  return this.model.timeSavings() && !this.model.costSavings();
};

/**
 * Show/hide
 */

View.prototype.showDetails = function(e) {
  e.preventDefault();
  var el = this.el;
  var expanded = document.querySelector('.option.expanded');
  if (expanded) expanded.classList.remove('expanded');

  el.classList.add('expanded');

  analytics.track('Expanded Route Details', {
    plan: session.plan().generateQuery(),
    route: {
      modes: this.model.modes(),
      summary: this.model.summary()
    }
  });

  var scrollable = document.querySelector('.scrollable');
  scrollable.scrollTop = el.offsetTop - 52;
};

View.prototype.hideDetails = function(e) {
  e.preventDefault();
  var list = this.el.classList;
  if (list.contains('expanded')) {
    list.remove('expanded');
  }
};

/**
 * Get the option number for display purposes (1-based)
 */

View.prototype.optionNumber = function() {
  return this.model.index + 1;
};

/**
 * View
 */

View.prototype.feedback = function(e) {
  e.preventDefault();
  Feedback(this.model).show();
};

/**
 * Select this option
 */

View.prototype.selectOption = function() {
  var route = this.model;
  var plan = session.plan();
  var tags = route.tags(plan);

  analytics.send_ga({
    category: 'route-card',
    action: 'select route',
    label: JSON.stringify(tags),
    value: 1
  });
  routeResource.findByTags(tags, function(err, resources) {
    var routeModal = new RouteModal(route, null, {
      context: 'route-card',
      resources: resources
    });
    routeModal.show();
    routeModal.on('next', function() {
      routeModal.hide();
    });
  });
};
