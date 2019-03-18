import url_for from 'sources/url_for';
import $ from 'jquery';
import gettext from 'sources/gettext';
import Alertify from 'pgadmin.alertifyjs';


function raise_error_on_fail(alert_title, xhr) {
  try {
    var err = JSON.parse(xhr.responseText);
    Alertify.alert(alert_title, err.errormsg);
  } catch (e) {
    Alertify.alert(alert_title, e.statusText);
  }
}

export function fetch_servers() {
  return $.ajax({
    url: url_for('schema_diff.servers'),
    method: 'GET',
    dataType: 'json',
    contentType: 'application/json',
  })
    .done(function (res) {
      // TODO: Following function is used to test the fetching of the schemas
      // this should be moved on database selection event.
      // console.log('Servers:');
      // console.log(res);
    })
    .fail(function (xhr) {
      raise_error_on_fail(gettext('Databases fetch error'), xhr);
    });
}

export function fetch_databases(group_id, server_id) {
  var url_params = { 'gid': group_id, 'sid': server_id },
    baseUrl = url_for('schema_diff.databases', url_params);

  return $.ajax({
    url: baseUrl,
    method: 'GET',
    dataType: 'json',
    contentType: 'application/json',
  })
    .done(function (res) {
      // TODO: Following function is used to test the fetching of the schemas
      // this should be moved on database selection event.
      // console.log('Databases:');
      // console.log(res);
    })
    .fail(function (xhr) {
      raise_error_on_fail(gettext('Databases fetch error'), xhr);
    });
}

export function fetch_schemas(group_id, server_id, database_id) {
  var url_params = { 'gid': group_id, 'sid': server_id, 'did': database_id },
    baseUrl = url_for('schema_diff.schemas', url_params);

  return $.ajax({
    url: baseUrl,
    method: 'GET',
    dataType: 'json',
    contentType: 'application/json',
  })
    .done(function (res) {
      // console.log('Schemas:');
      // console.log(res);
      // TODO: function is used to test compare schema this should be
      // moved on compare button click.
    })
    .fail(function (xhr) {
      raise_error_on_fail(gettext('Schemas fetch error'), xhr);
    });
}

export function compare_schemas(trans_id) {
  // TODO: get the gid, sid, did, scid from source and target combo box
  // Below will be used for testing purpose.
  var s_sid = 2, s_did = 13255, s_scid = 2200, t_sid = 3, t_did = 13329, t_scid = 2200;

  var self = this,
    url_params = {
      'trans_id': trans_id, 'source_sid': s_sid,
      'source_did': s_did, 'source_scid': s_scid,
      'target_sid': t_sid, 'target_did': t_did, 'target_scid': t_scid,
    },
    baseUrl = url_for('schema_diff.compare', url_params);

  return $.ajax({
    url: baseUrl,
    method: 'GET',
    dataType: 'json',
    contentType: 'application/json',
  })
    .done(function (res) {
      console.log(res);
    })
    .fail(function (xhr) {
      raise_error_on_fail(gettext('Schema compare error'), xhr);
    });
}

export function test_compare_schema(trans_id) {
  let group_id, server_id;
  fetch_servers()
    .done((res)=>{
      server_id = res.data.servers[0].id;
      group_id = res.data.servers[0].sgid;
      fetch_databases(group_id, server_id)
        .done((res)=>{
          fetch_schemas(group_id, server_id, res.data[0]._id)
            .done((res)=>{
              compare_schemas(trans_id);
            });
        });
    });
}
