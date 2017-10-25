/**
 * Bind event
 */

var evnt = require('event')
var ua = require('user-agent');

// var is_mobile = (ua.os.name === 'Android' || ua.os.name === 'iOS');
var is_mobile = L.Browser.mobile;

/**
 * Utils
 */

/**
 * Set day of week
 * @param day
 * @returns {*}
 */
function setDayOfWeek (day) {
  if (day === 6) {
    return 'Sat'
  } else if (day === 0) {
    return 'Sun'
  } else {
    return 'M-F'
  }
}

/**
 * Get current view model attributes
 * @param view
 * @param attr
 * @returns {*}
 */
function getModel (view, attr) {
  if (view[attr]) {
    return view[attr]()
  } else if (view.model[attr]) {
    return view.model[attr]()
  } else {
    return
  }
}

/**
 * Get Arrive By from View Model
 * @param view
 * @returns {boolean}
 */
function getArriveBy(view) {
  return Boolean(getModel(view, 'arriveBy'))
}

/**
 *
 * @returns {*}
 */
function getUIDateTime(){
  var dtp = $('.input-group.date input')
  var val = dtp.val()
  var time = null;
  if (!val || val.length < 1){
    return;
  }

  var selected_date = new Date(val)
  if (is_mobile){
    if (ua.os.name === 'iOS'){
       // WTF Apple, seriously.
       // Mobile Safari and Chrome on iOS does not honor the local time input as local time,
       // and instead uses UTC as the time zone
       var date_parts = val.split('T')[0].split('-')
       var time = val.split('T')[1]
       selected_date.setFullYear(date_parts[0])
       selected_date.setMonth(date_parts[1])
       selected_date.setDate(date_parts[2])
       selected_date.setHours(time.split(':')[0])
    }
    time = moment(selected_date)
  } else {
    time = moment(selected_date);
    var timepicker_moment = moment($('.time_picker_wrapper input')[0].dataset.time);
    console.log('getUIDateTime (desktop): setting hour and minute to be '+timepicker_moment.hour()+':'+timepicker_moment.minute())
    time.hour(timepicker_moment.hour());
    time.minute(timepicker_moment.minute());
  }
  return time
}

/**
 * Alternate Arrive and Depart buttons
 * @param view
 */
function setUIDepartArriveByButtonsActive(view){
  var arriveBy = getArriveBy(view)
  if (arriveBy){
    $('[name="arriveBy"]').val("true") // show "Arrive"
  } else {
    $('[name="arriveBy"]').val("false")// show "Depart"
  }
}

/**
 * Desktop date time picker
 * @param view
 * @param el
 * @returns {jQuery|*}
 */
function initDesktopPicker(view, el){
  $(makeTimeDDL(view)).insertBefore(el)
  picker = $(el).datetimepicker({
      defaultDate: new Date(),
      collapse: false,
      format: 'MM/DD/YY',
      debug: true,
      widgetPositioning: { horizontal: 'right' }
    }).on('dp.hide', function (e) {
      // when the datetimepicker is closed, update models with current dates and emit event
      e.stopPropagation()
      $('#main').off('mouseup')

      var ui_time = getUIDateTime();
      e.date.hour(ui_time.hour())
      e.date.minute(ui_time.minute())
      var time = picker.setTime(e.date)
      view.emit('active', 'days', time.day)
      view.emit('active', time.endOrStartTime, time.hour)
    });

    var picker_input = $(el).find('input');
    picker_input.on('blur', function(){
      var val = picker_input.val()
      if (!val || val.length < 1){
        return;
      }
      var selected_date = moment(new Date(val))
      var ui_time = getUIDateTime();
      selected_date.hour(ui_time.hour())
      selected_date.minute(ui_time.minute())
      var time = picker.setTime(selected_date)
      view.emit('active', 'days', time.day)
      view.emit('active', time.endOrStartTime, time.hour)
    });
    picker_input.keyup(function (event) {
        var key = event.keyCode || event.which;
        if (key === 13) {
            this.blur();
        }
        return false;
    })
    return picker;
}

/**
 * Mobile date time picker
 * @param view
 * @param el
 * @returns {jQuery}
 */
