/**
 * Bind event
 */

var evnt = require('event');

/**
 * Utils
 */

function setDayOfWeek (day) {
  if (day === 6) {
    return 'Sat';
  } else if (day === 0) {
    return 'Sun';
  } else {
    return 'M-F';
  }
}

function getModel (view, attr) {
  if (view[attr]) {
    return view[attr]();
  } else if (view.model[attr]) {
    return view.model[attr]();
  } else {
    return;
  }
}

function getEndOrStartTime (view) {
  return getModel(view, 'arriveBy') ? 'end_time' : 'start_time';
}

/**
 * Expose `plugin`
 */

module.exports = function (reactive) {
  reactive.bind('data-date-time', function (el, name) {
    var view = this.reactive.view;

    $(el).datetimepicker({
      defaultDate: moment().format(),
      allowInputToggle: true,
      widgetPositioning: { horizontal: 'right' }
    }).on('dp.hide', function (e) {
      e.stopPropagation();

      var date = e.date,
          day = setDayOfWeek(date.weekday()),
          hour = date.hour(),
          endOrStartTime = getEndOrStartTime(view);

      if (view.model['days']) {
        view.model['days'](day);
      } else {
        return;
      }

      if (view.model[endOrStartTime]) {
        view.model[endOrStartTime](hour);
      } else {
        return;
      }

      view.emit('active', 'days', day);
      view.emit('active', endOrStartTime, hour);
    });
  });

  reactive.bind('data-arrive-by', function (el, name) {
    var view = this.reactive.view;

    evnt.bind(el, 'click', function (e) {
      e.stopPropagation();

      var el = e.target;
      var val = el.getAttribute('data-arrive-by');
      var attr = 'arriveBy';

      while (el && (val === undefined || val === null)) {
        el = el.parentNode;
        val = el && el.getAttribute('data-arrive-by');
      }

      var boolVal = (val === 'true');
      if (view.model[attr]) {
        view.model[attr](boolVal);
      } else {
        return;
      }

      $('div[data-toggle="buttons"] label').removeClass('active');
      $(el).parent().addClass('active');

      // emit active on
      view.emit('active', attr, boolVal);

      document.activeElement.blur();
    });
  });
};