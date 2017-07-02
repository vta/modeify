var closest = require('closest');
var each = require('each');
var geocode = require('geocode');
var hogan = require('hogan.js');
var log = require('./client/log')('locations-view');
var mouse = require('mouse-position');
var textModal = require('text-modal');
var view = require('view');
var analytics = require('analytics');
var ua = require('user-agent');
var session = require('session');

/**
 * Expose `View`
 */

var View = module.exports = view(require('./template.html'), function(view, plan) {
  view.on('rendered', function() {
    var self = this;

    window.setTimeout(function(){
      self.resetIcons();
      // TODO: check for user location here
    }, 200);
    
    closest(view.el, 'form').onsubmit = function(e) {
      e.preventDefault();

      if (plan.validCoordinates()) {
        analytics.send_ga({
          category: 'geocoder',
          action: 'plan route'
        });
        plan.updateRoutes();
      }
    };
  });
});

/**
 * Address Changed
 */

View.prototype.blurInput = function(e) {
  log('input blurred, saving changes');

  var inputGroup = e.target.parentNode;
  var suggestionList = inputGroup.getElementsByTagName('ul')[0];
  inputGroup.classList.remove('suggestions-open');

  var highlight = this.find('.suggestion.highlight');
  if (!highlight){
    // enter was likely pressed. this will
    // get the first item in the suggestions list
    highlight = this.find('.suggestion')
  }
  if (highlight) {
    console.log('highlighting');
    e.target.value = highlight.textContent || '';
    if (highlight.dataset.placesid) {
      e.target.placesid = highlight.dataset.placesid;
      e.target.address = highlight.addressData;
    }
  }

  suggestionList.classList.add('empty');
  if (suggestionTimeout !== undefined) {
    clearTimeout(suggestionTimeout);
  }
  suggestionTimeout = setTimeout(function() {
    inputGroup.classList.remove('suggestions-open');
    suggestionList.classList.add('empty');
    suggestionList.innerHTML = '';
  }, 50);

  inputGroup.classList.remove('highlight');
  this.save(e.target);
  //  this.scrollDown(0, 0);
};

/**
 * Keypress
 */

View.prototype.keydownInput = function(e) {
  var el = e.target;
  var key = e.keyCode;
  var view = this;

  // Currently highlighted suggestion
  var highlightedSuggestion = this.find('.suggestion.highlight');

  switch (key) {
    case 13: // enter key
      console.log('enter key');
      e.preventDefault();
      el.blur();
      view.autocomplete = null; // prevent future autocomplete results from returning
      this.blurInput(e);
      break;
    case 38: // up key
    case 40: // down key
      if (key === 38) {
        this.pressUp(highlightedSuggestion, el);
      } else {
        this.pressDown(highlightedSuggestion, el);
      }

      var newHighlight = this.find('.suggestion.highlight');
      if (newHighlight) el.value = newHighlight.textContent || '';
      break;
  }
};

/**
 * Press Up
 */

View.prototype.pressUp = function(highlightedSuggestion, el) {
  if (highlightedSuggestion) {
    var aboveHighlightedSuggestion = highlightedSuggestion.previousElementSibling;

    if (aboveHighlightedSuggestion) {
      aboveHighlightedSuggestion.classList.add('highlight');
    } else {
      el.value = this.currentLocation || '';
      setCursor(el, el.value.length);
    }
    highlightedSuggestion.classList.remove('highlight');
  }
};

/**
 * Press Down
 */

View.prototype.pressDown = function(highlightedSuggestion, el) {
  if (!highlightedSuggestion) {
    var suggestion = this.find('.suggestion');
    if (suggestion) suggestion.classList.add('highlight');
  } else if (highlightedSuggestion.nextElementSibling) {
    highlightedSuggestion.nextElementSibling.classList.add('highlight');
    highlightedSuggestion.classList.remove('highlight');
  }
};

/**
 * Geocode && Save
 */

View.prototype.save = function(el) {
  var plan = this.model;
  var name = el.name;
  var val = el.value;
  var placesid = el.placesid;

  if (!val || plan[name]() === val) return;


  if (el.lat) {
    this.model.setAddress(name, { 'll' : el.lng + ',' + el.lat }, function(err, location) {

      if (err) {
        log.error('%e', err);
        analytics.send_ga({
          category: 'geocoder',
          action: 'change address invalid',
          label: val,
          value: 0
        });

        textModal('Invalid address.');

      } else if (plan.validCoordinates()) {

        analytics.send_ga({
          category: 'geocoder',
          action: 'change address success',
          label: val,
          value: 0
        });

        plan.updateRoutes();

      } else {
        console.log("no ejecuta nada");
      }
    }, el.address);
  } else {

    this.model.setAddress(name, {'physical_addr':val, 'places_id':placesid}, function(err, location) {
      if (err) {
        log.error('%e', err);
        analytics.send_ga({
          category: 'geocoder',
          action: 'change address invalid',
          label: val,
          value: 0
        });

        textModal('Invalid address.');
      } else if (plan.validCoordinates()) {
        analytics.send_ga({
          category: 'geocoder',
          action: 'change address success',
          label: val,
          value: 0
        });
        plan.updateRoutes();

      }
    });
  }
  this.resetIcons();
};

