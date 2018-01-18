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
var eztrans = require("eztrans");
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
      /**
       * @todo Figure out why this has been commented out, it's sticky :)
       */
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

View.prototype.reverseCommute = function(e) 
{
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
// Timeout for msg handling
msgTo = function(type)
{
  if (typeof msgTO !== "undefined") clearTimeout(msgTO);
  if (type == "link") setTimeout(function() { $("div.shareableLinkMsg > span").text("").parent().hide(); }, 5000);
  else if (type == "email") msgTO = setTimeout(function() { $("div.shareableEmailMsg > span").text("").parent().hide(); delete msgTO; }, 5000);
}

validateEmail = function(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email.toLowerCase());
}

captchaExpired = function()
{
  $("div.shareableEmailButton").unbind("click");
}

getTripDate = function()
{
  // date for the planned trip
  var date = $("div.input-group.date.filter-group").data().date;
  return date;
}

getTripTime = function()
{
  // time for the planned trip
  var time = $("div.times_list_wrapper > span.selected").html();
  return time;
}

getArriveDepart = function()
{
  var r = $('[name="arriveBy"]').val();
  if (r == "true") return "arrival at: ";
  else if (r == "false") return "departure at: ";
}

getTripSubject = function()
{
  var subject = "VTA Trip Planner details for " + getArriveDepart() + getTripTime() + " on " + getTripDate();
  return subject;
}

getTripLink = function()
{
  //var link = '<a href="' + $("div.shareableWindowConLink > input").val() + '" title="' + getTripSubject() + '">' + getTripSubject()  + '</a>';
  var link = window.location.href;
  return link;
}

getRouteNumber = function()
{
  if (typeof L.lastCardSelected == "undefined") var index = 0
  else index = L.lastCardSelected.model.index;
  // var link = window.location.href;
  // var last = link.replace("routeNumber=0", "routeNumber=" + index);
  // var last = last.replace("sidePanel=true", "sidePanel=false");
  return index;
}

sendEmailAjax = function(name, to, message, abc)
{
  var subject = getTripSubject();
  var link = getTripLink();
  var route = getRouteNumber();
  // unbind button to prevent spamming on submit
  captchaExpired();
  var errorSending = function()
  {
    $("div.shareableEmailMsg > span").text("We had a problem sending your email, Try again.").parent().show();
    msgTo("email");
    // rebind the button
    submitReCaptcha();
  }
  var url = location.href.split("/planner")[0];
  // post mail to smtp server
  $.ajax(
  {
    "url": url + "/notify",
    "type": "POST",
    "data":
    {
      "name": name,
      "to": to,
      "subject": subject,
      "message": message,
      "link": link,
      "route": route,
      "token": abc
    },
    success: function(e)
    {
      if (e == 1)
      {
        // the email was succesfully sent
        // unbind the button and close the popup after timeout
        captchaExpired();
        $("div.shareableEmailMsg > span").text("Success! Email was sent to: " + to + "!").parent().show();
        msgTo("email");
        setTimeout(function() { if ($("div.shareableWindowCon").length) $("div.shareableWindowCon").remove(); }, 7000);
      }
      // rebind button - there was an error
      else 
      {    
        errorSending();
      }
    },
    error: function(e)
    {
      errorSending();
    }
  });
}

getABC = function(array)
{
  return eztrans.getABC(array);
}

getEmailMessage = function(returnOnly)
{
  // gather the instructions for the first route (best)
  if (typeof L.lastCardSelected == "undefined")
  {
    var lcs = $("li.RouteCard:first-of-type");
  }
  // gather the instructions for the selected route
  else
  {
    var lcs = L.lastCardSelected;
  }
  var route = $(lcs.find("table.RouteDirections"));
  var start = route.find("thead th.description").text();
  var end = route.find("tfoot td.description").text();
  var directions = route.find("tr.segment td.description");
  var dirText = "";
  L.modeify.shareIndex = 1;
  $(directions).each(function(index)
  {

    var dis = $(this).parent().find("td.distance").text();
    if (dis.length > 0) var dist = ": " + dis;
    else dist = "";
    // if it is not the first of the route start checking for duplicates
    if (index !== 0) 
    {
      // this saves the previous direction step relative to the next
      var last_dir = directions.eq(index - 1).text();
      var last_dis = route.find("tr.segment td.distance").eq(index - 1).text();
      // if there is no distance on the previous step
      // than it was a transfer point
      // checking if transfer; if it was; check if the next is a transfer
      // if it is make sure they are not duplicates
      if ((last_dis.length == 0) 
          && (dis.length == 0 && $(this).text() == last_dir))
      {
        dirText += "";
      }
      else 
      {
        dirText += "\n\r" + L.modeify.shareIndex + ": " + $(this).text() + dist;
        L.modeify.shareIndex++;
      }
      
    }
    else 
    {
      dirText += "\n\r" + L.modeify.shareIndex + ": " + $(this).text() + dist;
      L.modeify.shareIndex++;
    }

  });
  var message = 
  "Start Address: " + start
  + dirText
  +"\n\r End Address: " + end;
  var ta = $("textarea#windowConEmailTextArea");
  var msg = /*ta.text() + "\n\r" +*/ message;
  if (typeof returnOnly == "undefined")
  {
    ta.text(msg);
  }
  
  return message;
}



