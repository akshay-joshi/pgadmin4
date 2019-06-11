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
import Slick from 'sources/../bundle/slickgrid';
import pgAdmin from 'sources/pgadmin';
import {setPGCSRFToken} from 'sources/csrf';

import {SchemaSelect2Control, SchemaDiffHeaderView} from './schema_diff.backform';

export default class SchemaDiffUI {
  constructor(container, trans_id) {
    this.$container = container;
    this.header = null;
    this.trans_id = trans_id;
    this.filters = ['Identical', 'Different', 'Source Only', 'Target Only'];
    this.sel_filters = ['Identical', 'Different', 'Source Only', 'Target Only'];
    this.dataView = null;
    this.grid = null;

    setPGCSRFToken(pgAdmin.csrf_token_header, pgAdmin.csrf_token);


    this.model = new Backbone.Model({
      source_sid: undefined,
      source_did: undefined,
      source_scid: undefined,
      target_sid: undefined,
      target_did: undefined,
      target_scid: undefined,
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
  
  compare_schemas() {
    var self = this,
      url_params = self.model.toJSON();

    url_params['trans_id'] = self.trans_id;

    _.each(url_params, function(key, val) {
      url_params[key] = parseInt(val, 10);
    });

    var baseUrl = url_for('schema_diff.compare', url_params);

    self.startDiffPoller();

    return $.ajax({
      url: baseUrl,
      method: 'GET',
      dataType: 'json',
      contentType: 'application/json',
    })
      .done(function (res) {
        self.stopDiffPoller();
        self.render_grid(res.data);
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('Schema compare error'), xhr);
        self.stopDiffPoller();
      });
  }

  render_grid(data) {

    var self = this;
    var grid;

    // Checkbox Column
    var checkboxSelector = new Slick.CheckboxSelectColumn({
      cssClass: 'slick-cell-checkboxsel',
      minWidth: 30,
    });

    // Format Schema object title with appropriate icon
    var formatColumnTitle = function (row, cell, value, columnDef, dataContext) {
      let icon = 'icon-' + dataContext.type;
      return '<i class="ml-5 wcTabIcon '+ icon +'"></i><span>' + value + '</span>';
    };

    // Grid Columns
    var grid_width = ($('#schema-diff-grid').width() - 30) / 2 ;
    var columns = [
      checkboxSelector.getColumnDefinition(),
      {id: 'title', name: 'Schema Objects', field: 'title', minWidth: grid_width, formatter: formatColumnTitle},
      {id: 'status', name: 'Comparison Result', field: 'status', minWidth: grid_width},
      {id: 'type', name: 'Schema Objects', field: 'type',  width: 0, minWidth: 0, maxWidth: 0,
        cssClass: 'reallyHidden', headerCssClass: 'reallyHidden'},
      {id: 'id', name: 'id', field: 'id', width: 0, minWidth: 0, maxWidth: 0,
        cssClass: 'reallyHidden', headerCssClass: 'reallyHidden' },

    ];

    // Grid Options
    var options = {
      enableCellNavigation: true,
      enableColumnReorder: false,
      enableRowSelection: true,
    };

    // Grouping by Schema Object
    var groupBySchemaObject = function() {
      self.dataView.setGrouping({
        getter: 'type',
        formatter: function (g) {
          let icon = 'icon-coll-' + g.value;
          return '<i class="wcTabIcon '+ icon +'"></i><span>' + g.value.charAt(0).toUpperCase() + g.value.slice(1) + 's</span>';
        },
        aggregateCollapsed: true,
        lazyTotalsCalculation: true,
      });
    };

    var groupItemMetadataProvider = new Slick.Data.GroupItemMetadataProvider({ checkboxSelect: true,
      checkboxSelectPlugin: checkboxSelector });

    // Dataview for grid
    self.dataView = new Slick.Data.DataView({
      groupItemMetadataProvider: groupItemMetadataProvider,
      inlineFilters: false,
    });

    // Wire up model events to drive the grid
    self.dataView.onRowCountChanged.subscribe(function () {
      grid.updateRowCount();
      grid.render();
    });
    self.dataView.onRowsChanged.subscribe(function (e, args) {
      grid.invalidateRows(args.rows);
      grid.render();
    });

    // Change Row css on the basis of item status
    self.dataView.getItemMetadata = function(row) {
      var item = self.dataView.getItem(row);
      if (item.__group) {
        return groupItemMetadataProvider.getGroupRowMetadata(item);
      }

      if(item.status === 'Different') {
        return { cssClasses: 'different' };
      } else if (item.status === 'Source Only') {
        return { cssClasses: 'source' };
      } else if (item.status === 'Target Only') {
        return { cssClasses: 'target' };
      }

      return null;
    };

    // Grid filter
    function filter(item) {
      if (self.sel_filters.indexOf(item.status) !== -1) return true;
      return false;
    }

    var $data_grid = $('#schema-diff-grid');
    var grid_height = $('#schema-diff-container').height() - 100;
    $data_grid.height(grid_height);
    $data_grid.css({
      'height': grid_height + 'px',
    });

    grid = new Slick.Grid($data_grid, self.dataView, columns, options);
    grid.registerPlugin(groupItemMetadataProvider);
    grid.setSelectionModel(new Slick.RowSelectionModel({selectActiveRow: false}));
    grid.registerPlugin(checkboxSelector);

    self.dataView.beginUpdate();
    self.dataView.setItems(data);
    self.dataView.setFilter(filter);
    groupBySchemaObject();
    self.dataView.endUpdate();

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

    self.header  = new SchemaDiffHeaderView({
      el: self.$container,
      model: this.model,
      fields: [{
        name: 'source_sid', label: false,
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
        name: 'source_did',
        group: 'source',
        deps: ['source_sid'],
        control: SchemaSelect2Control,
        url: function() {
          return url_for('schema_diff.databases', {'sid': this.get('source_sid')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select database...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('source_sid')) && !_.isNull(m.get('source_sid')))
            return false;
          return true;
        },
        connect: function() {
          self.connect_database(this.model.get('source_sid'), arguments[0], arguments[1]);
        },
      }, {
        name: 'source_scid',
        control: SchemaSelect2Control,
        group: 'source',
        deps: ['source_sid', 'source_did'],
        url: function() {
          return url_for('schema_diff.schemas', {'sid': this.get('source_sid'), 'did': this.get('source_did')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select schema...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('source_did')) && !_.isNull(m.get('source_did')))
            return false;
          return true;
        },
      }, {
        name: 'target_sid', label: false,
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
        name: 'target_did',
        control: SchemaSelect2Control.extend({
          onSelect: function () {
            if(this.$el.find('option:selected').attr('data-connected') !== 'true') {
              self.connect_database(this.model.get('target_sid'), this.$el.find('select').val());
            }
            return Backform.Select2Control.prototype.onSelect.apply(this, arguments);
          },
        }),
        group: 'target',
        deps: ['target_sid'],
        url: function() {
          return url_for('schema_diff.databases', {'sid': this.get('target_sid')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select database...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('target_sid')) && !_.isNull(m.get('target_sid')))
            return false;
          return true;
        },
        connect: function() {
          self.connect_database(this.model.get('target_sid'), arguments[0], arguments[1]);
        },
      }, {
        name: 'target_scid',
        control: SchemaSelect2Control,
        group: 'target',
        deps: ['target_sid', 'target_did'],
        url: function() {
          return url_for('schema_diff.schemas', {'sid': this.get('target_sid'), 'did': this.get('target_did')});
        },
        select2: {
          allowClear: true,
          placeholder: gettext('Select schema...'),
        },
        disabled: function(m) {
          if (!_.isUndefined(m.get('target_did')) && !_.isNull(m.get('target_did')))
            return false;
          return true;
        },
      }],
    });

  
    self.header.render();

    self.header.$el.find('button.btn-primary').on('click', self.compare_schemas.bind(self));

    self.header.$el.find('ul.filter a.dropdown-item').on('click', self.refresh_filters.bind(self));

  }

  refresh_filters(event) {
    let self = this;
    _.each(self.filters, function(filter) {
      let index = self.sel_filters.indexOf(filter);
      let filter_class = '.' + filter.replace(' ', '-').toLowerCase();
      if ($(event.currentTarget).find(filter_class).length == 1) {
        if ($(filter_class).hasClass('visibility-hidden') === true) {
          $(filter_class).removeClass('visibility-hidden');
          if (index === -1) self.sel_filters.push(filter);
        } else {
          $(filter_class).addClass('visibility-hidden');
          if(index !== -1 ) delete self.sel_filters[index];
        }
      }
    });
    // Refresh the grid
    self.dataView.refresh();
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