/**
 * Scroll down a certain number of pixels
 */

View.prototype.scrollDown = function(num, duration) {
  duration = duration || 200;
  console.log('scroll down', num)
  $('.fullscreen').animate({
    scrollTop: num
  }, duration);
};

/**
 * Highlight the selected input
 */

View.prototype.focusInput = function(e) {
  var $wrapper = $('.fullscreen');
  var offsetTop = $wrapper.scrollTop() + $(e.target).offset().top;
  console.log($wrapper.scrollTop(), offsetTop, e.target);
  if (!!e && e.scrollIntoView) {
    e.target.scrollIntoView()
    $(e.target).blur()
    $(e.target).focus()
  }
  if (ua.os.name === 'Android' && ua.browser.name === 'Chrome') {
    this.scrollDown(offsetTop - 20);
  }
  e.target.parentNode.classList.add('highlight');
};

/**
 * Suggestions Template
 */

var suggestionsTemplate = hogan.compile(require('./suggestions.html'));
var suggestionTimeout;

function getAddress(s) {
  var city = '';
  if (s.city)
    city = s.city;
  else if (s.town)
    city = s.town;
  else if (s.village)
    city = s.village;
  else if (s.hamlet)
    city = s.hamlet;

  var street = '';
  if (s.road)
    street = s.road;
  else if (s.pedestrian)
    street = s.pedestrian;
  else if (s.footway)
    street = s.footway;
  else if (s.industrial)
    street = s.industrial;
  else if (s.cycleway)
    street = s.cycleway;

  var number = '';
  if (s.house_number)
    number = s.house_number;
  else if (s.parking)
    number = s.parking;

  var place = '';
  if (s.aerodrome)
    place = s.aerodrome + ', ' + city;
  else if (s.stadium)
    place = s.stadium + ', ' + city;
  else if (s.school)
    place = s.school + ', ' + city;
  else if (s.museum)
    place = s.museum + ', ' + city;
  else if (s.restaurant)
    place = s.restaurant + ', ' + street + ', ' + city;
  else if (s.cafe)
    place = s.cafe + ', ' + street + ', ' + city;
  else if (s.pub)
    place = s.pub + ', ' + street + ', ' + city;
  else if (s.bar)
    place = s.bar + ', ' + street + ', ' + city;
  else if (s.fast_food)
    place = s.fast_food + ', ' + street + ', ' + city;
  else if (s.place_of_worship)
    place = s.place_of_worship + ', ' + street + ', ' + city;

  if (place.length > 0)
    return place;
  else
    return $.grep([number, street, city, s.state], Boolean).join(", ")
}

/**
 * Suggest
 */

View.prototype.suggest = function(e) {
  var input = e.target;
  var text = input.value || '';
  var name = input.name;
  var inputGroup = input.parentNode;
  var suggestionList = inputGroup.getElementsByTagName('ul')[0];
  var view = this;
  var suggestionsData = [];

  this.resetIcons();

  var resultsCallbackGoogle = function(err, suggestions, query_text) {

    if (err) {
      log.error('%e', err);
    } else {
      if (view.autocomplete === null){
        console.log('throwing away autocomplete results for text "'+query_text+'" because the user previously hit enter.')
        return
      }
      if (view.autocomplete !== query_text){
        console.log('throwing away autocomplete results for text "'+query_text+'" because a newer search was made for "'+view.autocomplete+'"' )
        return
      }
      view.autocomplete = null
      if (suggestions && suggestions.length > 0) {
        var filter_label = {};
        for (var i = 0; i < suggestions.length; i++) {

          var item_suggestion = suggestions[i];

          var suggestion_obj = {
            "index": i,
            "text": item_suggestion['description'],
            "placesid": item_suggestion['place_id']
          };

          //if (filter_label[item_suggestions.label] === undefined) {
          //  filter_label[item_suggestions.label] = true;
          //  suggestionsData.push(suggestion_obj);
          //}
          suggestionsData.push(suggestion_obj);

        }

        suggestionsData = suggestionsData.slice(0, 8);
        suggestionList.innerHTML = suggestionsTemplate.render({
          suggestions: suggestionsData
        });
        /*******************/
        each(view.findAll('.suggestion'), function(li) {
          li.addressData = suggestions[li.dataset.index];

          li.onmouseover = function(e) {
            li.classList.add('highlight');
          };

          li.onmouseout = function(e) {
            li.classList.remove('highlight');
          };
        });

        suggestionList.classList.remove('empty');
        inputGroup.classList.add('suggestions-open');
        /*******************/
      } else {
        suggestionList.classList.add('empty');
        inputGroup.classList.remove('suggestions-open');
      }
    }
  };

  var resultsCallback = function(err, suggestions) {

    if (err) {
      log.error('%e', err);
    } else {
      if (suggestions && suggestions.length > 0) {

        for (var i = 0; i < suggestions.length; i++) {
          if (!suggestions[i].text) {
            if (suggestions[i].address) {
              suggestions[i].text = getAddress(suggestions[i].address);
            } else {
              suggestions[i].text = suggestions[i].display_name;
            }
          }
          suggestions[i].index = i;
        }
        suggestions = suggestions.slice(0, 5);

        suggestionList.innerHTML = suggestionsTemplate.render({
          suggestions: suggestions
        });

        each(view.findAll('.suggestion'), function(li) {
          li.addressData = suggestions[li.dataset.index];

          li.onmouseover = function(e) {
            li.classList.add('highlight');
          };

          li.onmouseout = function(e) {
            li.classList.remove('highlight');
          };
        });

        suggestionList.classList.remove('empty');
        inputGroup.classList.add('suggestions-open');
      } else {
        suggestionList.classList.add('empty');
        inputGroup.classList.remove('suggestions-open');
      }
    }
  };

  if (text.length === 0) {
    // there's nothing here! clear the autocomplete.
    suggestionList.classList.add('empty');
    inputGroup.classList.remove('suggestions-open');
    return;
  }
  // If the text is too short or does not contain a space yet, return
  if (text.length < 3) return;

  console.log('getting suggestions for text: "'+text+'"' )
  // Get a suggestion!
  if (suggestionTimeout !== undefined) {
    clearTimeout(suggestionTimeout);
  }
  
  suggestionTimeout = setTimeout(function() {
    console.log('timeout trigger')
    view.autocomplete = text;
    geocode.suggestGoogle(text, resultsCallbackGoogle);
  }, 50);
};

