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
const net = require('net');
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

// This function is used to get the random available TCP port
// if fixedPort is set to 0. Else check whether port is in used or not.
const getAvailablePort = (fixedPort) => {
  return new Promise(function(resolve, reject) {
    const server = net.createServer();

    server.on('error', (e) => {
      reject(e.code);
    });

    server.listen(fixedPort, function() {
      var serverPort = server.address().port;
      server.close(() => {
        resolve(serverPort);
      });
    });
  });
};

// Get the app data folder path 
const currentTime = (new Date()).getTime();
const serverLogFile = path.join(getAppDataPath(), 'pgadmin4.' + currentTime.toString() + '.log');
const configFileName = path.join(homedir(), '.pgadmin', 'pgadmin4_config.json');
const DEFAULT_CONFIG_DATA = {'fixedPort': false, 'portNo': 5050, 'connectionTimeout': 90};

// This function is used to read the file and return the content
const readServerLog = () => {
  var data = null;

  if (fs.existsSync(serverLogFile)) {
    data = fs.readFileSync(serverLogFile, 'utf8');
  } else {
    var errMsg = 'Unable to read file ' + serverLogFile + ' not found.';
    console.warn(errMsg);
    return errMsg;
  }

  return data;
};

// This function is used to write the data into the log file
const writeServerLog = (data) => {
  data += '\n';
  if (fs.existsSync(serverLogFile)) {
    fs.writeFileSync(serverLogFile, data, {flag: 'a+'});
  } else {
    fs.writeFileSync(serverLogFile, data, {flag: 'w'});
  }
};

// This function is used to remove the log file
const removeLogFile = () => {
  if (fs.existsSync(serverLogFile)) {
    fs.rmSync(serverLogFile);
  }
};

var ConfigureStore = {
  fileName: configFileName,
  jsonData: {},

  init: function() {
    if (!this.readConfig()){
      this.jsonData = DEFAULT_CONFIG_DATA;
      this.saveConfig();
    }
  },

  // This function is used to write configuration data
  saveConfig: function() {
    fs.writeFileSync(this.fileName, JSON.stringify(this.jsonData, null, 4), {flag: 'w'});
  },

  // This function is used to read the configuration data
  readConfig: function() {
    if (fs.existsSync(this.fileName)) {
      try {
        this.jsonData = JSON.parse(fs.readFileSync(this.fileName));  
      } catch (error) {
        /* If the file is not present or invalid JSON data in file */
        this.jsonData = {};
      }
    } else {
      var errMsg = 'Unable to read file ' + this.fileName + ' not found.';
      console.warn(errMsg);
      return false;
    }

    return true;
  },

  getConfigData: function() {
    return this.jsonData;
  },

  get: function(key, if_not_value) {
    if(this.jsonData[key] != undefined) {
      return this.jsonData[key];
    } else {
      return if_not_value;
    }
  },

  set: function(key, value) {
    if(typeof key === 'object'){
      this.jsonData = {
        ...this.jsonData,
        ...key,
      };
    } else {
      if(value === '' || value == null || typeof(value) == 'undefined') {
        if(this.jsonData[key] != undefined) {
          delete this.jsonData[key];
        }
      } else {
        this.jsonData[key] = value;
      }
    }
  }, 
};


module.exports = {
  readServerLog: readServerLog,
  writeServerLog: writeServerLog,
  removeLogFile: removeLogFile,
  getAvailablePort: getAvailablePort,
  serverLogFile: serverLogFile,
  ConfigureStore: ConfigureStore,
};