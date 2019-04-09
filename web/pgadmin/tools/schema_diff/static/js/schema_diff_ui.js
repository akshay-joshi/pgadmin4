import url_for from 'sources/url_for';
import $ from 'jquery';
import gettext from 'sources/gettext';
import Alertify from 'pgadmin.alertifyjs';
import Backform from 'pgadmin.backform';
import Backbone from 'backbone';


Backform.SchemaDiffFormRow = Backform.Form.extend({
  label: '',
  className: function() {
    return 'pg-el-sm-12 pg-el-md-12 pg-el-lg-12 pg-el-12';
  },
  tabPanelClassName: function() {
    return Backform.tabClassName;
  },
  tabIndex: 0,
  initialize: function(opts) {
    this.label = opts.label;
    Backform.Form.prototype.initialize.apply(this, arguments);
  },
  template: {
    'row_label':  _.template(`
      <div class="col-2"><%=value%></div>
    `),
    'form_row': _.template(`
      <div class="row"></div>
    `),
    'form_col': _.template(`
      <div class="col"></div>
    `),
  },
  render: function() {
    this.cleanup();

    var controls = this.controls,
      m = this.model,
      tmpls = this.template,
      self = this,
      idx = (this.tabIndex * 100);

    this.$el.empty();

    let $form_row = $(tmpls['form_row']()).appendTo(this.$el);
    $form_row.append($(tmpls['row_label']({value: this.label})));

    this.fields.each(function(f) {
      var cntr = new(f.get('control'))({
        field: f,
        model: m,
        dialog: self,
        tabIndex: idx,
      });

      $form_row.append(
        $(tmpls['form_col']()).append(cntr.render().$el)
      );
      controls.push(cntr);
    });

    return this;
  },
  remove: function(opts) {
    if (opts && opts.data) {
      if (this.model) {
        if (this.model.reset) {
          this.model.reset({
            validate: false,
            silent: true,
            stop: true,
          });
        }
        this.model.clear({
          validate: false,
          silent: true,
          stop: true,
        });
        delete(this.model);
      }
      if (this.errorModel) {
        this.errorModel.clear({
          validate: false,
          silent: true,
          stop: true,
        });
        delete(this.errorModel);
      }
    }
    this.cleanup();
    Backform.Form.prototype.remove.apply(this, arguments);
  },
});


export default class SchemaDiffUI {
  constructor(container) {
    this.$container = container;
    this.source_row = null;
    this.target_row = null;
  }

  raise_error_on_fail(alert_title, xhr) {
    try {
      var err = JSON.parse(xhr.responseText);
      Alertify.alert(alert_title, err.errormsg);
    } catch (e) {
      Alertify.alert(alert_title, e.statusText);
    }
  }

  fetch_servers() {
    return $.ajax({
      url: url_for('schema_diff.servers'),
      method: 'GET',
      dataType: 'json',
      contentType: 'application/json',
    })
      .done(function () {
        // TODO: Following function is used to test the fetching of the schemas
        // this should be moved on database selection event.
        // console.log('Servers:');
        // console.log(res);
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('Databases fetch error'), xhr);
      });
  }
  
  fetch_databases(group_id, server_id) {
    var url_params = { 'gid': group_id, 'sid': server_id },
      baseUrl = url_for('schema_diff.databases', url_params), 
      self = this;
  
    return $.ajax({
      url: baseUrl,
      method: 'GET',
      dataType: 'json',
      contentType: 'application/json',
    })
      .done(function () {
        // TODO: Following function is used to test the fetching of the schemas
        // this should be moved on database selection event.
        // console.log('Databases:');
        // console.log(res);
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('Databases fetch error'), xhr);
      });
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
        // console.log('Schemas:');
        // console.log(res);
        // TODO: function is used to test compare schema this should be
        // moved on compare button click.
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('Schemas fetch error'), xhr);
      });
  }
  
  compare_schemas(trans_id) {
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
        console.warn(res);
      })
      .fail(function (xhr) {
        self.raise_error_on_fail(gettext('Schema compare error'), xhr);
      });
  }
  
  test_compare_schema(trans_id) {
    let self = this;
    let group_id, server_id;
    self.fetch_servers()
      .done((res)=>{
        server_id = res.data[0].id;
        group_id = res.data[0].gid;
        self.fetch_databases(group_id, server_id)
          .done((res)=>{
            self.fetch_schemas(group_id, server_id, res.data[0]._id)
              .done(()=>{
                self.compare_schemas(trans_id);
              });
          });
      });
  }

  render() {
    let self = this;
    var $schema_form = $(`
      <div>
        <div class="row">
          <div class="col-7">
            <div class="source-row"></div>
          </div>
        </div>
        <div class="row">
          <div class="col-7">
            <div class="target-row"></div>
          </div>
          <div class="col-5">
            <div class="action-btns d-flex">
                <button class="btn btn-primary mr-auto"><i class="icon-schema-diff-white"></i>&nbsp;Compare</button>
                <button class="btn btn-secondary mr-1"><i class="icon-script"></i>&nbsp;Generate Script</button>
                <button class="btn btn-secondary"><i class="fa fa-filter"></i>&nbsp;Filter</button>
            </div>
          </div>
        <div>
      </div>
    `).appendTo(self.$container);
  
    self.source_row  = new Backform.SchemaDiffFormRow({
      el: $schema_form.find('.source-row'),
      label: 'Select Source',
      model: new Backbone.Model({
        src_server: '',
        src_db: '',
        src_schema: '',
      }),
      fields: [{
        id: 'src_server', label: false,
        control: 'select2', select2: {allowClear: false}, 
        disabled: function() {
          return false;
        },
      }, {
        id: 'src_db',
        control: 'select2', select2: {allowClear: false}, 
        disabled: function() {
          return false;
        },
      }, {
        id: 'src_schema',
        control: 'select2', select2: {allowClear: false}, 
        disabled: function() {
          return false;
        },
      }],
    });
  
    self.target_row  = new Backform.SchemaDiffFormRow({
      el: $schema_form.find('.target-row'),
      label: 'Select Target',
      model: new Backbone.Model({
        src_server: 'f',
        src_db: 'f',
        src_schema: 's',
      }),
      fields: [{
        id: 'src_server', label: false,
        control: Backform.Select2Control, select2: {allowClear: false}, 
        disabled: function() {
          return false;
        },
      }, {
        id: 'src_db',
        control: 'select2',select2: {allowClear: false}, 
        disabled: function() {
          return false;
        },
      }, {
        id: ' ',
        control: 'select2', select2: {allowClear: false},
        disabled: function() {
          return false;
        },
      }],
    });
  
    self.source_row.render();
    self.target_row.render();

    self.fetch_servers()
      .done((res)=>{
        self.source_row.fields.get('src_server').set('options', res.data);
        self.source_row.fields.get('src_server').trigger('change');
      });
  }  
}
