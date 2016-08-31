/**
 * Bind event
 */

var evnt = require('event')
var ua = require('user-agent');
/**
 * Utils
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

function getModel (view, attr) {
  if (view[attr]) {
    return view[attr]()
  } else if (view.model[attr]) {
    return view.model[attr]()
  } else {
    return
  }
}

function getEndOrStartTime (view) {
  return getModel(view, 'arriveBy') ? 'end_time' : 'start_time'
}

/**
 * Expose `plugin`
 */

module.exports.plugin = function (reactive) {
  reactive.bind('data-date-time', function (el, name) {
    var view = this.reactive.view, picker

    //if (ua.os.name === 'Android' || ua.os.name === 'iOS' ){
    if (true){
     // $(el).find('input').attr('disabled',true)
     $(el).find('input').attr('type','datetime-local')
     console.log('mobile!')
    }

    // picker is extracted as a separate method so that it can be accessed elsewhere in app (planner-page)
    picker = module.exports.picker = $(el).datetimepicker({
      // allowInputToggle: true,
      defaultDate: new Date(),
      // focusOnShow: false,
      // ignoreReadonly: true,
      format: (true ? 'LT' : false), // TODO: make it true if on mobile
      widgetPositioning: { horizontal: 'right' }
    }).on('dp.hide', function (e) {
      // when the datetimepicker is closed, update models with current dates and emit event
      e.stopPropagation()
      $('#main').off('mouseup')
      var time = picker.setTime(e.date)
      view.emit('active', 'days', time.day)
      view.emit('active', time.endOrStartTime, time.hour)
    }).on('dp.show', function (e) {
      // if a touch/click is detected outside of the datetime picker, close it.
      // window.setTimeout(function () {
      //  $('#main').on('mouseup', function (e) {
      //    var container = $('.bootstrap-datetimepicker-widget ul')
      //    var is_open = container.is(':visible')
      //    if (!is_open) {
      //      return
      //    }
      //    if (!container.is(e.target) // if the target of the click isn't the container...
      //      && container.has(e.target).length === 0) // ... nor a descendant of the container
      //    {
      //      picker.find('.input-group-addon').click(); // lulz, wut? at least it works.
      //    }
      //  })
      // }, 90)
    })

    $.extend(picker, {
      generateMoment: function () {
        // used to convert model values – used by otp – into moment obj understood by datetimepicker
        var startOrEnd = getEndOrStartTime(view),
          date = getModel(view, 'date'),
          hour = getModel(view, startOrEnd),
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
          endOrStartTime = getEndOrStartTime(view)

        var newModelAttrs = [
          { key: 'days', value: day },
          { key: 'date', value: moment.format('MM:DD:YYYY') },
          { key: 'minute', value: min },
          { key: endOrStartTime, value: hour }
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

        // set datetimepicker value
        this.data('DateTimePicker').date(moment)

        // return these model values so they can be emitted as events and page refreshed
        return {
          day: day,
          hour: hour,
          endOrStartTime: endOrStartTime
        }
      }
    })
  })

  reactive.bind('data-arrive-by', function (el, name) {
    var view = this.reactive.view

    evnt.bind(el, 'click', function (e) {
      e.stopPropagation()

      var el = e.target
      var val = el.getAttribute('data-arrive-by')
      var attr = 'arriveBy'

      while (el && (val === undefined || val === null)) {
        el = el.parentNode
        val = el && el.getAttribute('data-arrive-by')
      }

      var boolVal = (val === 'true')
      if (view.model[attr]) {
        view.model[attr](boolVal)
      } else {
        return
      }

      $('div[data-toggle="buttons"] label').removeClass('active')
      $(el).parent().addClass('active')

      // emit active on
      view.emit('active', attr, boolVal)

      document.activeElement.blur()
    })
  })
}
