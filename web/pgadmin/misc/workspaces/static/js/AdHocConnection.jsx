/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2024, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import React, { useMemo, useState } from 'react';
import gettext from 'sources/gettext';
import url_for from 'sources/url_for';
import _ from 'lodash';
import BaseUISchema from 'sources/SchemaView/base_schema.ui';
import current_user from 'pgadmin.user_management.current_user';
import VariableSchema from '../../../../browser/server_groups/servers/static/js/variable.ui';
import { getConnectionParameters } from '../../../../browser/server_groups/servers/static/js/server.ui';
import { flattenSelectOptions } from '../../../../static/js/components/FormComponents';
import ConnectServerContent from '../../../../static/js/Dialogs/ConnectServerContent';
import SchemaView from '../../../../static/js/SchemaView';
import PropTypes from 'prop-types';
import getApiInstance from '../../../../static/js/api_instance';
import { useModal } from '../../../../static/js/helpers/ModalProvider';
import { usePgAdmin } from '../../../../static/js/BrowserComponent';


class AdHocConnectionSchema extends BaseUISchema {
  constructor(connectServer, initValues={}) {
    super({
      sid: null,
      did: null,
      user: null,
      server_name: null,
      database_name: null,
      connected: false,
      host: '',
      port: undefined,
      username: current_user.name,
      role: null,
      password: undefined,
      service: undefined,
      connection_string: undefined,
      connection_params: [
        {'name': 'sslmode', 'value': 'prefer', 'keyword': 'sslmode'},
        {'name': 'connect_timeout', 'value': 10, 'keyword': 'connect_timeout'}],
      ...initValues,
    });
    this.flatServers = [];
    this.groupedServers = [];
    this.dbs = [];
    this.api = getApiInstance();
    this.connectServer = connectServer;
    this.paramSchema = new VariableSchema(getConnectionParameters, null, null, ['name', 'keyword', 'value']);
  }

  setServerConnected(sid, icon) {
    for(const group of this.groupedServers) {
      for(const opt of group.options) {
        if(opt.value == sid) {
          opt.connected = true;
          opt.image = icon || 'icon-pg';
          break;
        }
      }
    }
  }

  isServerConnected(sid) {
    return _.find(this.flatServers, (s) => s.value == sid)?.connected;
  }

  getServerList() {
    if(this.groupedServers?.length != 0) {
      return Promise.resolve(this.groupedServers);
    }
    return new Promise((resolve, reject)=>{
      this.api.get(url_for('sqleditor.get_new_connection_servers'))
        .then(({data: respData})=>{
          let groupedOptions = [];
          _.forIn(respData.data.result.server_list, (v, k)=>{
            if(v.length == 0) {
              return;
            }
            groupedOptions.push({
              label: k,
              options: v,
            });
          });
          /* Will be re-used for changing icon when connected */
          this.groupedServers = groupedOptions.map((group)=>{
            return {
              label: group.label,
              options: group.options.map((o)=>({...o, selected: false})),
            };
          });
          resolve(groupedOptions);
        })
        .catch((error)=>{
          reject(error instanceof Error ? error : Error(gettext('Something went wrong')));
        });
    });
  }

  getOtherOptions(sid, type) {
    if(!sid) {
      return [];
    }

    if(!this.isServerConnected(sid)) {
      return [];
    }
    return new Promise((resolve, reject)=>{
      this.api.get(url_for(`sqleditor.${type}`, {
        'sid': sid,
        'sgid': 0,
      }))
        .then(({data: respData})=>{
          resolve(respData.data.result.data);
        })
        .catch((error)=>{
          reject(error instanceof Error ? error : Error(gettext('Something went wrong')));
        });
    });
  }

