/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2020, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

const misc = require('../js/misc.js');

// Get the window object of server error window
var gui = require('nw.gui');
var error_win = gui.Window.get();

error_win.on('loaded', function() {
  document.getElementById('server_error_label').innerHTML = 'The pgAdmin 4 server could not be contacted:';
  document.getElementById('server_error_log').innerHTML = misc.readFile(misc.server_log_file);
});
