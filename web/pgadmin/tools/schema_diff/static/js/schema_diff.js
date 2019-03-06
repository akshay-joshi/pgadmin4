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
  // Some scripts do export their object in the window only.
  // Generally the one, which do no have AMD support.
  var pgBrowser = pgAdmin.Browser;

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
        priority: 13,
        label: gettext('Schema Diff'),
        enable: true,
      }];

      pgBrowser.add_menus(menus);

      // Creating a new pgAdmin.Browser frame to show the data.
      var schemaDiffFrameType = new pgAdmin.Browser.Frame({
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

    // Callback to draw Backup Dialog for objects
    show_schema_diff_tool: function(action, treeItem) {
      var self = this,
          baseUrl = url_for('schema_diff.initialize_schema_diff', null);

      $.ajax({
        url: baseUrl,
        method: 'GET',
        dataType: 'json',
        contentType: 'application/json',
      })
      .done(function(res) {
        res.data.panel_title = 'Schema Diff'; //TODO: Set the panel title
        console.log(res.data);
        self.launch_schema_diff(res.data);
      })
      .fail(function(xhr) {
        if (target !== self) {
          if(xhr.status == 503 && xhr.responseJSON.info != undefined &&
              xhr.responseJSON.info == 'CONNECTION_LOST') {
            setTimeout(function() {
              target.handle_connection_lost(true, xhr);
            });
            return;
          }
        }

        try {
          var err = JSON.parse(xhr.responseText);
          alertify.alert(gettext('Schema Diff initialization error'),
            err.errormsg
          );
        } catch (e) {
          alertify.alert(gettext('Schema Diff initialization error'),
            e.statusText
          );
        }
      });
    },

    launch_schema_diff: function(data) {
      var self = this,
        panel_title = data.panel_title,
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
    }
  };

  return pgBrowser.SchemaDiff;
});
