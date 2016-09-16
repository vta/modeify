#!/usr/bin/env bash
rm server.log
touch server.log
sudo killall -9 node
npm start
