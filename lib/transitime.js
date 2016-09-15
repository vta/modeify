var superagent = require('superagent');
var express = require('express');

var TRANSITIME = 'http://api.transitime.org/api/v1/key/5ec0de94/agency/vta/command/';

var router = module.exports = express.Router();

function handleRequest(queryData, url, callback) {
    var query = queryData;
    superagent
        .get(TRANSITIME + url)
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
    handleRequest(req.query, 'routesDetails', function (err, response) {
        if (err) {
            console.error(err);
            res.status(400).send(err);
        } else {
            res.status(200).send(response);
        }
    });
});

router.get('/vehiclesDetails', function (req, res) {
    handleRequest(req.query, 'vehiclesDetails', function (err, response) {
        if (err) {
            console.error(err);
            res.status(400).send(err);
        } else {
            res.status(200).send(response);
        }
    });
});

router.get('/predictions', function (req, res) {
    handleRequest(req.query, 'predictions', function (err, response) {
        if (err) {
            console.error(err);
            res.status(400).send(err);
        } else {
            res.status(200).send(response);
        }
    });
});

