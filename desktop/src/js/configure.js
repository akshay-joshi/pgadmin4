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
var config_win = gui.Window.get();

function saveConfiguration() {
  console.warn("Saved Configuration");
}

function onCheckChange() {
  if (this.checked) {
    document.getElementById('portNo').disabled = false;
  } else {
    document.getElementById('portNo').disabled = true;
  }
}

config_win.on('loaded', function() {
  document.getElementById('portNo').disabled = true;
  document.getElementById('btnSave').addEventListener('click', saveConfiguration);
  document.getElementById('fixedPortCheck').addEventListener('change', onCheckChange);
});
