/**
 * Bind event
 */

var evnt = require('event')
var ua = require('user-agent');

var is_mobile = (ua.os.name === 'Android' || ua.os.name === 'iOS');

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

function getArriveBy(view) {
  return Boolean(getModel(view, 'arriveBy'))
}

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
    console.log('date changed to ', selected_date)
    time = moment(selected_date)
  } else {
    time = moment(selected_date);
  }
  return time
}

function setUIDepartArriveByButtonsActive(view){
  var arriveBy = getArriveBy(view)
  // window.console.log('setUIDepartArriveByButtonsActive : '+arriveBy)
  $('label input[data-arrive-by]').parent().removeClass('active')
  $('label input[data-arrive-by="'+arriveBy+'"]').parent().addClass('active')
}

function initDesktopPicker(view, el){
  console.log('initDesktopPicker')
  picker = $(el).datetimepicker({
      defaultDate: new Date(),
      collapse: false,
      format: false,
      widgetPositioning: { horizontal: 'right' }
    }).on('dp.hide', function (e) {
      // when the datetimepicker is closed, update models with current dates and emit event
      e.stopPropagation()
      $('#main').off('mouseup')
      var time = picker.setTime(e.date)
      view.emit('active', 'days', time.day)
      view.emit('active', time.endOrStartTime, time.hour)
    })

    var picker_input = $(el).find('input');
    picker_input.on('blur', function(){
      var val = picker_input.val()
      if (!val || val.length < 1){
        return;
      }
      var selected_date = new Date(val)
      console.log('date changed to ', selected_date)
      var time = picker.setTime(moment(selected_date))
      console.log('firing "active" event for days:'+time.day+' and endOrStartTime:'+time.endOrStartTime+', hour:'+time.hour())
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
    var val = dtp.val()
    if (!val || val.length < 1){
      return;
    }
    var time = getUIDateTime()
    console.log('date changed to ', time)

    var arrive_by_active_btn = $('.arrive-depart-btns .active input')
    var arrive_by_value = arrive_by_active_btn[0].getAttribute('data-arrive-by') === 'true'

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
    view.emit('active', arrive_by_value, time.hour())
  });

  $(el).find('.input-group-addon').bind('click touchend', function(e){
    dtp.focus();  // cause the datetime-local input to open on iOS
  })
  return dtp
}



/**
 * Expose `plugin`
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

    evnt.bind(el, 'click', function (e) {
      e.stopPropagation()

      // console.log('arrive or depart was clicked', e)

      var el = e.target
      var val = el.getAttribute('data-arrive-by') === 'true'
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
    
      document.activeElement.blur()
    })
  })
}
