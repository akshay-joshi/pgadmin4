##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2019, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################

"""A blueprint module implementing the schema_diff frame."""
MODULE_NAME = 'schema_diff'


from flask import Response, url_for, request
from flask import render_template, current_app as app
from flask_security import current_user, login_required
from flask_babelex import gettext
from pgadmin.utils import PgAdminModule
from pgadmin.utils.ajax import make_json_response, bad_request, \
    internal_server_error
from pgadmin.model import Server


class SchemaDiffModule(PgAdminModule):
    """
    class SchemaDiffModule(PgAdminModule)

        A module class for Schema Diff derived from PgAdminModule.
    """

    LABEL = "Schema Diff"

    def get_own_menuitems(self):
        return {}

    def get_own_javascripts(self):
        return [{
            'name': 'pgadmin.schema_diff',
            'path': url_for('schema_diff.index') + "schema_diff",
            'when': None
        }]

    def get_panels(self):
        return []

    def get_exposed_url_endpoints(self):
        """
        Returns:
            list: URL endpoints for backup module
        """
        return [
            'schema_diff.initialize_schema_diff',
            'schema_diff.panel',
        ]


blueprint = SchemaDiffModule(MODULE_NAME, __name__, static_url_path='/static')


@blueprint.route("/")
@login_required
def index():
    return bad_request(
        errormsg=gettext('This URL cannot be requested directly.')
    )


@blueprint.route(
    '/panel/<path:editor_title>',
    methods=["GET"],
    endpoint='panel'
)
def panel(editor_title):
    """
    This method calls index.html to render the schema diff.

    Args:
        editor_title: Title of the editor
    """
    # If title has slash(es) in it then replace it
    if request.args and request.args['fslashes'] != '':
        try:
            fslashesList = request.args['fslashes'].split(',')
            for idx in fslashesList:
                idx = int(idx)
                editor_title = editor_title[:idx] + '/' + editor_title[idx:]
        except IndexError as e:
            app.logger.exception(e)

    return render_template(
        "schema_diff/index.html",
        _=gettext,
        editor_title=editor_title
    )


@blueprint.route(
    '/initialize/schema_diff',
    methods=["GET"],
    endpoint="initialize_schema_diff"
)
@login_required
def initialize_schema_diff():
    """
    """
    res = []
    servers = Server.query.filter_by(user_id=current_user.id)
    for server in servers:
        res.append({'id': server.id, 'name':server.name,
                    'server_group_id':server.servergroup_id})

    return make_json_response(data=res)


@blueprint.route("/schema_diff.js")
@login_required
def script():
    """render the required javascript"""
    return Response(
        response=render_template("schema_diff/js/schema_diff.js", _=gettext),
        status=200,
        mimetype="application/javascript"
    )
