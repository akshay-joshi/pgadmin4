/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2020, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import $ from 'jquery';

var state = {};

function setState(key, value) {
  state[key] = value;
}

function onTextChange(e) {
  let $ele = $(e.currentTarget);
  setState($ele.attr('data-name'), $ele.val());
}

function onCheckChange(e) {
  let $ele = $(e.currentTarget);
  setState($ele.attr('data-name'), $ele.prop('checked'));

  if($ele.attr('data-name') == 'fixed_port') {
    portNoDisableCheck();
  }
}

function portNoDisableCheck() {
  if(state.fixed_port === undefined) {
    state.fixed_port = false;
  }
  $('#portNo').prop('disabled', state.fixed_port);
}

function setStatus(msg) {
  $('.status-text').html(msg);
}

$('#btnSave').on('click', ()=> {
  $('#btnSave').prop('disabled', true);
});

$('*[data-name]').each(function() {
  let $ele = $(this);
  switch ($ele.attr('type')) {
  case 'checkbox':
    $ele.on('change', onCheckChange);
    break;
  default:
    $ele.on('change keyup', onTextChange);
    break;
  }
});

setStatus('Loading config...');