submitReCaptcha = function(e)
{
  // unbind previous click if user didn't complete captcha
  $("div.shareableEmailButton").unbind("click");
  $("div.shareableEmailButton").bind("click", function()
    {
      var from = $("input#windowConEmailName").val();
      var to = $("input#windowConEmailRecipient").val();

      if (from.length && validateEmail(to))
      {
        var abc = getABC([from, to, getTripLink()]);
        sendEmailAjax(from, to, getEmailMessage(true), abc);
      }
      else
      {
        var span = $("div.shareableEmailMsg > span");
        if (!from.length) span.text("Enter Your Name.").parent().show();
        else if (!validateEmail(to)) span.text("Enter Recipient Email.").parent().show();
        else span.text("Please complete all the fields.").parent().show();
        msgTo("email");
      }
     
    });
}
appendShareableWindow = function(location)
{
  // append a popup to the main window - over all other windows
    $("div#main").prepend(
      "<div class='shareableWindowCon'>"
        +"<div class='shareableWindow'>"
          +"<span class=''></span>"
          +"<div class='shareableLinkHeader'><span> X </span></div>"
          + "<div class='shareEmailFormCon'><span class='shareEmailFormTitle'> Share your trip! </span></div>"
          +"<form name='shareEmailForm' id='shareEmailForm'>"
            +"<div class='shareableWindowConEmail'>"
              + "<div class='windowEmailInputsCon'>"
                + "<div class='windowEmailLabelCon'>"
                  + "<label for='windowConEmailName'>Your Name: </label>"
                  + "<label for='windowConEmailRecipient'>Recipient Email: </label>"
                + "</div>"
                + "<input name='windowConEmailName' id='windowConEmailName' placeholder='Your Name: ' />"
                + "<input name='windowConEmailRecipient' id='windowConEmailRecipient' placeholder='Recipients Email: ' />"
              + "</div>"
              + "<label for='windowConEmailTextArea'>Body: <span>(link to your search will be added automatically)</span></label>"
              + "<textarea name='windowConEmailTextArea' readonly id='windowConEmailTextArea'>Hi! I just found great commute options using VTA's TripPlanner. To see my trip checkout the link below: </textarea>"
              +"<div class='shareableEmailMsg noselect'><span></span></div>"
            +"</div>"
            +"<div class='shareableLinkFooter'>"
              +"<div class='shareableEmailButton noselect'>"
                +"<span class='noselect'>Send Email</span>"
              +"</div>"
            +"</div>"
            +"<div class='emailCaptchaError'>"
              +'<div id="emailCaptcha" class="g-recaptcha" data-sitekey="6LdhgD0UAAAAAI8OkmqdqutoD6IPQgPCunMJ5J_x" data-callback="submitReCaptcha" data-expired-callback="captchaExpired"></div>'
              +"<span style='display:none'>Please verify that you are not a robot. </span>"
            +"</div>"
          +"</form>"

          +"<div class='shareableWindowConLink'>"
            +"<div>"
              + "<label for='shareableWindowConLinkI'> Share trip by link </label>"
              + "<input id='shareableWindowConLinkI' name='shareableWindowConLinkI' value='" + location + "' readonly />"
              +"<div class='shareableLinkButtonCon'>"
                +"<div class='shareableLinkMsg noselect'><span>Link copied to clipboard.</span></div>"
                +"<div class='shareableLinkButton noselect'>"
                  +"<span class='noselect'>Copy</span>"
                +"</div>"
              +"</div>"
            +"</div>"
          +"</div>"
        +"</div>"
      +"</div>"
    );
}
copyToClipboardPopup = function()
{
  if ($("li.RouteCard:first-of-type").length)
  {
    var div = $("div.shareableWindowCon");
    if (div.length) div.remove();
    var location = window.location.href;
    appendShareableWindow(location);
    grecaptcha.render("emailCaptcha");
    getEmailMessage()
    var i = $("input#shareableWindowConLinkI");
    i.bind("click", function() { $(this).select(); });
    // prevent popup window from closes directly on open( prevent duplicate clicks)
    setTimeout(function()
    {
      $("div.shareableWindowCon, div.shareableLinkHeader > span").bind("click", function(e)
      {
        if (e.target == this) $("div.shareableWindowCon").remove();
      });
    }, 500);

    $("div.shareableLinkButton").bind("click", function()
    {
      copyToClipboard(window.location.href);
      $("div.shareableLinkMsg > span").text("Link copied to clipboard.").parent().show();
      msgTo("link");
    });
  }
  else alert("Please select a trip first.");
}


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

