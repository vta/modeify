var analytics = require('analytics');
var d3 = require('d3');
var config = require('config');
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
var optionsView = require('options-view');
//var transitive = require('transitive');
var view = require('view');
var mapView = require('map-view');
/**
 * Expose `View`
 */

var View = module.exports = view(require('./template.html'), function (view, model) 
{
    view.isSelected = false;
    view.mouseenter = function () {
        if (optionsView.lastCardSelected && optionsView.lastCardSelected.model.index !== view.model.index) {
            return;
        }
        //clearTimeout();
        var itineration = JSON.parse(sessionStorage.getItem('itineration'));
        for (var i = 0; i < itineration.length; i++) {
            var r3 = d3.selectAll(".iteration-" + i);
            if (i != model.index) {
                if (config.map_provider() === 'AmigoCloud') {
                    r3.transition().duration(500).style("stroke", "#E0E0E0");
                } else {
                    r3.classed("hideMe", true);
                }
                r3.attr("data-show", "0");

                var rec2 = d3.selectAll(".circle-fade-" + i);
                rec2.attr('class', 'leaflet-marker-icon leaflet-div-icon2 circle-fade-' + i + ' leaflet-zoom-hide');
            } else {
                if (config.map_provider() !== 'AmigoCloud')
                {
                    r3.classed("hideMe", false);
                }
                r3.attr("data-show", "1");
            }
        }

        var orden = 0;
        d3.selectAll(".iteration-200").each(function (e) {
            var element = d3.select(this);
            var parent = d3.select(element.node().parentNode);
            parent.attr("class", "g-element");
            parent.attr("data-orden", orden.toString());
            if (Boolean(parseInt(element.attr("data-show")))) {
                parent.attr("data-show", "1");
            } else {
                parent.attr("data-show", "0");
            }

            orden++;
        });


        d3.selectAll(".g-element").each(function (a, b) {
            if (Boolean(parseInt(d3.select(this).attr("data-show")))) {
                d3.select(this).node().parentNode.appendChild(this);
            }
        });

    };

    mouseenter(view.el, view.mouseenter);

    view.mouseleave = function () {
        if (view.isSelected) {
            return;
        }

        if (optionsView.lastCardSelected && optionsView.lastCardSelected.model.index !== view.model.index) {
            return;
        }

        var itineration = JSON.parse(sessionStorage.getItem('itineration'));
        for (var i = 0; i < itineration.length; i++) {
            var rec2 = d3.selectAll(".circle-fade-" + i);
            rec2.attr('class', 'leaflet-marker-icon leaflet-div-icon1 circle-fade-' + i + ' leaflet-zoom-hide');
        }

        var layer_ordenados = [];
        d3.selectAll(".g-element").each(function (a, b) {
            var orden = parseInt(d3.select(this).attr("data-orden"));
            layer_ordenados[orden] = this;

        });

        for (i in layer_ordenados) {
            var element = d3.select(layer_ordenados[i]);
            var child = element.select("path");
            element.attr("data-show", "1");

            child.transition().duration(500).style("stroke", function (i, v) {
                return d3.select(this).attr("stroke");

            });
            child.attr("data-show", "1");
            setTimeout(function () {
                element.node().parentNode.appendChild(layer_ordenados[i]);
            }, 500);
        }
    };
    mouseleave(view.el, view.mouseleave);
    
    setTimeout(function()
    {
        L.modeify.map.zoomScale = L.modeify.map.getZoom() - 0.25;
        L.modeify.map.centerScale = L.modeify.map.getCenter();
    }, 1000);
    
    setTimeout(function()
    {
        displayFirst(view, model);
    }, 50);
});
/* The purpose of this is to display the best route (1st in list)
 * When the route / plans first load rather than showing all three routes
 * at the same time
*/
var displayFirst = View.prototype.displayFirst = function(view, model) 
{
    // gather number of total possible routes
    var itineration = JSON.parse(sessionStorage.getItem('itineration'));
    // loop through the routes hiding all but the first
    for (var i = 0; i < itineration.length; i++) 
    {
        // make sure it is the first route
        if (i != 0)
        {
            var r3 = d3.selectAll(".iteration-" + i);
            r3.classed("hideMe", true);
            r3.attr("data-show", "0");
        }
    }
    var r3 = d3.selectAll(".iteration-0");

    if (config.map_provider() !== 'AmigoCloud') r3.classed("hideMe", false);
    r3.attr("data-show", "1");
    // show the first route
    var orden = 0;
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

showTip = function(t)
{
    $(t).find("span").css("visibility","visible");
}

hideTip = function(t)
{
    $(t).find("span").css("visibility","hidden");
}



View.prototype.calculator = function () {
    return new Calculator(this.model);
};

View.prototype.directions = function () {
    return new RouteDirections(this.model);
};

View.prototype.segments = function () {
    return routeSummarySegments(this.model);
};

View.prototype.costSavings = function () {
    return convert.roundNumberToString(this.model.costSavings());
};

View.prototype.timeSavingsAndNoCostSavings = function () {
    return this.model.timeSavings() && !this.model.costSavings();
};

View.prototype.selectRoute = function (e) {
    var el = $(e.target).closest('li'),
        routes = $(el).closest('ul').find('li');
    e.preventDefault();

    if ($(routes).hasClass('route-selected')) {
        this.mouseleave();
    }

    if ($(el).hasClass('route-selected')) {
        $(el).removeClass('route-selected');
    } else {
        $(routes).removeClass('route-selected');
        $(el).addClass('route-selected');
        this.mouseenter();
    }
};
View.prototype.isIE = function()
{
    if (document.documentMode || /Edge/.test(navigator.userAgent)) 
    {
        return true
    }
    else return false;
}
View.prototype.isSafari = function()
{
    if (navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1)
    {
        return true;
    }
    else return false;
};
View.prototype.openPrintPage = function(t, d)
{
    L.print_window.document.body.innerHTML = '';
    L.print_window.document.write(
        '<html>'
        + '<head>'
        + '<title>' + document.title + '</title>'
        + '<link href="assets/build/planner-app/build.css" rel="stylesheet">'
        + '<link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css" rel="stylesheet">'
        + '<style>'
        + 'body { max-width:980px; margin:0 auto; padding: 0 0 50px 0; }'
        + 'div.simple.clearfix, div.benefits-badge, div.header, div.feedback { display:none; }'
        + 'p.p_d_title { text-align: center; font-size: 18px; padding: 20px 0 0 0; }'
        + '@media print { * { -webkit-print-color-adjust: exact; } }'
        + 'div.mapBody { width: 100%; min-width: 640px; max-width: 980px; height:450px; padding: 15px 0; }'
        + 'div.mapBody > img { position:relative; max-width: 100%; min-width: 640px; width:100%; height: 450px; }'
        + 'form.RouteCostCalculator { height: 10px !important; padding: 0 !important; background-color: rgba(0,0,0,0) !important; border: none !important; }'
        //+ 'div#map { transform: scaleX(0.6) scaleY(0.4) !important; }'
        + '</style>'
        + '</head>'
        + '<body>'
        + '<p class="p_d_title">'
        + "VTA Trip Planner : " + t.find(".header").html() + " - "
        + t.find("div.startstoptimes").html() + " - "
        + t.find("div.minutes-column > div.heading").html()
        + '</p>'
        + d
        + t.html()
        + '</body>'
        + '</html>');
    setTimeout(function () {
        L.print_window.document.close(); // necessary for IE >= 10
        L.print_window.focus(); // necessary for IE >= 10*/
        L.print_window.print();
        //L.print_window.close();
    }, 1500);
};

/* Print the route which the customer has selected to use
 * Creates a "snapshot" of the route on the map and inserts
 * Above turn by turn directions using canvas
*/
View.prototype.shareDetails = function(e)
{
     L.lastCardSelected = this;
     copyToClipboardPopup();
}


View.prototype.printDetails = function(e)
{
    var _this = this;
    if (optionsView.lastCardSelected && optionsView.lastCardSelected.model.index !== this.model.index)
    {
        optionsView.lastCardSelected.isSelected = false;
        optionsView.lastCardSelected.mouseleave();
        optionsView.lastCardSelected.hideDetails(e);
        this.mouseenter();
    }
    var t = $(this.el);
    // adjust to perfect zoom scale when printing the map
    // make sure the map is centered before zooming in / out
    L.modeify.map.panTo(L.modeify.map.centerScale);
    // give a small delay to allow centering before setting the zoom
    
    if ($.browser.mozilla || this.isSafari() || this.isIE())
    {
        $("div#map").css({"height":"450px", "width":"980px"});
        if ($("div.dummyMap")) $("div.dummyMap").remove();
        $("body").prepend(
            "<div class='dummyMap'>"
            +"</div>"
        );
        // hide details / real-time tracking before print
        var hide = t.find("button.hide-details");
        if (hide.is(":visible")) hide.trigger("click");
        // Clear any existing timeouts from previous print
        if (L.print_to_main) clearTimeout(L.print_to_main);
        if (L.print_to1) clearTimeout(L.print_to1);
        if (L.print_to2) clearTimeout(L.print_to2);
        if (L.print_to3) clearTimeout(L.print_to3);
        L.print_to_main = setTimeout(function() 
        { 
            _this.mouseenter();
            $("div.dummyMap").append("<div style='margin:0 auto; width:980px;'><div class='closeDummyMap'><span>Close</span></div>");
            $("div.closeDummyMap").bind("click", _this.resetAfterDummy);
            L.modeify.map.invalidateSize();
            L.modeify.map.setZoom(L.modeify.map.zoomScale - 1.3);
            L.print_to1 = setTimeout(function() 
            { 
                var dm = $("div.dummyMap > div");
                dm.append('<p class="p_d_title">'
                    + "VTA Trip Planner : " + t.find(".header").html() + " - "
                    + t.find("div.startstoptimes").html() + " - "
                    + t.find("div.minutes-column > div.heading").html()
                    + '</p>');
                dm.append($("#map").clone());
                var tt = t.clone();
                tt.find("div.simple.clearfix, div.benefits-badge, div.header, div.feedback, div.leaflet-control-container").remove();
                tt.parent().find("a").text("");
                dm.append(tt.html());
                $("body").children().not("div.dummyMap").hide();
                window.print();
                if (!_this.isSafari() && !_this.isIE()) _this.resetAfterDummy();
                
            }, 800);
        
        }, 500);
    }
    // if the browser supports printing images of map (chrome / opera)
    else
    {
        L.print_window = window.open('', 'PRINT', 'scrollbars=1, resizable=1, toolbar=1, height='+screen.height+', width='+screen.width);
        L.print_window.document.write(
        "<style>"
        +"div.loadingP { position: relative; height: 100%; width: 100%; text-align: center; }"
        +"div.loadingP > span { position: relative; top: 35%; font-size: 32px; font-family: arial; }"
        +"</style>"
        +"<title>" + document.title + "</title>"
        +"<div class='loadingP'><span>Preparing route details...</span></div>");

        setTimeout(function() { L.modeify.map.setZoom(L.modeify.map.zoomScale); }, 500);
        // hide details / real-time tracking before print
        var hide = t.find("button.hide-details");
        if (hide.is(":visible")) hide.trigger("click");
        
        // give the user some time to re-load the tiles
        // after the zoom out / in has been initiated
        setTimeout(function()
        {
            _this.mouseenter();
            L.easyPrintPage.printMap("customMapSize", "current.png");
        }, 1500);
        L.modeify.map.on("easyPrint-finished", function ()
        {          
            L.modeify.map.off("easyPrint-finished");
            var d = "<div class='mapBody'>" + "<img src='" +  L.latestSnapshot + "' alt='map' />" + "</div>";
            _this.openPrintPage(t, d); 
        });
    }
};

View.prototype.resetAfterDummy = function()
{
    L.print_to2 = setTimeout(function() 
    { 
        $("div.dummyMap").remove();
        $("div#map").css({"height":"100%", "width":"100%"});
        L.print_to3 = setTimeout(function() 
        {  
            L.modeify.map.invalidateSize();
            L.modeify.map.setZoom(L.modeify.map.zoomScale);

        }, 400);
                    
        $("body").children().show();
    }, 500);
};

/**
 * Show/hide
 */

View.prototype.showDetails = function (e) 
{
    if (optionsView.lastCardSelected && optionsView.lastCardSelected.model.index !== this.model.index) 
    {
        optionsView.lastCardSelected.isSelected = false;
        optionsView.lastCardSelected.mouseleave();
        optionsView.lastCardSelected.hideDetails(e);
        this.mouseenter();
    }

    var isTouchScreen = 'ontouchstart' in window;
    if (isTouchScreen) {
        this.mouseenter();
    }

    var _this = this;
    optionsView.lastCardSelected = _this;
    L.lastCardSelected = _this;
    e.preventDefault();
    mapView.clearExistingRoutes();
    var el = this.el;
    
    var expanded = document.querySelector('.option.expanded');
    if (expanded) expanded.classList.remove('expanded');
    // expand the contents of the route
    el.classList.add('expanded');
    // send analytics report back that a user has viewed route details
    analytics.track('Expanded Route Details', {
        plan: session.plan().generateQuery(),
        route: {
            modes: this.model.modes(),
            summary: this.model.summary()
        }
    });

    var scrollable = document.querySelector('.scrollable');
    scrollable.scrollTop = el.offsetTop - 52;
    // select this as the route being used
    this.isSelected = true;
    mapView.mapRouteStops(this.model.attrs.plan.legs);
    mapView.activeMap.on('zoomend', function () {
        if (optionsView.lastCardSelected) {
            setTimeout(function () {
                optionsView.lastCardSelected.mouseenter();
            }, 0);
        }
    });
};

View.prototype.hideDetails = function (e) {
    optionsView.lastCardSelected = null;
    e.preventDefault();
    L.lastCardSelected = undefined;
    var isTouchScreen = 'ontouchstart' in window;
    if (isTouchScreen) {
        this.isSelected = false;
        this.mouseleave();
    }

    var list = this.el.classList;
    if (list.contains('expanded')) {
        list.remove('expanded');
    }

    this.isSelected = false;
    mapView.clearExistingRoutes();
};

/**
 * Get the option number for display purposes (1-based)
 */

View.prototype.optionNumber = function () {
    return this.model.index + 1;
};

/**
 * View
 */

View.prototype.feedback = function (e) {
    e.preventDefault();
    Feedback(this.model).show();
};

/**
 * Select this option
 */

View.prototype.selectOption = function () {
    var route = this.model;
    var plan = session.plan();
    var tags = route.tags(plan);

    analytics.send_ga({
        category: 'route-card',
        action: 'select route',
        label: JSON.stringify(tags),
        value: 1
    });
    routeResource.findByTags(tags, function (err, resources) {
        var routeModal = new RouteModal(route, null, {
            context: 'route-card',
            resources: resources
        });
        routeModal.show();
        routeModal.on('next', function () {
            routeModal.hide();
        });
    });
};
