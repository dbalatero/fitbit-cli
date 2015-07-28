# Fitbit CLI!

Doesn't do much right now, but you can control a few things from the command
line:

* **Water**: You can get the current day's water via `fitbit water` or log water
* via `fitbit water <amount>`.
* **Steps**: Get total steps today via `fitbit steps`.
* **Alarms**: Get the current set of alarms via `fitbit alarms` or create a new alarm with something like `fitbit alarm create 07:30-07:00 --snoozeCount 2`.
* **API calls**: You can make an arbitrary api call like so: `fitbit api-call
* get /1/user/-/devices.json`

## Setup

You need to set the `FITBIT_CONSUMER_KEY` and `FITBIT_CONSUMER_SECRET`
environment variables to values you obtained from a [Fitbit
App](https://dev.fitbit.com/apps), which must be of type "desktop".

That's all for now! Pull requests very welcomed!!

