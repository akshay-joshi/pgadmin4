/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2020, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

const axios = require('axios');
const path = require('path');
const misc = require('../js/misc.js');
const spawn = require('child_process').spawn;

var pythonPath = '../../Workspace-3.8/bin/python';
var pgadminFile = '../web/pgAdmin4.py';

var pgadminServerProcess = null;
var startPageUrl = null;
var serverCheckUrl = null;

var serverPort = 5050;

// This function is used to create UUID
function createUUID(){
  var dt = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (dt + Math.random()*16)%16 | 0;
    dt = Math.floor(dt/16);
    return (c=='x' ? r :(r&0x3|0x8)).toString(16);
  });

  return uuid;
}

// This functions is used to start the pgAdmin4 server by spawning a
// separate process.
function startDesktopMode() {
  // Return if pgadmin server process is already spawned.
  if (pgadminServerProcess != null)
    return;

  var UUID = createUUID();
  // Set the environment variable so that pgAdmn 4 server
  // start listening on that port.
  process.env.PGADMIN_INT_PORT = serverPort;
  process.env.PGADMIN_INT_KEY = UUID;
  process.env.SERVER_MODE = false;

  // Start Page URL
  startPageUrl = 'http://127.0.0.1:' + serverPort + '/?key=' + UUID;
  serverCheckUrl = 'http://127.0.0.1:' + serverPort + '/misc/ping?key=' + UUID;

  document.getElementById('loader-text-status').innerHTML = 'Starting pgAdmin 4...';

  if (platform() == 'win32') {
    pythonPath = '../../Workspace-3.8/Scripts/python.exe';
    pythonPath = pythonPath.replace(/\//g, '\\\\');
    pgadminFile = pgadminFile.replace(/\//g, '\\\\');
  }

  // Write Python Path, pgAdmin file path and command in log file.
  var command = path.resolve(pythonPath) + ' ' + path.resolve(pgadminFile);
  misc.writeServerLog('PYTHON_PATH: "' + path.resolve(pythonPath) + '"');
  misc.writeServerLog('PGADMIN_FILE: "' + path.resolve(pgadminFile) + '"');
  misc.writeServerLog('PGADMIN_COMMAND: "' + command + '"');

  // Spawn the process to start pgAdmin4 server.
  pgadminServerProcess = spawn(pythonPath, [pgadminFile]);

  pgadminServerProcess.stdout.setEncoding('utf8');
  pgadminServerProcess.stdout.on('data', (chunk) => {
    misc.writeServerLog(chunk);
  });

  pgadminServerProcess.stderr.setEncoding('utf8');
  pgadminServerProcess.stderr.on('data', (chunk) => {
    misc.writeServerLog(chunk);
  });

  // This function is used to ping the pgAdmin4 server whether it
  // it is started or not.
  function pingServer() {
    return axios.get(serverCheckUrl);
  }

  var connectionTimeout = misc.ConfigureStore.get('connectionTimeout', 90) * 1000;
  var currentTime = (new Date).getTime();
  var endTime =  currentTime + connectionTimeout;
  var midTime1 = currentTime + (connectionTimeout/2);
  var midTime2 = currentTime + (connectionTimeout*2/3);
  var pingInProgress = false;

  // ping pgAdmin server every 1 second.
  var intervalID = setInterval(function() {
    // If ping request is already send and response is not
    // received no need to send another request.
    if (pingInProgress)
      return;

    pingServer().then(() => {
      pingInProgress = false;
      document.getElementById('loader-text-status').innerHTML = 'pgAdmin 4 started';
      clearInterval(intervalID);
      launchPgAdminWindow();
    }).catch(() => {
      pingInProgress = false;
      var curTime = (new Date).getTime();
      // if the connection timeout has lapsed then throw an error
      // and stop pinging the server.
      if (curTime >= endTime) {
        clearInterval(intervalID);
        splashWindow.hide();

        nw.Window.open('src/html/server_error.html', {
          'frame': true,
          'width': 790,
          'height': 385,
          'position': 'center',
          'resizable': false,
          'focus': true,
          'show': true,
        });
      }

      if (curTime > midTime1) {
        if(curTime < midTime2) {
          document.getElementById('loader-text-status').innerHTML = 'Taking longer than usual...';
        } else {
          document.getElementById('loader-text-status').innerHTML = 'Almost there...';
        }
      } else {
        document.getElementById('loader-text-status').innerHTML = 'Waiting for pgAdmin 4 to start...';
      }
    });

    pingInProgress = true;
  }, 1000);
}

// This function is used to hide the splash screen and create/launch
// new window to render pgAdmin4 page.
function launchPgAdminWindow() {
  // Create and launch new window and open pgAdmin url
  nw.Window.open(startPageUrl, {
    'icon': '../../assets/pgAdmin4.png',
    'frame': true,
    'width': 1300,
    'height': 900,
    'position': 'center',
    'resizable': true,
    'min_width': 400,
    'min_height': 200,
    'focus': true,
    'show': false,
  }, (pgadminWindow)=> {
    pgadminWindow.on('close', function() {
      // Clenup
      cleanup();

      // Closing the window
      pgadminWindow.close(true);
      pgadminWindow = null;

      // Quit Application
      nw.App.quit();
    });

    // set up handler for new-win-policy event.
    // Set the width and height for the new window.
    pgadminWindow.on('new-win-policy', function(frame, url, policy) {
      policy.setNewWindowManifest({
        'icon': '../../assets/pgAdmin4.png',
        'frame': true,
        'width': 1300,
        'height': 900,
        'position': 'center',
      });
    });

    pgadminWindow.on('loaded', function() {
      // Hide the splash screen
      splashWindow.hide();

      /* Make the new window opener to null as it is
       * nothing but a splash screen. We will have to make it null,
       * so that open in new browser tab will work.
       */
      pgadminWindow.window.opener = null;

      // Show new window
      pgadminWindow.show();
      pgadminWindow.focus();
    });
  });
}

// This function is used to kill the server process and
// remove the log files.
function cleanup() {
  // Remove the server log file on exit
  misc.removeLogFile();

  // Killing pgAdmin4 server process if application quits
  if (pgadminServerProcess != null) {
    try {
      process.kill(pgadminServerProcess.pid);
    }
    catch (e) {
      console.warn('Failed to kill server process.');
    }
  }
}

// Get the gui object of NW.js
var gui = require('nw.gui');
var splashWindow = gui.Window.get();

// Always clear the cache before starting the application.
nw.App.clearCache();

splashWindow.on('loaded', function() {
  // Initialize the ConfigureStore
  misc.ConfigureStore.init();

  var port = 0;
  var fixedPortCheck = misc.ConfigureStore.get('fixedPort', false);
  if (fixedPortCheck) {
    port = misc.ConfigureStore.get('portNo');
  }

  // get the available TCP port
  misc.getAvailablePort(port)
    .then((pythonApplicationPort) => {
      serverPort = pythonApplicationPort;
      //Start the pgAdmin in Desktop mode.
      startDesktopMode();
    })
    .catch((errCode) => {
      if (fixedPortCheck && errCode == 'EADDRINUSE') {
        alert('The specified fixed port is already in use. Please provide any other valid port.');
      } else {
        alert(errCode);
      }
    });
});

splashWindow.on('close', function() {
  cleanup();

  // Quit Application
  nw.App.quit();
});