function initMobilePicker(view, el){
  var dtp = $(el).find('input')
  dtp.attr('type','datetime-local')

  // native datetime-local input type needs
  // the time in a certain format, like
  //    2013-03-18T13:00
  var d = new Date()
  var f_time = []
  f_time.push(d.getUTCFullYear())
  f_time.push('-')
  f_time.push(d.getUTCMonth())
  f_time.push('-')
  f_time.push(d.getUTCDate())
  f_time.push('T')
  f_time.push(d.getHours())
  f_time.push(':')
  f_time.push(d.getMinutes())
  dtp.val(f_time.join(''))

  dtp.on('blur', function(){
    // Note: on Mobile Chrome, for this element, the [type="datetime-local"],
    // the blur event does not fire when the native picker closes.

    var val = dtp.val()
    if (!val || val.length < 1){
      return;
    }
    var time = getUIDateTime()
    console.log('date changed to ', time)

    var arrive_by_value = $('[name="arriveBy"]').val() === 'true'

    var day = time.day(),
          hour = time.hour(),
          min = time.minute(),
          arriveBy = arrive_by_value

    var newModelAttrs = [
      { key: 'days', value: day },
      { key: 'date', value: time.format('MM:DD:YYYY') },
      { key: 'minute', value: min },
      { key: 'hour', value: hour }
    ]

    // update each of the models w/ their new values
    newModelAttrs.forEach(function (attr) {
      if (view.model[attr.key]) {
        view.model[attr.key](attr.value)
      }
    })

    view.emit('active', 'days', time.day())
    view.emit('active', 'hour', hour)
    view.emit('active', arrive_by_value, time.hour())
  });

  $(el).find('.input-group-addon').bind('click touchend', function(e){
    dtp.focus();  // cause the datetime-local input to open on iOS
  })
  return dtp
}

/**
 * Expose plugin
 * @param reactive
 */
module.exports.plugin = function (reactive) {
  reactive.bind('data-date-time', function (el, name) {
    var view = this.reactive.view, picker

    setTimeout(function(){
      setUIDepartArriveByButtonsActive(view)
    }, 200)


    //is_mobile = false // debug only
    console.log((is_mobile ? 'is':'not')+' mobile!')


    // picker is extracted as a separate method so that it can be accessed elsewhere in app (planner-page)
    // adheres to the followind:
    //   setTime (function())
    //   generateMoment (function())

    // var picker = null
    if (is_mobile){
      picker = module.exports.picker = initMobilePicker(view, el)
    } else {
      picker = module.exports.picker = initDesktopPicker(view, el)
    }

    $.extend(picker, {
      generateMoment: function () {
        // used to convert model values – used by otp – into moment obj understood by datetimepicker
        var date = getModel(view, 'date'),
          hour = getModel(view, 'hour'),
          min = getModel(view, 'minute')

        var year = parseInt(date.slice(date.lastIndexOf(':') + 1), 10),
          day = parseInt(date.slice(date.indexOf(':') + 1, date.lastIndexOf(':')), 10),
          month = parseInt(date.slice(0, date.indexOf(':')), 10) - 1

        return moment().year(year).month(month).date(day).hour(hour).minute(min)
      },

      isCurrTime: function (dateTime) {
        return moment().isSame(dateTime, 'minute')
      },

      autoUpdate: function () {
        this.stopAutoUpdate()

        this.interval = setTimeout(function () {
          picker.setTime(moment())
        }, 60000)
      },

      stopAutoUpdate: function () {
        if (this.interval) {
          clearTimeout(this.interval)
        }
      },

      setTime: function (moment) {
        var day = setDayOfWeek(moment.weekday()),
          hour = moment.hour(),
          min = moment.minute(),
          arriveBy = getArriveBy(view)

        var newModelAttrs = [
          { key: 'days', value: day },
          { key: 'date', value: moment.format('MM:DD:YYYY') },
          { key: 'minute', value: min },
          { key: 'hour', value: hour }
        ]

        // update each of the models w/ their new values
        newModelAttrs.forEach(function (attr) {
          if (view.model[attr.key]) {
            view.model[attr.key](attr.value)
          }
        })

        // unnecessary
        // // if time/date in datetimepicker matches current time, autoupdate datetimepicker each minute
        // if (this.isCurrTime(moment)) {
        //   this.autoUpdate()
        // } else {
        //   this.stopAutoUpdate()
        // }

        // set datetimepicker
        if (is_mobile){
          console.log('setTime picker val (A): '+picker.val())
          if (ua.browser.name !== 'Mobile Safari'){
            picker.val(moment.format('YYYY-MM-DDTH:mm'))
          }
          console.log('setTime picker val (B): '+picker.val())
        } else {
           this.data('DateTimePicker').date(moment)
        }

        // return these model values so they can be emitted as events and page refreshed
        return {
          day: day,
          hour: hour,
          arriveBy: view.model['arriveBy']()
        }
      }
    })
  })

  reactive.bind('data-arrive-by', function (el, name) {
    var view = this.reactive.view
    
    evnt.bind($(el).parent().parent()[0], 'change', function (e) {
      e.stopPropagation()

      var el = e.target
      var val = $('[name="arriveBy"]').val()  === 'true'
      var attr = 'arriveBy'

      if (view.model[attr]) {
        view.model[attr](val)
      } else {
        return
      }

      setUIDepartArriveByButtonsActive(view)

      var t = getUIDateTime()
      var moment_t = moment(t)
      var hour = t.hour(),
          min = t.minute(),
          arriveBy = val

      var emit_dat = {
        'date': moment_t.format('MM:DD:YYYY'),
        'hour': hour,
        'minute': min,
        'arriveBy': arriveBy
      }

      // console.log('emitting "active" event, setting "hour" to '+emit_dat['hour'] + ' and "arriveBy" to '+emit_dat['arriveBy'])
      view.emit('active', 'hour', emit_dat['hour'])
      view.emit('active', 'arriveBy', emit_dat['arriveBy'])
    })
  })
}

