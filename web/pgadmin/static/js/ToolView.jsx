/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2024, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { usePgAdmin } from './BrowserComponent';
import { BROWSER_PANELS, WORKSPACES } from '../../browser/static/js/constants';
import PropTypes from 'prop-types';
import LayoutIframeTab from './helpers/Layout/LayoutIframeTab';

function ToolForm({actionUrl, params}) {
  const formRef = useRef(null);

  useLayoutEffect(()=>{
    formRef.current?.submit();
  }, []);

  return (
    <form ref={formRef} id="tool-form" action={actionUrl} method="post" hidden>
      {Object.keys(params).map((k)=>{
        return k ? <input key={k} name={k} defaultValue={params[k]} /> : <></>;
      })}
    </form>
  );
}

ToolForm.propTypes = {
  actionUrl: PropTypes.string,
  params: PropTypes.object,
};

function getDockerInstance(panelId, pgAdmin, onChangeWorkspace) {
  if (panelId.indexOf('query-tool') > 0) {
    onChangeWorkspace(WORKSPACES.QUERY_TOOL);
    return pgAdmin.Browser.docker.query_tool_workspace;
  } else if (panelId.indexOf('psql-tool') > 0) {
    onChangeWorkspace(WORKSPACES.PSQL_TOOL);
    return pgAdmin.Browser.docker.psql_workspace;
  } else if (panelId.indexOf('schema-diff-tool') > 0) {
    onChangeWorkspace(WORKSPACES.SCHEMA_DIFF_TOOL);
    return pgAdmin.Browser.docker.schema_diff_workspace;
  }

  return pgAdmin.Browser.docker.default_workspace;
}

export default function ToolView({onChangeWorkspace}) {
  const pgAdmin = usePgAdmin();

  useEffect(()=>{
    pgAdmin.Browser.Events.on('pgadmin:tool:show', (panelId, toolUrl, formParams, tabParams, newTab)=>{
      if(newTab) {
        if(formParams) {
          const newWin = window.open('', '_blank');
          const div = newWin.document.createElement('div');
          newWin.document.body.appendChild(div);
          const root = ReactDOM.createRoot(div);
          root.render(
            <ToolForm actionUrl={window.location.origin+toolUrl} params={formParams}/>, div
          );
        } else {
          window.open(toolUrl);
        }
      } else {
        let dockerObj = getDockerInstance(panelId, pgAdmin, onChangeWorkspace);
        dockerObj.openTab({
          id: panelId,
          title: panelId,
          content: (
            <LayoutIframeTab target={panelId} src={formParams ? undefined : toolUrl}>
              {formParams && <ToolForm actionUrl={toolUrl} params={formParams}/>}
            </LayoutIframeTab>
          ),
          closable: true,
          manualClose: true,
          ...tabParams,
          cache: false,
          group: 'playground'
        }, BROWSER_PANELS.MAIN, 'middle', true);
      }
    });
  }, []);
  return <></>;
}
ToolView.propTypes = {
  onChangeWorkspace: PropTypes.func
};
