# Config.yaml

The global config file for tripplanner

Configuration description:

- **geocode** - defines startup parameters for center location, zoom of the map, and from and too addresses.
- **bing_key** - access key to access Bing APIs.
- **realtime_access_token** - token to access AmigoCloud APIs. Tokens can be generated [here](https://www.amigocloud.com/accounts/tokens).
- **realtime_dataset_url** - URL to AmigoCloud real-time dataset: 
```
    https://www.amigocloud.com/api/v1/users/<user id>/projects/<project id>/datasets/<dataset id>
```
- **support_data_token** - token to access AmigoCloud APIs.
- **bus_prediction_url** - URL to to AmigoCloud bus prediction dataset.
```
    https://www.amigocloud.com/api/v1/users/<user id>/projects/<project id>/datasets/<dataset id>
```
- **bus_routes_url** - URL to to AmigoCloud bus routes dataset.
```
    https://www.amigocloud.com/api/v1/users/<user id>/projects/<project id>/datasets/<dataset id>
```
- **query_interval** - time period to pull data from transitime, in miliseconds.
- **feedback_table_name** - name of the AmigoCloud feedback dataset table. Example: **dataset_xxxxxx**.
- **feedback_write_token** - token to access AmigoCloud APIs.
- **feedback_write_url** - URL to to AmigoCloud feedback dataset.
```
    https://www.amigocloud.com/api/v1/users/<user id>/projects/<project id>/datasets/<dataset id>/submit_change
```
- **mapbox_access_token** - access token to access MapBox APIs.
- **mapbox_map_id** - MapBox Id.

- **ignore_events_from** - Google analytics events will not be sent from this domain name. 
- **ga_key** - Google Analytics application key.
- **ac_key** - token to access AmigoCloud APIs.
- **ac_event_url** - URL to AmigoCloud dataset used for analytics events
```
    https://www.amigocloud.com/api/v1/users/<user id>/projects/<project id>/datasets/<dataset id>/submit_change
```
- **ac_event_table** - name of the AmigoCloud analytics dataset table. Example: **dataset_xxxxxx**.
