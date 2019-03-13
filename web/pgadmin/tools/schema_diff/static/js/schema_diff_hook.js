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
  CodeMirror, Backform, SchemaDiffUI
) {
  var pgTools = pgAdmin.Tools = pgAdmin.Tools || {};

  /* Return back, this has been called more than once */
  if (pgTools.SchemaDiff)
    return pgTools.SchemaDiff;

  pgTools.SchemaDiffHook = {
    init: function(trans_id) {
      window.onbeforeunload = function() {
        $.ajax({
          url: url_for('schemadiff.index') + 'close/'+trans_id,
          method: 'DELETE',
        });
      };

      SchemaDiffUI.fetch_databases(1, 1);
    },
  };

  return pgTools.SchemaDiffHook;
});