  get baseFields() {
    let self = this;
    return [
      {
        id: 'sid', label: gettext('Existing Servers (Optional)'), deps: ['connected'],
        type: () => ({
          type: 'select',
          options: () => self.getServerList(),
          optionsLoaded: (res) => self.flatServers = flattenSelectOptions(res),
          optionsReloadBasis: self.flatServers.map((s) => s.connected).join(''),
        }),
        depChange: (state)=>{
          /* Once the option is selected get the name */
          /* Force sid to null, and set only if connected */
          let selectedServer = _.find(
            self.flatServers, (s) => s.value == state.sid
          );
          return {
            server_name: selectedServer?.label,
            did: null,
            user: null,
            role: null,
            sid: null,
            host: selectedServer?.host,
            port: selectedServer?.port,
            service: selectedServer?.service,
            connection_params: selectedServer?.connection_params,
            connected: selectedServer?.connected
          };
        },
        deferredDepChange: (state, source, topState, actionObj) => {
          return new Promise((resolve) => {
            let sid = actionObj.value;
            let selectedServer = _.find(self.flatServers, (s)=>s.value==sid);
            if(sid && !_.find(self.flatServers, (s) => s.value == sid)?.connected) {
              this.connectServer(sid, state.user, null, (data) => {
                self.setServerConnected(sid, data.icon);
                resolve(() => ({ sid: sid, host: selectedServer?.host,
                  port: selectedServer?.port, service: selectedServer?.service,
                  connection_params: selectedServer?.connection_params, connected: true
                }));
              });
            } else {
              resolve(()=>({ sid: sid, host: selectedServer?.host,
                port: selectedServer?.port, service: selectedServer?.service,
                connection_params: selectedServer?.connection_params, connected: true
              }));
            }
          });
        },
      },
      {
        id: 'host', label: gettext('Host name/address'), type: 'text', noEmpty: true,
        deps: ['sid', 'connected'],
        disabled: (state) => state.sid,
      }, {
        id: 'port', label: gettext('Port'), type: 'int', min: 1, max: 65535, noEmpty: true,
        deps: ['sid', 'connected'],
        disabled: (state) => state.sid,
      },{
        id: 'did', label: gettext('Database'), deps: ['sid', 'connected'],
        noEmpty: true, controlProps: {creatable: true},
        type: (state) => {
          return {
            type: 'select',
            options: () => this.getOtherOptions(
              state.sid, 'get_new_connection_database'
            ),
            optionsReloadBasis: `${state.sid} ${this.isServerConnected(state.sid)}`,
          };
        },
        optionsLoaded: (res) => this.dbs = res,
        depChange: (state) => {
          /* Once the option is selected get the name */
          return {
            database_name: _.find(this.dbs, (s) => s.value == state.did)?.label
          };
        }
      }, {
        id: 'user', label: gettext('User'), deps: ['sid', 'connected'],
        noEmpty: true, controlProps: {creatable: true},
        type: (state) => ({
          type: 'select',
          options: () => this.getOtherOptions(
            state.sid, 'get_new_connection_user'
          ),
          optionsReloadBasis: `${state.sid} ${this.isServerConnected(state.sid)}`,
        }),
      }, {
        id: 'password', label: gettext('Password'), type: 'password',
        controlProps: {
          maxLength: null,
          autoComplete: 'new-password'
        },
        deps: ['sid', 'connected'],
      },{
        id: 'role', label: gettext('Role'), deps: ['sid', 'connected'],
        controlProps: {creatable: true},
        type: (state)=>({
          type: 'select',
          options: () => this.getOtherOptions(
            state.sid, 'get_new_connection_role'
          ),
          optionsReloadBasis: `${state.sid} ${this.isServerConnected(state.sid)}`,
        }),
      },{
        id: 'service', label: gettext('Service'), type: 'text', deps: ['sid', 'connected'],
        disabled: (state) => state.sid,
      }, {
        id: 'connection_params', label: gettext('Connection Parameters'),
        type: 'collection',
        schema: this.paramSchema, mode: ['edit', 'create'], uniqueCol: ['name'],
        canAdd: true, canEdit: false, canDelete: true,
      }, {
        id: 'connected', label: '', type: 'text', visible: false,
      }, {
        id: 'database_name', label: '', type: 'text', visible: false,
      }
    ];
  }
}


export default function AdHocConnection({mode}) {
  const [connecting, setConnecting] = useState(false);
  const api = getApiInstance();
  const modal = useModal();
  const pgAdmin = usePgAdmin();

  const connectServer = async (sid, user, formData, connectCallback) => {
    setConnecting(true);
    try {
      let {data: respData} = await api({
        method: 'POST',
        url: url_for('sqleditor.connect_server', {
          'sid': sid,
          ...(user ? {
            'usr': user,
          }:{}),
        }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: formData
      });
      setConnecting(false);
      connectCallback?.(respData.data);
    } catch (error) {
      if(!error.response) {
        pgAdmin.Browser.notifier.pgNotifier('error', error, 'Connection error', gettext('Connection to pgAdmin server has been lost.'));
      } else {
        modal.showModal(gettext('Connect to server'), (closeModal)=>{
          return (
            <ConnectServerContent
              closeModal={()=>{
                setConnecting(false);
                closeModal();
              }}
              data={error.response?.data?.result}
              onOK={(formData)=>{
                connectServer(sid, null, formData, connectCallback);
              }}
            />
          );
        });
      }
    }
  };

  const onSaveClick = async (isNew, formData) => {
    try {
      let {data: respData} = await api({
        method: 'POST',
        url: url_for('workspace.adhoc_connect_server'),
        data: JSON.stringify(formData)
      });
    } catch (error) {
      if(!error.response) {
        pgAdmin.Browser.notifier.pgNotifier('error', error, 'Connection error', gettext('Connect to server.'));
      } else {
        console.log(error);
      }
    }
  };

  let saveBtnName = gettext('Connect & Open Query Tool');
  if (mode == 'PSQL') {
    saveBtnName = gettext('Connect & Open PSQL');
  }

  let adHocConObj = useMemo(() => new AdHocConnectionSchema(connectServer), []);

  return <SchemaView
    formType={'dialog'}
    getInitData={() => { /*This is intentional (SonarQube)*/ }}
    formClassName={'AdHocConnection-container'}
    schema={adHocConObj}
    viewHelperProps={{
      mode: 'create',
    }}
    loadingText={connecting ? 'Connecting...' : ''}
    onSave={onSaveClick}
    customSaveBtnName= {saveBtnName}
    customCloseBtnName={''}
    customSaveBtnIconType={mode}
    hasSQL={false}
    disableSqlHelp={true}
    disableDialogHelp={true}
    isTabView={false}
  />;
}

AdHocConnection.propTypes = {
  mode: PropTypes.string
};
