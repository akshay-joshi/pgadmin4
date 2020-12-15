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
var pgadminServerProcess = null;
var pgAdminWindowObject = null;

// This function is used to get the [roaming] app data path
// based on the platform. Use this for config etc.
const getAppDataPath = () => {
  var appDataPath = '';
  switch (platform()) {
  case 'win32':
    appDataPath = path.join(process.env.APPDATA, 'pgadmin');
    break;
  case 'darwin':
    appDataPath = path.join(homedir(), 'Library', 'Preferences', 'pgadmin');
    break;
  case 'linux':
    // FIXME: $XDG_CONFIG_HOME or $HOME/.config if the former isn't set
    appDataPath = path.join(homedir(), '.local', 'share', 'pgadmin');
    break;
  default:
    if (platform().startsWith('win')) {
      appDataPath = path.join(process.env.APPDATA, 'pgadmin');
    } else {
      // FIXME: $XDG_CONFIG_HOME or $HOME/.config if the former isn't set
      appDataPath = path.join(homedir(), '.local', 'share', 'pgadmin');
    }
  }

  return appDataPath;
};

// This function is used to get the [local] app data path
// based on the platform. Use this for logs etc.
const getLocalAppDataPath = () => {
  var localAppDataPath = '';
  switch (platform()) {
  case 'win32':
    localAppDataPath = path.join(process.env.LOCALAPPDATA, 'pgadmin');
    break;
  case 'darwin':
    localAppDataPath = path.join(homedir(), 'Library', 'Application Support', 'pgadmin');
    break;
  case 'linux': 
    // FIXME: $XDG_DATA_HOME or $HOME/.local/share if the former isn't set
    localAppDataPath = path.join(homedir(), '.local', 'share', 'pgadmin');
    break;
  default:
    if (platform().startsWith('win')) {
      localAppDataPath = path.join(process.env.LOCALAPPDATA, 'pgadmin');
    } else {
      // FIXME: $XDG_DATA_HOME or $HOME/.local/share if the former isn't set
      localAppDataPath = path.join(homedir(), '.local', 'share', 'pgadmin');
    }
  }

  return localAppDataPath;
};

// This function is used to get the random available TCP port
// if fixedPort is set to 0. Else check whether port is in used or not.
const getAvailablePort = (fixedPort) => {
  return new Promise(function(resolve, reject) {
    const server = net.createServer();

    server.listen(fixedPort, '127.0.0.1');

    server.on('error', (e) => {
      reject(e.code);
    });

    server.on('listening', () => {
      var serverPort = server.address().port;
      server.close();
      resolve(serverPort);
    });
  });
};

// Get the app data folder path 
const currentTime = (new Date()).getTime();
const serverLogFile = path.join(getLocalAppDataPath(), 'pgadmin4.' + currentTime.toString() + '.log');
const configFileName = path.join(getAppDataPath(), 'runtime_config.json');
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
  data = data + '\n';
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

// This function used to set the object of pgAdmin server process.
const setProcessObject = (processObject) => {
  pgadminServerProcess = processObject;
};

// This function used to set the object of pgAdmin window.
const setPgAdminWindowObject = (windowObject) => {
  pgAdminWindowObject = windowObject;
};

// This function is used to get the server log file.
const getServerLogFile = () => {
  return serverLogFile;
};

// This function is used to get the runtime config file.
const getRunTimeConfigFile = () => {
  return configFileName;
};

// This function is used to kill the server process, remove the log files
// and quit the application.
const cleanupAndQuitApp = () => {
  // Remove the server log file on exit
  removeLogFile();

  // Killing pgAdmin4 server process if application quits
  if (pgadminServerProcess != null) {
    try {
      process.kill(pgadminServerProcess.pid);
    }
    catch (e) {
      console.warn('Failed to kill server process.');
    }
  }

  if (pgAdminWindowObject != null) {
    // Close the window.
    pgAdminWindowObject.close(true);

    // Remove all the cookies.
    pgAdminWindowObject.cookies.getAll({}, function(cookies) {
      try {
        cookies.forEach(function(cookie) {
          pgAdminWindowObject.cookies.remove({url: 'http://' + cookie.domain, name: cookie.name});
        });
      } catch (error) {
        console.warn('Failed to remove cookies.');
      } finally {
        pgAdminWindowObject = null;
        // Quit Application
        nw.App.quit();
      }
    });
  } else {
    // Quit Application
    nw.App.quit();
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
  setProcessObject: setProcessObject,
  cleanupAndQuitApp: cleanupAndQuitApp,
  getServerLogFile: getServerLogFile,
  getRunTimeConfigFile: getRunTimeConfigFile,
  setPgAdminWindowObject: setPgAdminWindowObject,
  ConfigureStore: ConfigureStore,
};