#!/usr/bin/env bash
#
sudo killall -9 node
sleep 3
cp client/map/modeify.js assets/build/planner-app/ -v
make build-client
sleep 3
npm start
tail -f server.log
