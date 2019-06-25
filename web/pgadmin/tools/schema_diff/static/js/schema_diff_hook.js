/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2019, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

define([
  'sources/gettext', 'sources/url_for', 'jquery', 'underscore',
  'underscore.string', 'alertify', 'sources/pgadmin', 'pgadmin.browser',
  'backbone', 'pgadmin.backgrid', 'codemirror', 'pgadmin.backform',
  'pgadmin.tools.schema_diff_ui','wcdocker', 'pgadmin.browser.frame',
], function(
  gettext, url_for, $, _, S, Alertify, pgAdmin, pgBrowser, Backbone, Backgrid,
  CodeMirror, Backform, SchemaDiffUIModule
) {
  var pgTools = pgAdmin.Tools = pgAdmin.Tools || {};
  var SchemaDiffUI = SchemaDiffUIModule.default;

  /* Return back, this has been called more than once */
  if (pgTools.SchemaDiffHook)
    return pgTools.SchemaDiffHook;

  pgTools.SchemaDiffHook = {
    load: function(trans_id) {
      window.onbeforeunload = function() {
        $.ajax({
          url: url_for('schemadiff.index') + 'close/'+trans_id,
          method: 'DELETE',
        });
      };

      let schemaUi = new SchemaDiffUI($('#schema-diff-container'), trans_id);
      schemaUi.render();
    },
  };

  return pgTools.SchemaDiffHook;
});
