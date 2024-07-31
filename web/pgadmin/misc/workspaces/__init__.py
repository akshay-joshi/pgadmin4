##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2024, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################

"""A blueprint module implementing the workspace."""
import json

from flask import request
from pgadmin.user_login_check import pga_login_required
from flask_babel import gettext
from pgadmin.utils import PgAdminModule
from pgadmin.utils.ajax import bad_request, make_json_response
from pgadmin.browser.server_groups.servers.utils import (
    is_valid_ipaddress, convert_connection_parameter, check_ssl_fields)

MODULE_NAME = 'workspace'


class WorkspaceModule(PgAdminModule):

    def get_exposed_url_endpoints(self):
        """
        Returns:
            list: URL endpoints for Workspace module
        """
        return [
            'workspace.adhoc_connect_server'
        ]


blueprint = WorkspaceModule(MODULE_NAME, __name__,
                            url_prefix='/misc/workspace')


@blueprint.route("/")
@pga_login_required
def index():
    return bad_request(
        errormsg=gettext('This URL cannot be requested directly.')
    )


@blueprint.route(
    '/adhoc_connect_server',
    methods=["POST"],
    endpoint="adhoc_connect_server"
)
@pga_login_required
def adhoc_connect_server():
    required_args = ['host', 'port', 'database_name', 'user']

    data = request.form if request.form else json.loads(
        request.data
    )

    for arg in required_args:
        if arg not in data:
            return make_json_response(
                status=410,
                success=0,
                errormsg=gettext(
                    "Could not find the required parameter ({})."
                ).format(arg)
            )

    connection_params = convert_connection_parameter(
        data.get('connection_params', []))

    if 'hostaddr' in connection_params and \
            not is_valid_ipaddress(connection_params['hostaddr']):
        return make_json_response(
            success=0,
            status=400,
            errormsg=gettext('Not a valid Host address')
        )

    # To check ssl configuration
    _, connection_params = check_ssl_fields(connection_params)
    # set the connection params again in the data
    if 'connection_params' in data:
        data['connection_params'] = connection_params
