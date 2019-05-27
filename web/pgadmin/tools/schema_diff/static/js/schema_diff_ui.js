/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2019, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import url_for from 'sources/url_for';
import $ from 'jquery';
import gettext from 'sources/gettext';
import Alertify from 'pgadmin.alertifyjs';
import Backform from 'pgadmin.backform';
import Backbone from 'backbone';
import {SchemaSelect2Control, SchemaDiffForm} from './schema_diff.backform';

export default class SchemaDiffUI {
  constructor(container) {
    this.$container = container;
    this.source_row = null;
    this.target_row = null;

    this.model = new Backbone.Model({
      src_server: undefined,
      src_db: undefined,
      src_schema: undefined,
      trg_server: undefined,
      trg_db: undefined,
      trg_schema: undefined,
    });
  }

  raise_error_on_fail(alert_title, xhr) {
    try {
      var err = JSON.parse(xhr.responseText);
      Alertify.alert(alert_title, err.errormsg);
    } catch (e) {
      Alertify.alert(alert_title, e.statusText);
    }
  }

  
  fetch_schemas(group_id, server_id, database_id) {
    var url_params = { 'gid': group_id, 'sid': server_id, 'did': database_id },
      baseUrl = url_for('schema_diff.schemas', url_params),
      self = this;
  
    return $.ajax({
      url: baseUrl,
      method: 'GET',
      dataType: 'json',
      contentType: 'application/json',
    })
      .done(function () {
        // console.warn('Schemas:');
        // console.warn(res);
        // TODO: function is used to test compare schema this should be
        // moved on compare button click.
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('Schemas fetch error'), xhr);
      });
  }
  
  compare_schemas() {
    // TODO: get the gid, sid, did, scid from source and target combo box
    // Below will be used for testing purpose.
    var self = this;
    self.s_sid = 2, self.s_did = 13255, self.s_scid = 16393,
    self.t_sid = 2, self.t_did = 13255, self.t_scid = 16394;
  
    var url_params = {
        'trans_id': self.trans_id, 'source_sid': self.s_sid,
        'source_did': self.s_did, 'source_scid': self.s_scid,
        'target_sid': self.t_sid, 'target_did': self.t_did,
        'target_scid': self.t_scid,
      },
      baseUrl = url_for('schema_diff.compare', url_params);

    return $.ajax({
      url: baseUrl,
      method: 'GET',
      dataType: 'json',
      contentType: 'application/json',
    })
      .done(function (res) {
        self.stopDiffPoller();
        console.warn(res);

        // TODO: Remove this code from here it is for testing DDL comparison
        for (var key in res.data) {
          for (var inner_key in res.data[key]) {
            if (res.data[key][inner_key].status === 'source')
              self.ddlCompare(res.data[key][inner_key].oid, 0, key, 'source');
            else if (res.data[key][inner_key].status === 'target')
              self.ddlCompare(0, res.data[key][inner_key].oid, key, 'target');
            else if (res.data[key][inner_key].status === 'different')
              self.ddlCompare(res.data[key][inner_key].source_oid,
                res.data[key][inner_key].target_oid, key, 'different');
          }
        }
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('Schema compare error'), xhr);
        self.stopDiffPoller();
      });
  }
  
  test_compare_schema() {
    return true;
  }

  startDiffPoller() {
    let self = this;
    $('#diff_fetching_data').removeClass('d-none');

    let thePollingFunc = function() {
      let url_params = {'trans_id': self.trans_id},
        baseUrl = url_for('schema_diff.poll', url_params);

      $.ajax({
        url: baseUrl,
        method: 'GET',
        dataType: 'json',
        contentType: 'application/json',
      })
        .done(function (res) {
          let msg = res.data.compare_msg + res.data.diff_percentage + '% completed';
          $('#diff_fetching_data').find('.schema-diff-busy-text').text(msg);
        })
        .fail(function (xhr) {
          self.raise_error_on_fail(gettext('Poll error'), xhr);
          self.stopDiffPoller();
        });
    };

    /* Execute once for the first time as setInterval will not do */
    thePollingFunc();
    self.diff_poller_int_id = setInterval(thePollingFunc, 2000);
  }

  stopDiffPoller() {
    let self = this;
    clearInterval(self.diff_poller_int_id);
    $('#diff_fetching_data').find('.schema-diff-busy-text').text('');
    $('#diff_fetching_data').addClass('d-none');

  }

  ddlCompare(source_oid, target_oid, node_type, status) {
    var self = this,
      url_params = {
        'trans_id': self.trans_id, 'source_sid': self.s_sid,
        'source_did': self.s_did, 'source_scid': self.s_scid,
        'target_sid': self.t_sid, 'target_did': self.t_did,
        'target_scid': self.t_scid, 'source_oid': source_oid,
        'target_oid': target_oid, 'node_type': node_type,
        'comp_status': status,
      },
      baseUrl = url_for('schema_diff.ddl_compare', url_params);

    return $.ajax({
      url: baseUrl,
      method: 'GET',
      dataType: 'json',
      contentType: 'application/json',
    })
      .done(function (res) {
        console.warn(res);
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('ddlCompare fetch error'), xhr);
      });
  }

  render() {
    let self = this;

    self.source_row  = new SchemaDiffForm({
      el: self.$container,
      model: this.model,
      fields: [{
        name: 'src_server', label: false,
        control: SchemaSelect2Control,
        url: url_for('schema_diff.servers'),
        select2: {
          allowClear: true,
          placeholder: gettext('Select server...'),
        },
        connect: function() {
          self.connect_server(arguments[0], arguments[1]);
        },
        group: 'source',
        disabled: function() {
          return false;
        },
      }, {
        name: 'src_db',
        group: 'source',
        deps: ['src_server'],
        control: SchemaSelect2Control,
        url: function() {
          return url_for('schema_diff.databases', {'sid': this.get('src_server')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select database...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('src_server')) && !_.isNull(m.get('src_server')))
            return false;
          return true;
        },
        connect: function() {
          self.connect_database(this.model.get('src_server'), arguments[0], arguments[1]);
        },
      }, {
        name: 'src_schema',
        control: SchemaSelect2Control,
        group: 'source',
        deps: ['src_server', 'src_db'],
        url: function() {
          return url_for('schema_diff.schemas', {'sid': this.get('src_server'), 'did': this.get('src_db')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select schema...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('src_db')) && !_.isNull(m.get('src_db')))
            return false;
          return true;
        },
      }, {
        name: 'trg_server', label: false,
        control: SchemaSelect2Control.extend({
          onSelect: function () {
            if(this.$el.find('option:selected').attr('data-connected') !== 'true') {
              self.connect_server(this.$el.find('select').val());
            }
            return Backform.Select2Control.prototype.onSelect.apply(this, arguments);
          },
        }), group: 'target',
        url: url_for('schema_diff.servers'),
        select2: {
          allowClear: true,
          placeholder: gettext('Select server...'),
        },
        disabled: function() {
          return false;
        },
        connect: function() {
          self.connect_server(arguments[0], arguments[1]);
        },
      }, {
        name: 'trg_db',
        control: SchemaSelect2Control.extend({
          onSelect: function () {
            if(this.$el.find('option:selected').attr('data-connected') !== 'true') {
              self.connect_database(this.model.get('trg_server'), this.$el.find('select').val());
            }
            return Backform.Select2Control.prototype.onSelect.apply(this, arguments);
          },
        }),
        group: 'target',
        deps: ['trg_server'],
        url: function() {
          return url_for('schema_diff.databases', {'sid': this.get('trg_server')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select database...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('trg_server')) && !_.isNull(m.get('trg_server')))
            return false;
          return true;
        },
        connect: function() {
          self.connect_database(this.model.get('trg_server'), arguments[0], arguments[1]);
        },
      }, {
        name: 'trg_schema',
        control: SchemaSelect2Control,
        group: 'target',
        deps: ['trg_server', 'trg_db'],
        url: function() {
          return url_for('schema_diff.schemas', {'sid': this.get('trg_server'), 'did': this.get('trg_db')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select schema...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('trg_db')) && !_.isNull(m.get('trg_db')))
            return false;
          return true;
        },
      }],
    });

  
    self.source_row.render();

  }

  connect_database(server_id, db_id, callback) {
    var url = url_for('schema_diff.connect_database', {'sid': server_id, 'did': db_id});
    $.post(url)
      .done(function(res) {
        if (res.success && res.data) {
          callback(res.data);
        }
      })
      .fail(function() {
        // Fail
      });

  }

  connect_server(server_id, callback) {
    var  onFailure = function(
        xhr, status, error
      ) {
        Alertify.pgNotifier('error', xhr, error, function(msg) {
          setTimeout(function() {
            Alertify.dlgServerPass(
              gettext('Connect to Server'),
              msg
            ).resizeTo();
          }, 100);
        });
      },
      onSuccess = function(res) {
        if (res && res.data) {
          // We're not reconnecting
          callback(res.data);
        }
      };


    // Ask Password and send it back to the connect server
    if (!Alertify.dlgServerPass) {
      Alertify.dialog('dlgServerPass', function factory() {
        return {
          main: function(
            title, message, _onSuccess, _onFailure, _onCancel
          ) {
            this.set('title', title);
            this.message = message;
            this.onSuccess = _onSuccess || onSuccess;
            this.onFailure = _onFailure || onFailure;
            this.onCancel = _onCancel || onCancel;
          },
          setup:function() {
            return {
              buttons:[{
                text: gettext('Cancel'), className: 'btn btn-secondary fa fa-times pg-alertify-button',
                key: 27,
              },{
                text: gettext('OK'), key: 13, className: 'btn btn-primary fa fa-check pg-alertify-button',
              }],
              focus: {element: '#password', select: true},
              options: {
                modal: 0, resizable: false, maximizable: false, pinnable: false,
              },
            };
          },
          build:function() {},
          prepare:function() {
            this.setContent(this.message);
          },
          callback: function(closeEvent) {
            var _onFailure = this.onFailure,
              _onSuccess = this.onSuccess,
              _onCancel = this.onCancel;

            if (closeEvent.button.text == gettext('OK')) {

              var _url = url_for('schema_diff.connect_server', {'sid': server_id});

              $.ajax({
                type: 'POST',
                timeout: 30000,
                url: _url,
                data: $('#frmPassword').serialize(),
              })
                .done(function(res) {
                  if (res.success == 1) {
                    return _onSuccess(res);
                  }
                })
                .fail(function(xhr, status, error) {
                  return _onFailure(
                    xhr, status, error
                  );
                });
            } else {
              _onCancel && typeof(_onCancel) == 'function' &&
                _onCancel();
            }
          },
        };
      });
    }

    var onCancel = function() {
      return false;
    };

    var url = url_for('schema_diff.connect_server', {'sid': server_id});
    $.post(url)
      .done(function(res) {
        if (res.success == 1) {
          return onSuccess(res);
        }
      })
      .fail(function(xhr, status, error) {
        return onFailure(
          xhr, status, error
        );
      });
  }
}
