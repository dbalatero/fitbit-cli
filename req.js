#!/usr/bin/env node

var qs = require('querystring');
var fs = require('fs');
var AUTH_FILE = process.env.HOME + '/.fitbit_auth.json';

var request = require('request');

var CONSUMER_KEY = process.env.FITBIT_CONSUMER_KEY;
var CONSUMER_SECRET = process.env.FITBIT_CONSUMER_SECRET;

var oauth = {
  callback: 'https://smurthas.com/callback/',
  consumer_key: CONSUMER_KEY,
  consumer_secret: CONSUMER_SECRET
};

var url = 'https://api.fitbit.com/oauth/request_token';

function doAuth(callback) {
  request.post({url:url, oauth:oauth}, function (e, r, body) {
    var req_data = qs.parse(body);
    var uri = 'https://api.fitbit.com/oauth/authenticate' +
      '?' + qs.stringify({oauth_token: req_data.oauth_token});

    console.log('Open', uri);

    var readline = require('readline');

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Paste in the PIN here:', function(answer) {
      rl.close();

      var oauth = {
        consumer_key: CONSUMER_KEY,
        consumer_secret: CONSUMER_SECRET,
        token: req_data.oauth_token,
        token_secret: req_data.oauth_token_secret,
        verifier: answer
      };

      var url = 'https://api.fitbit.com/oauth/access_token';
      request.post({url:url, oauth:oauth}, function (e, r, body) {
        console.error('e', e);
        console.error('body', qs.parse(body));
        callback(null, qs.parse(body));
      });
    });
  });
}

function readAuthFromFile(callback) {
  fs.readFile(AUTH_FILE, function(err, data) {
    if (err) {
      return callback(err, data);
    }

    try {
      data = JSON.parse(data);
    } catch(err) {
      return callback(err, data);
    }

    callback(null, data);
  });
}

function writeAuthToFile(auth, callback) {
  fs.writeFile(AUTH_FILE, JSON.stringify(auth, 2, 2), callback);
}

function getAuth(callback) {
  readAuthFromFile(function(err, auth) {
    if (!err && auth) {
      return callback(null, auth);
    }

    doAuth(function(err, perm_data) {
      if (!err && perm_data) {
        return writeAuthToFile(perm_data, function(err) {
          if (err) {
            console.error('err', err);
          }

          callback(null, perm_data);
        });
      }
    });
  });
}

function getOAuth(callback) {
  getAuth(function(err, perm_data) {
    var oauth = {
      consumer_key: CONSUMER_KEY,
      consumer_secret: CONSUMER_SECRET,
      token: perm_data.oauth_token,
      token_secret: perm_data.oauth_token_secret
    };
    callback(err, oauth);
  });
}

function apiCall(method, path, options, callback) {
  getOAuth(function(err, oauth) {
    method = method.toLowerCase();
    options.url = options.url || 'https://api.fitbit.com' + path;
    options.json = options.json || true;
    options.headers = options.headers || {};
    options.headers['Accept-Language'] = options.headers['Accept-Language'] || 'en_US';
    options.oauth = oauth;
    request[method](options, callback);
  });
}

function getDevices(callback) {
  apiCall('get', '/1/user/-/devices.json', {}, function(err, resp, body) {
    callback(err, body);
  });
}

function getTracker(callback) {
  getDevices(function(err, devices) {
    if (err || !(devices instanceof Array)) {
      return callback(err, devices);
    }

    var tracker;
    devices.forEach(function(device) {
      if (device.type === 'TRACKER') {
        tracker = device;
      }
    });

    callback(null, tracker);
  });
}

function getAlarms(callback) {
  getTracker(function(err, tracker) {
    if (err || !tracker) {
      return callback(err, tracker);
    }
    var deviceId = tracker.id;
    apiCall('get', '/1/user/-/devices/tracker/' + deviceId + '/alarms.json', {},
      function(err, resp, alarms) {
      if (err || !resp || !alarms) {
        return callback(err, alarms);
      }

      callback(null, alarms && alarms.trackerAlarms);
    });
  });
}