// Show the route based on route number for grabbing map
View.prototype.displayRouteNumber = function(routeNumber) 
{
    // gather number of total possible routes
    var itineration = JSON.parse(sessionStorage.getItem('itineration'));
    // loop through the routes hiding all but the first
    for (var i = 0; i < itineration.length; i++) 
    {
        // Hide all routes besides the route numbers
        if (i != routeNumber)
        {
            var r3 = d3.selectAll(".iteration-" + i);
            r3.classed("hideMe", true);
            r3.attr("data-show", "0");
        }
    }
    var r3 = d3.selectAll(".iteration-" + routeNumber);

    if (config.map_provider() !== 'AmigoCloud') r3.classed("hideMe", false);
    r3.attr("data-show", "1");
    // show the first route
    var orden = routeNumber;
    d3.selectAll(".iteration-200").each(function (e)
    {
        var element = d3.select(this);
        var parent = d3.select(element.node().parentNode);
        parent.attr("class", "g-element");
        parent.attr("data-orden", orden.toString());
        if (Boolean(parseInt(element.attr("data-show")))) parent.attr("data-show", "1");
        else parent.attr("data-show", "0");
        orden++;
    });

    d3.selectAll(".g-element").each(function (a, b) 
    {
        if (Boolean(parseInt(d3.select(this).attr("data-show")))) d3.select(this).node().parentNode.appendChild(this);
    });
};

/* @params : routeNumber : this is the route which is selected
 * Default is 0 which selects the first route - usually has 3 routes
 * which equates to (0 - 2)
*/
View.prototype.hideSP = function(routeNumber) {
  $("div.SidePanel, div.scrollToTop, nav, div.leaflet-control-zoom.leaflet-bar.leaflet-control, div.leaflet-control-layers.leaflet-control").hide();
  $("div.fullscreen").css({"padding-left": "0", "height": "480px", "width":"480px"});
  L.modeify.map.invalidateSize();
  setTimeout(function() { View.prototype.displayRouteNumber(routeNumber);  }, 800);
}

View.prototype.showSP = function() {
  $("div.SidePanel, div.scrollToTop, nav, div.leaflet-control-zoom.leaflet-bar.leaflet-control, div.leaflet-control-layers.leaflet-control").show();
  $("div.fullscreen").css("padding-left", "320px");
  L.modeify.map.invalidateSize();
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
  if (query.sidePanel !== undefined) 
  {
    if (query.sidePanel == 'true') 
    {  
      plan.sidePanel(1); 
      // View.prototype.showSP();
      // ensure 0 when sidepanel is enabled
      // allows us to format string for email
      plan.routeNumber(0);
    }
    else if (query.sidePanel == 'false')
    {
      plan.sidePanel(0);
      plan.routeNumber(query.routeNumber);
      View.prototype.hideSP(query.routeNumber);
      setTimeout(function()
      {
        L.modeify.map.zoomScale = L.modeify.map.getZoom() - 0.25;
        L.modeify.map.centerScale = L.modeify.map.getCenter();
        L.modeify.map.setZoom(L.modeify.map.zoomScale);
        L.modeify.map.panTo(L.modeify.map.centerScale);
        setTimeout(function() { $("html").append("<div style='display:none' class='readyToPrint'></div>"); }, 18000);
      }, 2000);
    }
  
  }
  //if (query.sidePanel == 'true') alert(query.sidePanel);
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

/**
 * @TODO Investigate as walk distance
 * @param new_plan
 */
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