/**
 * Produce human readable output
 * @param m
 * @returns {string}
 */
function minutesToHumanTime(m) {
  var hours, minutes, ampm;
  hours = Math.floor(m / 60);
  minutes = m % 60;
  if (minutes < 10) {
    minutes = '0' + minutes; // adding leading zero
  }
  ampm = hours % 24 < 12 ? 'am' : 'pm';
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  return hours + ':' + minutes + ' ' + ampm
}

/**
 * ISO 8601 to Human readable format
 * @param iso_string
 */
function isoDateToHumanTime(iso_string) {
  return moment(iso_string).format('h:mm a')
}

/**
 * Datepicker Moment to ISO 8601
 * @param m
 */
function momentToIsoDate(m) {
  return m.format()
}

/**
 * Human readable time to Datepicker Moment
 * @param t
 * @returns {*}
 */
function humanTimeToMoment(t) {
  return moment(t, ['h:m a', 'H:m'])
}

/**
 * Find closest time to now
 * @param t
 */
function selectClosestTimeOption(t) {
  var m_t = moment(t)
  var m = m_t.minute()
  // m_t.minute(m === 0 ? 0 : m <= 15 ? 15 : m <= 30 ? 30 : m <= 45 ? 45 : 60)  // next 15 minutes
   m_t.minute(m === 0 ? 0 : m <= 30 ? 30 : 60)  // next 30 minutes
  var h = '' + m_t.hour()
  m = '' + m_t.minute()

  var time_opts = $('.times_list_wrapper span')
  time_opts.removeClass('selected')
  for (var i = time_opts.length - 1; i >= 0; i--) {
    var elem = time_opts[i]
    if (elem.dataset.hour === h && elem.dataset.minute === m) {
      $(elem).addClass('selected')
    }
  }
}
/**
 * @todo write test cases and  create matrix to verify these work...
 * @date 2017-10-24
 */
function selectPreviousTimeOption() {
  var current = $('.times_list_wrapper span.selected')
  var previous = current.prev()
  current.removeClass('selected')
  previous.addClass('selected')
  scrollToSelected()
  return previous[0].dataset.value
}

function selectNextTimeOption() {
  var current = $('.times_list_wrapper span.selected')
  var next = current.next()
  current.removeClass('selected')
  next.addClass('selected')
  scrollToSelected()
  return next[0].dataset.value
}

function scrollToSelected() {
  // scroll to the time that's currently selected
  var selected_elem = $('.times_list_wrapper span.selected')
  var parent_height = selected_elem.parent().height()
  var abs_top = (selected_elem.height() * selected_elem.index()) - (selected_elem.height() * 2)
  $('.times_list_wrapper')[0].scrollTop = abs_top
}

/**
 * Create time options
 * @see http://stackoverflow.com/a/22709868/940217
 * @param view
 * @returns {Function|*|jQuery}
 */