/**
 * Clear
 */

View.prototype.clear = function(e) {
  e.preventDefault();
  var inputGroup = e.target.parentNode;
  var input = inputGroup.getElementsByTagName('input')[0];
  input.value = '';
  this.resetIcons();
  input.focus();
};

View.prototype.locateMe = function(e) {
  e.preventDefault();
  var self = this;
  var inputGroup = e.target.parentNode;
  var input = inputGroup.getElementsByTagName('input')[0];

  this.resetIcons();
  if (navigator.geolocation) {

    var clear_btn = inputGroup.querySelector('.fa-times')
    var loading_btn = inputGroup.querySelector('.fa-spin')
    var location_me_btn = inputGroup.querySelector('.fa-location-arrow')
    clear_btn.classList.add('hidden')
    loading_btn.classList.remove('hidden')
    location_me_btn.classList.add('hidden')

    var geolocationSuccess = function(position) {
      console.log('user allowed access to geolocation')
      self.user_geolocation = true;
      var plan = session.plan();
      var target = input.id.indexOf('from') !== -1 ? 'from' : 'to';
      plan.setAddress(target, position.coords.longitude + ',' + position.coords.latitude, function(err, rees) {
        plan.updateRoutes();
        self.resetIcons();
      });
    }

    var geolocationError = function(position) {
      console.warn('user denied access to geolocation')
      // hide the geolocation button
      self.user_geolocation = false;
      self.resetIcons();
    }

    navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 30000
    });
  } else {
    this.resetIcons();
  }
}

View.prototype.resetIcons = function (e) {
  
  function showClearOrCurrentLocation (view, name) {
    var selector = '.' + name
    var value = view.find(selector + ' input').value
    var clear_btn = view.find(selector + ' .fa-times')
    var loading_btn = view.find(selector + ' .fa-spin')
    var location_me_btn = view.find(selector + ' .fa-location-arrow')
    if (!value || !value.trim || value.trim().length === 0) {
      
      loading_btn.classList.add('hidden')
      if (show_geo_btn){
        clear_btn.classList.add('hidden')
        location_me_btn.classList.remove('hidden')
      } else {
        console.log('refusing to show location arrow')
        clear_btn.classList.remove('hidden')
        location_me_btn.classList.add('hidden')
      }
    } else {
      clear_btn.classList.remove('hidden')
      loading_btn.classList.add('hidden')
      location_me_btn.classList.add('hidden')
    }
  }

  var show_geo_btn = (this.user_geolocation === undefined || this.user_geolocation === true) ? true : false;
  showClearOrCurrentLocation(this, 'from')
  showClearOrCurrentLocation(this, 'to')
}

/**
 * Set cursor
 */

function setCursor(node, pos) {
  node = (typeof node === "string" || node instanceof String) ? document.getElementById(node) : node;
  console.log('set cursor');

  if (!node) return;

  if (node.createTextRange) {
    var textRange = node.createTextRange();
    textRange.collapse(true);
    textRange.moveEnd(pos);
    textRange.moveStart(pos);
    textRange.select();
  } else if (node.setSelectionRange) {
    node.setSelectionRange(pos, pos);
  }

  return false;
}