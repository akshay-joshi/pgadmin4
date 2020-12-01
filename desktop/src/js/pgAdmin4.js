/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2020, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

const axios = require('axios');
const misc = require('../js/misc.js');

const DEFAULT_PORT = 5050;

var pythonPath = '../../Workspace-3.8/bin/python';
var pgadminFile = '../web/pgAdmin4.py';

var pgadminServerProcess = null;
var spawn = require('child_process').spawn;
var serverPort = DEFAULT_PORT;

// This function is used to get the random available TCP port
function getAvailablePort(fixedPort) {
  var net = require('net');
  var srv = net.createServer();
  var port = 0;

  if (fixedPort) {
    port = fixedPort;
  }

  srv.listen(port, function() {
    serverPort = srv.address().port;
    srv.close();
  });

  srv.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.warn('Port already in use.');
      setTimeout(() => {
        srv.close();
      }, 1000);
    }
  });
}

// get the available TCP port
serverPort = getAvailablePort();
var serverCheckUrl = 'http://127.0.0.1:' + serverPort + '/misc/ping';

// This functions is used to start the pgAdmin4 server by spawning a
// separate process.
function startDesktopMode() {
  // Return if pgadmin server process is already spawned.
  if (pgadminServerProcess != null)
    return;

  if (serverPort == 0) {
    serverPort = DEFAULT_PORT;
  }

  // Set the environment variable so that pgAdmn 4 server
  // start listening on that port.
  process.env.PGADMIN_INT_PORT = serverPort;
  serverCheckUrl = 'http://127.0.0.1:' + serverPort + '/misc/ping';

  document.getElementById('loader-text-status').innerHTML = 'Starting pgAdmin server....';

  if (platform() == 'win32') {
    pythonPath = '../../Workspace-3.8/Scripts/python.exe';
    pythonPath = pythonPath.replace(/\//g, '\\\\');
    pgadminFile = pgadminFile.replace(/\//g, '\\\\');
  }

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

  // TODO : Get the "ConnectionTimeout" from configuration.
  var connectionTimeout = misc.ConfigureStore.get('connectionTimeout', 90) * 1000;
  var currentTime = (new Date).getTime();
  var endTime =  currentTime + connectionTimeout;
  var midTime1 = currentTime + (connectionTimeout/2);
  var midTime2 = currentTime + (connectionTimeout*2/3);

  // ping pgAdmin server every 1 second.
  var intervalID = setInterval(function() {
    pingServer().then(() => {
      document.getElementById('loader-text-status').innerHTML = 'pgAdmin server started';
      clearInterval(intervalID);
      launchPgAdminWindow();
    }).catch(() => {
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
        // Enable menu items
        enableMenu(splashWindow);

        if(curTime < midTime2) {
          document.getElementById('loader-text-status').innerHTML = 'Taking longer than usual...';
        } else {
          document.getElementById('loader-text-status').innerHTML = 'Almost there...';
        }
      } else {
        document.getElementById('loader-text-status').innerHTML = 'Waiting for pgAdmin server to start...';
      }
    });
  }, 1000);
}

// This function is used to hide the splash screen and create/launch
// new window to render pgAdmin4 page.
function launchPgAdminWindow() {
  // Start Page URL
  var startPageUrl = 'http://127.0.0.1:' + serverPort + '/';

  // Create and launch new window and open pgAdmin url
  nw.Window.open(startPageUrl, {
    'icon': '../assets/pgAdmin4.png',
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
        'width': 1300,
        'height': 900,
      });
    });

    pgadminWindow.on('loaded', function() {
      // Enable menu items
      enableMenu(splashWindow);

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

// This function is used to enable the configure and view log menu
function enableMenu(currWindow) {
  for (var outerIndex = 0; outerIndex < currWindow.menu.items.length; outerIndex++) {
    if (currWindow.menu.items[outerIndex].label == 'View') {
      var outer_obj = currWindow.menu.items[outerIndex];
      for (var innerIndex = 0; innerIndex < outer_obj.submenu.items.length; innerIndex++) {
        if (outer_obj.submenu.items[innerIndex].label == 'Configure...' || outer_obj.submenu.items[innerIndex].label == 'View log...') {
          outer_obj.submenu.items[innerIndex].enabled = true;
        }
      }
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

  var mainMenu = new nw.Menu({ type: 'menubar' });
  if (platform() == 'darwin') {
    mainMenu.createMacBuiltin('pgAdmin 4');

    // Create a new menu
    var viewMenu = new nw.Menu();

    // Append Configure menu.
    viewMenu.append(new nw.MenuItem({
      label: 'Configure...',
      enabled: false,
      click: function() {
        // Create and launch new window and open pgAdmin url
        nw.Window.open('src/html/configure.html', {
          'frame': true,
          'width': 600,
          'height': 356,
          'position': 'center',
          'resizable': false,
          'focus': true,
          'show': true,
        });
      },
    }));

    // Append View log menu.
    viewMenu.append(new nw.MenuItem({
      label: 'View log...',
      enabled: false,
      click: function() {
        // Create and launch new window and open pgAdmin url
        nw.Window.open('src/html/view_log.html', {
          'frame': true,
          'width': 790,
          'height': 425,
          'position': 'center',
          'resizable': false,
          'focus': true,
          'show': true,
        });
      },
    }));

    // Append separator.
    viewMenu.append(new nw.MenuItem({ type: 'separator' }));

    mainMenu.insert(new nw.MenuItem({
      label: 'View',
      submenu: viewMenu,
    }), 1);

    nw.Window.get().menu = mainMenu;
  } else {
    console.warn('Windows and Linux Menu.');
  }

  //Start the pgAdmin in Desktop mode.
  startDesktopMode();
});

splashWindow.on('close', function() {
  cleanup();

  // Quit Application
  nw.App.quit();
});
