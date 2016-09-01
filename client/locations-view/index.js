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

/**
 * Expose `View`
 */

var View = module.exports = view(require('./template.html'), function(view, plan) {
		view.on('rendered', function() {
      
      // Reset the icons
      view.resetIcons();

      // On form submission
			closest(view.el, 'form').onsubmit = function(e) {
			e.preventDefault();

			plan.setAddresses(view.find('.from input').value, view.find('.to input').value, function(err) {
				if (err) {
				log.error('%e', err);
				} else {
				plan.updateRoutes();
				}
				});
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
	if (highlight) {
		console.log('highlighting');
		e.target.value = highlight.textContent || '';
		if (highlight.dataset.lat) {
			e.target.lat = highlight.dataset.lat;
			e.target.lng = highlight.dataset.lng;
			e.target.address = highlight.addressData;
		}
	}

	suggestionList.classList.add('empty');

	setTimeout(function() {
		suggestionList.innerHTML = '';
        }, 500);

	inputGroup.classList.remove('highlight');
	this.save(e.target);
//	this.scrollDown(0, 0);
};

/**
 * Keypress
 */

View.prototype.keydownInput = function(e) {
	var el = e.target;
	var key = e.keyCode;

	// Currently highlighted suggestion
	var highlightedSuggestion = this.find('.suggestion.highlight');

	switch (key) {
		case 13: // enter key
			console.log('enter key');
			e.preventDefault();
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

	if (!val || plan[name]() === val) return;


	if (el.lat) {
		this.model.setAddress(name, el.lng + ',' + el.lat, function(err, location) {

            if (err) {
                log.error('%e', err);
                analytics.send_ga({
                    category: 'geocoder',
                    action: 'change address invalid',
                    label: val,
                    value: 0
                    });

				    textModal('Invalid address.');

				} else if (location && plan.validCoordinates()) {

                    analytics.send_ga({
                        category: 'geocoder',
                        action: 'change address success',
                        label: val,
                        value: 0
                    });

				    plan.updateRoutes();

				}else {
				    console.log("no ejecuta nada");
				}
		}, el.address);
    } else {

	    this.model.setAddress(name, val, function(err, location) {
			if (err) {
                log.error('%e', err);
                analytics.send_ga({
                    category: 'geocoder',
                    action: 'change address invalid',
                    label: val,
                    value: 0
                });

			textModal('Invalid address.');
			} else if (location && plan.validCoordinates()) {
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

View.prototype.scrollDown = function (num, duration) {
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
  console.log( $wrapper.scrollTop(), offsetTop, e.target );
  if (!!e && e.scrollIntoView) {
    e.target.scrollIntoView()
    $(e.target).blur()
    $(e.target).focus()
  }
  if (ua.os.name === 'Android' && ua.browser.name === 'Chrome'){
    this.scrollDown(offsetTop-20);
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
  if(s.city) 
    city = s.city;
  else if(s.town) 
    city = s.town;
  else if(s.village)
    city = s.village;
  else if(s.hamlet)
    city = s.hamlet;

  var street = '';
  if(s.road)
    street = s.road;
  else if(s.pedestrian)
    street = s.pedestrian;
  else if(s.footway)
    street = s.footway;
  else if(s.industrial)
    street = s.industrial;
  else if(s.cycleway)
    street = s.cycleway;

  var number = '';
  if(s.house_number) 
    number = s.house_number;
  else if(s.parking)
    number = s.parking;

  var place = '';
  if(s.aerodrome) 
    place = s.aerodrome + ', ' + city;
  else if(s.stadium) 
    place = s.stadium + ', ' + city;
  else if(s.school)
    place = s.school + ', ' + city;
  else if(s.museum)
    place = s.museum + ', ' + city;
  else if(s.restaurant)
    place = s.restaurant + ', ' + street + ', ' + city;
  else if(s.cafe)
    place = s.cafe + ', ' + street + ', ' + city;
  else if(s.pub)
    place = s.pub + ', ' + street + ', ' + city;  
  else if(s.bar)
    place = s.bar + ', ' + street + ', ' + city;
  else if(s.fast_food)
    place = s.fast_food + ', ' + street + ', ' + city;
  else if(s.place_of_worship)
    place = s.place_of_worship + ', ' + street + ', ' + city;

  if(place.length > 0)
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

  var resultsCallbackAmigo = function(err, suggestions) {

    if (err) {
      log.error('%e', err);
    } else {
        if (suggestions && suggestions.length > 0) {
            var filter_label = {};
            for (var i = 0; i < suggestions.length; i++) {

                var item_suggestions = suggestions[i].properties;

                if (item_suggestions.country_a == "USA" && item_suggestions.region_a == "CA")  {

                    var item_geometry = suggestions[i].geometry;
                    var suggestion_obj = {
                        "index" : i,
                        "text" : item_suggestions.label,
                        "lat" : item_geometry.coordinates[1],
                        "lon" : item_geometry.coordinates[0],
                        "magicKey": ""
                    };

                    if (filter_label[item_suggestions.label] === undefined){
                        filter_label[item_suggestions.label] = true;
                        suggestionsData.push(suggestion_obj);
                    }

                }

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
        }

        else {
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
                 if(suggestions[i].address) {
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

  // If the text is too short or does not contain a space yet, return
  if (text.length < 3) return;

  // Get a suggestion!
  if (suggestionTimeout !== undefined) {
    clearTimeout(suggestionTimeout);
  }
  suggestionTimeout = setTimeout(function () {
    geocode.suggestAmigo(text, resultsCallbackAmigo);
  }, 400);
};

/**
 * Clear
 */

View.prototype.clear = function(e) {
  e.preventDefault();
  var inputGroup = e.target.parentNode;
  var input = inputGroup.getElementsByTagName('input')[0];
  input.value = '';
  input.focus();
  this.resetIcons();
};

/**
 * currentLocation
 */

View.prototype.currentLocation = function(e) {
  window.console.log('currentLocation tapped ',e);
  e.preventDefault()
  if ('geolocation' in navigator) {
    var name = e.target.parentNode.classList.contains('from') ? 'from' : 'to'
    var input = this.find('.' + name + ' input')
    var self = this
 
    e.target.classList.add('hidden')
    this.find('.' + name + ' .findingCurrentLocation').classList.remove('hidden')
 
    navigator.geolocation.getCurrentPosition(function (position) {
      var c = position.coords
      input.value = c.longitude + ', ' + c.latitude
      self.save(input)
    }, function (err) {
      console.error(err)
      self.resetIcons()
      window.alert('Whoops! We were unable to find your current location.')
    }, {
      enableHighAccuracy: true,  // use GPS if available
      maximumAge: 60000, // 60 seconds
      timeout: 30000  // 30 seconds
    })
  } else {
    window.alert('Whoops! Looks like GPS location not available on this device.')
  }
};

View.prototype.resetIcons = function (e) {
  showClearOrCurrentLocation(this, 'from')
  showClearOrCurrentLocation(this, 'to')

  function showClearOrCurrentLocation (view, name) {
    var selector = '.' + name
    var value = view.find(selector + ' input').value
    var refresh = view.find(selector + ' .findingCurrentLocation')
    var clear = view.find(selector + ' .clear')
    var location = view.find(selector + ' .currentLocation')

    refresh.classList.add('hidden')

    if (!value || !value.trim || value.trim().length === 0) {
      clear.classList.add('hidden')
      location.classList.remove('hidden')
    } else {
      clear.classList.remove('hidden')
      location.classList.add('hidden')
    }
  }
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