function createAlarm(options, callback) {
  getTracker(function(err, tracker) {
    if (err || !tracker) {
      return callback(err, tracker);
    }
    var deviceId = tracker.id;
    options = {
      form: options
    };
    var path = '/1/user/-/devices/tracker/' + deviceId + '/alarms.json';
    apiCall('post', path, options, function(err, resp, body) {
      callback(err, body);
    });
  });
}

function getWater(date, callback) {
  getOAuth(function(err, oauth) {
    var url = 'https://api.fitbit.com/1/user/-/foods/log/water/date/' + date +
      '.json';
    request.get({
      url:url,
      json: true,
      oauth: oauth,
      headers: {
        'Accept-Language': 'en_US'
      }
    }, function(e, r, body) {
      callback(e, body);
    });
  });
}

function logWater(amount, date, callback) {
  getOAuth(function(err, oauth) {
    var url = 'https://api.fitbit.com/1/user/-/foods/log/water.json';
    request.post({
      url:url,
      form: {
        amount: amount,
        date: date,
        unit: 'fl oz'
      },
      oauth: oauth,
      headers: {
        'Accept-Language': 'en_US'
      }
    }, function(e, r, body) {
      callback(err, body);
    });
  });
}

function getSteps(date, callback) {
  getOAuth(function(err, oauth) {
    var url = 'https://api.fitbit.com/1/user/-/activities/steps/date/' + date + '/1d.json';
    request.get({
      url:url,
      json: true,
      oauth: oauth,
      headers: {
        'Accept-Language': 'en_US'
      }
    }, function(e, r, body) {
      if (!body || err) {
        return callback(err, body);
      }
      var steps = body && body['activities-steps'] && body['activities-steps'][0] && body['activities-steps'][0].value;
      steps = parseInt(steps, 10);
      if (isNaN(steps)) {
        return callback(new Error('invalid steps value'));
      }
      callback(null, steps);
    });
  });
}

var date = new Date();
var year = date.getYear() + 1900;
var month = date.getMonth() + 1;
var day = date.getDate();

if (month < 10) {
  month = '0' + month;
}
date = year + '-' + month + '-' + day;


var argv = require('optimist').argv;

var category = argv._[0];
var amount = argv._[1];

if (category === 'steps') {
  getSteps(date, function(err, steps) {
    if (argv.d) {
      console.error('err', err);
      console.error('steps', steps);
    }
    if (!err && steps) {
      console.log(steps);
    }
  });
} else if (category === 'water') {
  if (amount) {
    amount = parseInt(amount, 10);
    if (argv.d) {
      console.error('amount', amount);
    }
    logWater(amount, date, function(err, body) {
      if (argv.d) {
        console.error('err', err);
        console.error('body', body);
      }
    });
  } else {
    getWater(date, function(err, body) {
      if (argv.d) {
        console.error('err', err);
        console.error('body', body);
      }
      if (!err && body && body.summary && body.summary.hasOwnProperty('water')) {
        console.log(body.summary.water);
      }
    });
  }
} else if (category === 'alarms') {
  if (amount === 'create') {
    var options = {
      time: argv._[2],
      enabled: true,
      recurring: false
    };
    for (var key in argv) {
      if (key === '_' || key === 'd') {
        continue;
      }
      options[key] = argv[key];
    }
    createAlarm(options, function(err, alarm) {
      if (err) {
        console.error(err);
      }
      console.log(JSON.stringify(alarm, 2, 2));
    });
  } else {
    getAlarms(function(err, alarms) {
      if (err) {
        console.error(err);
      }
      console.log(JSON.stringify(alarms, 2, 2));
    });
  }
} else if (category === 'tracker') {
  getTracker(function(err, tracker) {
    if (err) {
      console.error(err);
    }
    console.log(JSON.stringify(tracker, 2, 2));
  });
} else if (category === 'api-call') {
  apiCall(amount, argv._[2], {}, function(err, resp, body) {
    if (err) {
      console.error('Error:', resp && resp.statusCode, err);
    }
    console.log(resp && resp.statusCode);
    console.log(JSON.stringify(body, 2, 2));
  });
}