function makeTimeDDL(view) {

  var time_ddl_wrapper = $('<div/>').attr({
    'class': 'time_picker_wrapper input-group time filter-group'
  });

  var v = view;

  var blurAction = function(){
    if (time_ddl_wrapper.hasClass('active')){
      if (time_input[0].dataset.time) {
        time_input.val(isoDateToHumanTime(time_input[0].dataset.time));
        selectClosestTimeOption(time_input[0].dataset.time);
        var selected_moment = moment(time_input[0].dataset.time);

        var hour = selected_moment.hour(),
          min = selected_moment.minute();

        if (hour === view.model.hour() &&
          min === view.model.minute()) {
          // time hasn't changed, don't hit the server.
          return;
        }

        var newModelAttrs = [{
          key: 'minute',
          value: min
        }, {
          key: 'hour',
          value: hour
        }];
          // update each of the models w/ their new values
        newModelAttrs.forEach(function(attr) {
          if (view.model[attr.key]) {
            view.model[attr.key](attr.value)
          }
        });
        view.emit('active', 'hour', hour)
      }
      time_ddl_wrapper.removeClass('active');
      $('.time_picker_wrapper .input-group-addon').removeClass('active')
    }
  };

  var times_list_wrapper = $('<div/>').attr({
    'class': 'times_list_wrapper',
    'aria-hidden': 'true',
    'aria-label': 'time options'
  }).appendTo(time_ddl_wrapper);

  var time_input = $('<input/>').attr({
    'type': 'text',
    'role': 'textbox',
    'class': 'form-control'
  }).focus(function() {
    if (!time_ddl_wrapper.hasClass('active')) {
      time_ddl_wrapper.addClass('active')
    }
    scrollToSelected()
  }).blur(function(e) {
    blurAction()
  }).keydown(function(e) {
  var selected_iso_time = null;
  switch (e.which) {
    case 38: // up
      selected_iso_time = selectPreviousTimeOption()
      this.dataset.time = selected_iso_time;
      break;

    case 40: // down
      selected_iso_time = selectNextTimeOption()
      this.dataset.time = selected_iso_time
      break;

    case 13: // enter
      this.blur();
      break;

    default:
      return; // exit this handler for other keys
  }
  e.preventDefault(); // prevent the default action (scroll / move caret)
}).change(function() {
  time_input[0].dataset.time = momentToIsoDate(humanTimeToMoment(time_input.val()))
}).appendTo(time_ddl_wrapper)


$('<span class="input-group-addon"><i class="fa fa-clock-o time-dl-btn" aria-hidden="true"></i></span>')
  .mouseup(function() {
    var $this = $(this);
    var pick_wrapper = $('.time_picker_wrapper');
    if ($this.hasClass('active') && pick_wrapper.hasClass('active')) {
      // the button has been clicked and the picker is open
      pick_wrapper.removeClass('active');
      $this.removeClass('active');
      time_input.blur()
    } else if ($this.hasClass('active') && !pick_wrapper.hasClass('active')) {
      // the button has been clicked and the picker is already closed
      $this.removeClass('active')
    } else if (!$this.hasClass('active') && !pick_wrapper.hasClass('active')) {
      // the button has been clicked and the picker is closed
      pick_wrapper.addClass('active');
      $this.addClass('active');
      time_input.focus()
    } else if (!$this.hasClass('active') && pick_wrapper.hasClass('active')) {
      // the button has been clicked and the picker is already open
      $this.addClass('active')
    }
  }).appendTo(time_ddl_wrapper);

  for (var i = 0; i < 1440; i += 30) {
    var mins = minutesToHumanTime(i);
    var time_span = $('<span/>')
      .text(mins)
      .on('touchstart mousedown', function(e) {
        console.log('clicked!', this);
        time_input[0].dataset.time = this.dataset.value;
        //time_input[0].blur()
        blurAction()
          // now the blur() event happens, updating the time.
      });
    var moment_t = humanTimeToMoment(mins);
    time_span[0].dataset.hour = moment_t.hour();
    time_span[0].dataset.minute = moment_t.minute();
    time_span[0].dataset.value = momentToIsoDate(moment_t);
    times_list_wrapper.append(time_span);
  }
  setTimeout(function() {
    var time_set_hour = v.model.hour();
    var time_set_min = v.model.minute();
    var m = moment();
    m.hour(time_set_hour);
    m.minute(time_set_min);
    time_input.val(isoDateToHumanTime(m.format()));
    time_input[0].dataset.time = m.format();
    selectClosestTimeOption(time_input[0].dataset.time)
  }, 50);

  return time_ddl_wrapper
}