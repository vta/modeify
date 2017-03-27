var superagent = require('superagent');
var express = require('express');

var TRANSITIME = 'http://api.transitime.org/api/v1/key/5ec0de94/agency/vta/command/';

var TRANSITIME_A = 'http://api.transitime.org/api/v1/key/5ec0de94/agency/'
var TRANSITIME_B = '/command/'


var router = module.exports = express.Router();

function handleRequest(queryData, url, agencyId, callback) {
    var query = queryData;
    var agency = 'vta';

    if (agencyId == 'VTA') {
        agency = 'vta';
     }

    if (agencyId == 'SFMTA') {
        agency = 'sfmta';
    }

    if (agencyId == 'BART') {
        agency = 'bart';
    }

    if (agencyId == 'AC Transit') {
        agency = 'actransit';
    }


    superagent
        .get(TRANSITIME_A + agency + TRANSITIME_B + url)
        .query(query)
        .end(function (err, res) {
            if (err) {
                callback(err, res);
            } else {
                var body = parseResponse(res, callback);
                callback(null, body);
            }
        });
};

function parseResponse(res, callback) {
    try {
        return JSON.parse(res.text);
    } catch (e) {
        callback(e);
    }
}

router.get('/routeDetails', function (req, res) {
    handleRequest(req.query, 'routesDetails', req.query.agency, function (err, response) {
        if (err) {
            console.error(err);
            res.status(400).send(err);
        } else {
            res.status(200).send(response);
        }
    });
});

router.get('/vehiclesDetails', function (req, res) {
    handleRequest(req.query, 'vehiclesDetails', req.query.agency, function (err, response) {
        if (err) {
            console.error(err);
            res.status(400).send(err);
        } else {
            res.status(200).send(response);
        }
    });
});

router.get('/predictions', function (req, res) {
    handleRequest(req.query, 'predictions', req.query.agency, function (err, response) {
        if (err) {
            console.error(err);
            res.status(400).send(err);
        } else {
            res.status(200).send(response);
        }
    });
});

