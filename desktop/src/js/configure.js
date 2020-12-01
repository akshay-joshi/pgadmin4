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
var configWindow = gui.Window.get();

function saveConfiguration() {
  console.warn('Saved Configuration');
}

function onCheckChange() {
  if (this.checked) {
    document.getElementById('portNo').removeAttribute('disabled');
  } else {
    document.getElementById('portNo').setAttribute('disabled', 'disabled');
  }

  // Enable/Disable Save button
  enableDisableSaveButton();
}

function enableDisableSaveButton() {
  var configData = misc.ConfigureStore.getConfigData();

  if (configData['fixedPort'] != document.getElementById('fixedPortCheck').checked ||
      configData['portNo'] != document.getElementById('portNo').value ||
      configData['connectionTimeout'] != document.getElementById('timeOut').value) {
    document.getElementById('btnSave').removeAttribute('disabled');
  } else {
    document.getElementById('btnSave').setAttribute('disabled', 'disabled');
  }
}

configWindow.on('loaded', function() {
  // Get the config data from the file.
  var configData = misc.ConfigureStore.getConfigData();

  // Set the GUI value as per configuration.
  if (configData['fixedPort']) {
    document.getElementById('fixedPortCheck').checked = true;
    document.getElementById('portNo').disabled = false;
  } else {
    document.getElementById('fixedPortCheck').checked = false;
    document.getElementById('portNo').disabled = true; 
  }
  document.getElementById('portNo').value = configData['portNo'];
  document.getElementById('timeOut').value = configData['connectionTimeout'];

  // Add event listeners
  document.getElementById('btnSave').addEventListener('click', saveConfiguration);
  document.getElementById('fixedPortCheck').addEventListener('change', onCheckChange);
  document.getElementById('portNo').addEventListener('change', enableDisableSaveButton);
  document.getElementById('timeOut').addEventListener('change', enableDisableSaveButton);
});
