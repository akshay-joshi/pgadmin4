/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2019, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

define('pgadmin.schemadiff', [
  'sources/gettext', 'sources/url_for', 'jquery', 'underscore', 'backbone',
  'pgadmin.alertifyjs', 'pgadmin.backform','pgadmin.browser', 'pgadmin.browser.node',
], function(
  gettext, url_for, $, _, Backbone, Alertify, Backform, pgBrowser
) {

  var wcDocker = window.wcDocker;
  /* Return back, this has been called more than once */
  if (pgBrowser.SchemaDiff)
    return pgBrowser.SchemaDiff;

  // Create an Object Restore of pgBrowser class
  pgBrowser.SchemaDiff = {
    init: function() {
      if (this.initialized)
        return;

      this.initialized = true;

      this.spinner_el =
        `<div class="pg-sp-container">
            <div class="pg-sp-content">
                <div class="row">
                    <div class="col-12 pg-sp-icon"></div>
                </div>
            </div>
        </div>`;

      // Define the nodes on which the menus to be appear
      var menus = [{
        name: 'schema_diff',
        module: this,
        applies: ['tools'],
        callback: 'show_schema_diff_tool',
        priority: 1,
        label: gettext('Schema Diff'),
        enable: true,
      }];

      pgBrowser.add_menus(menus);

      // Creating a new pgBrowser frame to show the data.
      var schemaDiffFrameType = new pgBrowser.Frame({
        name: 'frm_schemadiff',
        showTitle: true,
        isCloseable: true,
        isPrivate: true,
        url: 'about:blank',
      });

      // Load the newly created frame
      schemaDiffFrameType.load(pgBrowser.docker);
      return this;
    },

    raise_error_on_fail: function(alert_title, xhr) {
      try {
        var err = JSON.parse(xhr.responseText);
        Alertify.alert(alert_title, err.errormsg);
      } catch (e) {
        Alertify.alert(alert_title, e.statusText);
      }
    },

    // Callback to draw Backup Dialog for objects
    show_schema_diff_tool: function() {
      var self = this,
        baseUrl = url_for('schema_diff.initialize', null);

      $.ajax({
        url: baseUrl,
        method: 'GET',
        dataType: 'json',
        contentType: 'application/json',
      })
      .done(function(res) {
        self.trans_id = res.data.schemaDiffTransId;
        res.data.panel_title = 'Schema Diff'; //TODO: Set the panel title
        // TODO: Following function is used to test the fetching of the
        // databases this should be moved to server selection event later.
        self.fetch_databases(res.data.servers[0].server_group_id, res.data.servers[0].id);
        self.launch_schema_diff(res.data);
      })
      .fail(function(xhr) {
        self.raise_error_on_fail(gettext('Schema Diff initialize error') , xhr);
      });
    },

    launch_schema_diff: function(data) {
      var panel_title = data.panel_title,
        panel_tooltip = '';

      var url_params = {
          'editor_title': panel_title,
        },
        baseUrl = url_for('schema_diff.panel', url_params);

      var propertiesPanel = pgBrowser.docker.findPanels('properties');
      var schemaDiffPanel = pgBrowser.docker.addPanel('frm_schemadiff', wcDocker.DOCK.STACKED, propertiesPanel[0]);

      // Set panel title and icon
      schemaDiffPanel.title('<span title="'+panel_tooltip+'">'+panel_title+'</span>');
      schemaDiffPanel.focus();

      var openSchemaDiffURL = function(j) {
        // add spinner element
        $(j).data('embeddedFrame').$container.append(pgBrowser.SchemaDiff.spinner_el);
        setTimeout(function() {
          var frameInitialized = $(j).data('frameInitialized');
          if (frameInitialized) {
            var frame = $(j).data('embeddedFrame');
            if (frame) {
              frame.openURL(baseUrl);
              frame.$container.find('.pg-sp-container').delay(1000).hide(1);
            }
          } else {
            openSchemaDiffURL(j);
          }
        }, 100);
      };

      openSchemaDiffURL(schemaDiffPanel);
    },

    fetch_databases: function(group_id, server_id) {
      var self = this,
        url_params = {'gid': group_id, 'sid': server_id},
        baseUrl = url_for('schema_diff.databases', url_params);

      $.ajax({
        url: baseUrl,
        method: 'GET',
        dataType: 'json',
        contentType: 'application/json',
      })
      .done(function(res) {
        // TODO: Following function is used to test the fetching of the schemas
        // this should be moved on database selection event.
        console.log('Databases:');
        console.log(res);
        self.fetch_schemas(group_id, server_id, res.data[0]._id);
      })
      .fail(function(xhr) {
        self.raise_error_on_fail(gettext('Databases fetch error') , xhr);
      });
    },

    fetch_schemas: function(group_id, server_id, database_id) {
      var self = this,
        url_params = {'gid': group_id, 'sid': server_id, 'did':database_id},
        baseUrl = url_for('schema_diff.schemas', url_params);

      $.ajax({
        url: baseUrl,
        method: 'GET',
        dataType: 'json',
        contentType: 'application/json',
      })
      .done(function(res) {
        console.log('Schemas:');
        console.log(res);
        // TODO: function is used to test compare schema this should be
        // moved on compare button click.
        self.compare_schemas();
      })
      .fail(function(xhr) {
        self.raise_error_on_fail(gettext('Schemas fetch error') , xhr);
      });
    },

    compare_schemas: function() {
      // TODO: get the gid, sid, did, scid from source and target combo box
      // Below will be used for testing purpose.
      var s_sid=2, s_did=13255, s_scid=2200, t_sid=3, t_did=13329, t_scid=2200;

      var self = this,
        url_params = {'trans_id':self.trans_id, 'source_sid': s_sid,
          'source_did': s_did, 'source_scid': s_scid,
          'target_sid': t_sid, 'target_did': t_did, 'target_scid': t_scid},
        baseUrl = url_for('schema_diff.compare', url_params);

      $.ajax({
        url: baseUrl,
        method: 'GET',
        dataType: 'json',
        contentType: 'application/json',
      })
      .done(function(res) {
        console.log(res);
      })
      .fail(function(xhr) {
        self.raise_error_on_fail(gettext('Schema compare error') , xhr);
      });
    },
  };

  return pgBrowser.SchemaDiff;
});
