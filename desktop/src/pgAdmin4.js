/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2020, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

const axios = require('axios');
const DEFAULT_PORT = 5050;

var python_path = '../../Workspace-3.8/bin/python';
var pgadmin_file = '../web/pgAdmin4.py';

var pgadmin_server_process = null;
var spawn = require('child_process').spawn;
var server_port = DEFAULT_PORT;

// This function is used to get the random available TCP port
function getAvailablePort(fixed_port) {
  var net = require('net');
  var srv = net.createServer();
  var port = 0;

  if (fixed_port) {
    port = fixed_port;
  }

  srv.listen(port, function() {
    server_port = srv.address().port;
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
server_port = getAvailablePort();
var server_check_url = 'http://127.0.0.1:' + server_port + '/misc/ping';

// This functions is used to start the pgAdmin4 server by spawning a
// separate process.
function startDesktopMode() {
  // Return if pgadmin server process is already spawned.
  if (pgadmin_server_process != null)
    return;

  if (server_port == 0) {
    server_port = DEFAULT_PORT;
  }

  // Set the environment variable so that pgAdmn 4 server
  // start listening on that port.
  process.env.PGADMIN_INT_PORT = server_port;
  server_check_url = 'http://127.0.0.1:' + server_port + '/misc/ping';

  document.getElementById('loader-text-status').innerHTML = 'Starting pgAdmin server....';

  if (platform() == 'win32') {
    python_path = '../../Workspace-3.8/Scripts/python.exe';
    python_path = python_path.replace(/\//g, '\\\\');
    pgadmin_file = pgadmin_file.replace(/\//g, '\\\\');
  }

  // Spawn the process to start pgAdmin4 server.
  pgadmin_server_process = spawn(python_path, [pgadmin_file]);

  pgadmin_server_process.stdout.setEncoding('utf8');
  pgadmin_server_process.stdout.on('data', (chunk) => {
    console.warn(chunk);
  });

  pgadmin_server_process.stderr.setEncoding('utf8');
  pgadmin_server_process.stderr.on('data', (chunk) => {
    console.warn(chunk);
  });

  // This function is used to ping the pgAdmin4 server whether it
  // it is started or not.
  function pingServer() {
    return axios.get(server_check_url);
  }

  // ping pgAdmin server every 1 second.
  var int_id = setInterval(function() {
    pingServer().then(() => {
      document.getElementById('loader-text-status').innerHTML = 'pgAdmin server started';
      clearInterval(int_id);
      launchPgAdminWindow();
    }).catch(() => {
      document.getElementById('loader-text-status').innerHTML = 'Waiting for pgAdmin server to start...';
    });
  }, 1000);
}

// This function is used to hide the splash screen and create/launch
// new window to render pgAdmin4 page.
function launchPgAdminWindow() {
  var gui = require('nw.gui');
  // Get the current window
  var current_win = gui.Window.get();
  // Start Page URL
  var start_page_url = 'http://127.0.0.1:' + server_port + '/';

  // Create and lunch new window and open pgAdmin url
  nw.Window.open(start_page_url, {
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
  }, (new_win)=> {
    new_win.on('close', function() {
      // Killing pgAdmin4 server process if application quits
      if (pgadmin_server_process != null) {
        try {
          process.kill(pgadmin_server_process.pid);
        }
        catch (e) {
          console.warn('Failed to kill server process.');
        }
      }

      // Closing the window
      new_win.close(true);
      new_win = null;

      // Quit Application
      nw.App.quit();
    });

    // set up handler for new-win-policy event.
    // Set the width and height for the new window.
    new_win.on('new-win-policy', function(frame, url, policy) {
      policy.setNewWindowManifest({
        'width': 1300,
        'height': 900,
      });
    });

    new_win.on('loaded', function() {
      for (var outerIndex = 0; outerIndex < current_win.menu.items.length; outerIndex++) {
        if (current_win.menu.items[outerIndex].label == 'View') {
          var outer_obj = current_win.menu.items[outerIndex];
          for (var innerIndex = 0; innerIndex < outer_obj.submenu.items.length; innerIndex++) {
            if (outer_obj.submenu.items[innerIndex].label == 'Configure...' || outer_obj.submenu.items[innerIndex].label == 'View log...') {
              outer_obj.submenu.items[innerIndex].enabled = true;
            }
          }
        }
      }

      // Hide the splash screen
      current_win.hide();

      /* Make the new window opener to null as it is
       * nothing but a splash screen. We will have to make it null,
       * so that open in new browser tab will work.
       */
      new_win.window.opener = null;

      // Show new window
      new_win.show();
      new_win.focus();
    });
  });
}

// Get the gui object of NW.js
var gui = require('nw.gui');
var main_win = gui.Window.get();

// Always clear the cache before starting the application.
nw.App.clearCache();

main_win.on('loaded', function() {
  var main_menu = new nw.Menu({ type: 'menubar' });
  if (platform() == 'darwin') {
    main_menu.createMacBuiltin('pgAdmin 4');

    // Create a new menu
    var view_menu = new nw.Menu();

    // Append Configure menu.
    view_menu.append(new nw.MenuItem({
      label: 'Configure...',
      enabled: false,
      click: function() {
        // Create and lunch new window and open pgAdmin url
        nw.Window.open('src/configure.html', {
          'frame': true,
          'width': 600,
          'height': 208,
          'position': 'center',
          'resizable': false,
          'focus': true,
          'show': true,
        }, (config_win)=> {
          config_win.on('loaded', function() {
            console.warn('Configure Window Loaded.');
          });
        });
      },
    }));

    // Append View log menu.
    view_menu.append(new nw.MenuItem({
      label: 'View log...',
      enabled: false,
      click: function() {
        // Create and lunch new window and open pgAdmin url
        nw.Window.open('src/view_log.html', {
          'frame': true,
          'width': 790,
          'height': 425,
          'position': 'center',
          'resizable': false,
          'focus': true,
          'show': true,
        }, (log_win)=> {
          log_win.on('loaded', function() {
            console.warn('View Log Window Loaded.');
          });
        });
      },
    }));

    // Append separator.
    view_menu.append(new nw.MenuItem({ type: 'separator' }));

    main_menu.insert(new nw.MenuItem({
      label: 'View',
      submenu: view_menu,
    }), 1);

    nw.Window.get().menu = main_menu;
  } else {
    console.warn('Windows and Linux Menu.');
  }

  //Start the pgAdmin in Desktop mode.
  startDesktopMode();
});

main_win.on('close', function() {
  // Killing pgAdmin4 server process if application quits
  if (pgadmin_server_process != null) {
    try {
      process.kill(pgadmin_server_process.pid);
    }
    catch (e) {
      console.warn('Failed to kill server process.');
    }
  }
});
