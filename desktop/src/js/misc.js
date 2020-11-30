/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2020, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

const fs = require('fs');
const path = require('path');
const {platform, homedir} = require('os');

// This function is used to get the app data path
// based on the platform.
const getAppDataPath = () => {
  var appDataPath = '';
  switch (platform()) {
  case 'win32':
    appDataPath = path.join(homedir(), 'AppData', 'Local');
    break;
  case 'darwin':
    appDataPath = path.join(homedir(), 'Library', 'Application Support');
    break;
  case 'linux':
    appDataPath = path.join(homedir(), '.local', 'share');
    break;
  default:
    if (platform().startsWith('win')) {
      appDataPath = path.join(homedir(), 'AppData', 'Local');
    } else {
      appDataPath = path.join(homedir(), '.local', 'share');
    }
  }

  return appDataPath;
};

// Get the app data folder path 
const current_time = (new Date()).getTime();
const server_log_file = getAppDataPath() + '/pgadmin4.' + current_time + '.log';

// This function is used to read the log file and return the content
const readLogFile = (file_name) => {
  var data = null;
  if (fs.existsSync(file_name)) {
    data = fs.readFileSync(file_name, 'utf8');
  } else {
    var err_msg = 'Unable to read file ' + file_name + ' not found.';
    console.warn(err_msg);
    return false, err_msg;
  }

  return true, data;
};

// This function is used to write the logs in the log file
const writeDataToLogFile = (file_name, data) => {
  if (fs.existsSync(file_name)) {
    fs.writeFileSync(file_name, data, {flag: 'a+'});
  } else {
    fs.writeFileSync(file_name, data, {flag: 'w'});
  }
};

// This function is used to remove the log files
const removeLogFile = (file_name) => {
  if (fs.existsSync(file_name)) {
    fs.rmSync(file_name);
  }
};

module.exports = {
  readLogFile: readLogFile,
  writeDataToLogFile: writeDataToLogFile,
  removeLogFile: removeLogFile,
  server_log_file: server_log_file,
};