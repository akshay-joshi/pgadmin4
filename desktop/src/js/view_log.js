/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2020, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

const misc = require('../js/misc.js');

// Get the window object of view log window
var gui = require('nw.gui');
var logWindow = gui.Window.get();

logWindow.on('loaded', function() {
  document.getElementById('server_log_label').innerHTML = 'Server Log: ' + '(' + misc.serverLogFile + ')';
  document.getElementById('server_log').innerHTML = misc.readServerLog();
  document.getElementById('btnReload').addEventListener('click', function() {
    document.getElementById('server_log').innerHTML = misc.readServerLog();
  });
});
