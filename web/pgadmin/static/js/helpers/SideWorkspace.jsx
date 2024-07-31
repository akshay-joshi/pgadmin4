/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2024, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import React, { useEffect, useState } from 'react';
import { usePgAdmin } from '../BrowserComponent';
import { Box } from '@mui/material';
import { QueryToolIcon, TerminalIcon } from '../components/ExternalIcon';
import SettingsIcon from '@mui/icons-material/Settings';
import CompareIcon from '@mui/icons-material/Compare';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import { PgIconButton } from '../components/Buttons';
import PropTypes from 'prop-types';
import { styled } from '@mui/material/styles';
import { WORKSPACES } from '../../../browser/static/js/constants';

const StyledWorkspaceButton = styled(PgIconButton)(({theme}) => ({
  '&.Buttons-iconButtonDefault': {
    border: 'none',
    borderRight: '2px solid transparent' ,
    borderRadius: 0,
    padding: '8px 6px',
    height: '40px',
    '&.active': {
      borderRightColor: theme.otherVars.activeBorder,
    }
  },
}));

function SideWorkspaceButton({menuItem, active, changeWorkspace, ...props}) {
  return (
    <StyledWorkspaceButton className={active ? 'active': ''} title={menuItem?.label??''} {...props}
      onClick={()=>{
        changeWorkspace?.();
        menuItem?.callback();
      }} />
  );
}
SideWorkspaceButton.propTypes = {
  menuItem: PropTypes.object,
  active: PropTypes.bool,
  changeWorkspace: PropTypes.func
};

export default function SideWorkspace({selectedWorkspace, onChangeWorkspace}) {
  const [menus, setMenus] = useState({
    'settings': undefined,
  });

  const pgAdmin = usePgAdmin();
  const checkMenuState = ()=>{
    const fileMenus = pgAdmin.Browser.MainMenus.
      find((m)=>(m.name=='file'))?.
      menuItems;
    setMenus({
      'settings': fileMenus?.find((m)=>(m.name=='mnu_preferences')),
    });
  };

  useEffect(()=>{
    checkMenuState();
  }, []);

  return (
    <Box style={{borderTop: '1px solid #dde0e6', borderRight: '1px solid #dde0e6'}} display="flex" flexDirection="column" alignItems="center" gap="2px">
      <SideWorkspaceButton icon={<AccountTreeRoundedIcon />} active={selectedWorkspace == WORKSPACES.DEFAULT} changeWorkspace={()=>onChangeWorkspace(WORKSPACES.DEFAULT)} />
      <SideWorkspaceButton icon={<QueryToolIcon />} active={selectedWorkspace == WORKSPACES.QUERY_TOOL} changeWorkspace={()=>onChangeWorkspace(WORKSPACES.QUERY_TOOL)} />
      <SideWorkspaceButton icon={<TerminalIcon />} active={selectedWorkspace == WORKSPACES.PSQL_TOOL} changeWorkspace={()=>onChangeWorkspace(WORKSPACES.PSQL_TOOL)} />
      <SideWorkspaceButton icon={<CompareIcon />} active={selectedWorkspace == WORKSPACES.SCHEMA_DIFF_TOOL} changeWorkspace={()=>onChangeWorkspace(WORKSPACES.SCHEMA_DIFF_TOOL)} />
      <Box marginTop="auto">
        <SideWorkspaceButton icon={<SettingsIcon />} menuItem={menus['settings']} />
      </Box>
    </Box>
  );
}
SideWorkspace.propTypes = {
  selectedWorkspace: PropTypes.string,
  onChangeWorkspace: PropTypes.func
};
