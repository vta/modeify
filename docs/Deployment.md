# Deployment

The easiest way to deploy **modified-tripplanner** is to use [Docker](https://www.docker.com/).
The [tripplanner-docker](https://github.com/amigocloud/tripplanner-docker "Docker setup") project includes Docker configuration files for **tripplanner**, **otp**, and **nginx** containers.

**tripplanner** container:
 
- Install [Node.JS](https://nodejs.org), [NPM](https://www.npmjs.com/), and [MongoDB](https://www.mongodb.com/).
- Clone [**modified-tripplanner**](https://github.com/amigocloud/tripplanner-docker).
- Copy [config.yaml](/docs/config.yaml.md) - the main configuration file for the tripplanner. It has all the URLs and API keys for external services. 

**otp** container:

- Install **Java 8**.
- Install prebuilt binary of [Open Trip Planner](http://www.opentripplanner.org/).
- Clone [GTFS Manager](https://github.com/amigocloud/gtfs-manager) for merging GTFS updates.
- Configure a cron job for daily updates of the GTFS feeds.
- Copy **load_data.sh** - script that downloads OSM map data, and using [GTFS Manager](https://github.com/amigocloud/gtfs-manager) downloads, 
and merges GTFS feeds for all the involved transit agencies.

**nginx** container has configuration for Nginx server.