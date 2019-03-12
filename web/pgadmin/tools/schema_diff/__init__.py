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

import simplejson as json
import pickle
import random

from flask import Response, session, url_for, request
from flask import render_template, current_app as app
from flask_security import current_user, login_required
from flask_babelex import gettext
from pgadmin.utils import PgAdminModule
from pgadmin.utils.ajax import make_json_response, bad_request, \
    internal_server_error, gone
from pgadmin.model import Server
from pgadmin.tools.schema_diff.node_registry import SchemaDiffRegistry
from pgadmin.tools.schema_diff.model import SchemaDiffModel


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
            list: URL endpoints for Schema Diff module
        """
        return [
            'schema_diff.initialize',
            'schema_diff.panel',
            'schema_diff.databases',
            'schema_diff.schemas',
            'schema_diff.compare'
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


@blueprint.route("/schema_diff.js")
@login_required
def script():
    """render the required javascript"""
    return Response(
        response=render_template("schema_diff/js/schema_diff.js", _=gettext),
        status=200,
        mimetype="application/javascript"
    )


def check_transaction_status(trans_id):
    """
    This function is used to check the transaction id
    is available in the session object.

    Args:
        trans_id:
    """

    if 'schemaDiff' not in session:
        return False, gettext(
            'Transaction ID not found in the session.'
        ), None, None

    schema_diff_data = session['schemaDiff']

    # Return from the function if transaction id not found
    if str(trans_id) not in schema_diff_data:
        return False, gettext(
            'Transaction ID not found in the session.'
        ), None, None

    # Fetch the object for the specified transaction id.
    # Use pickle.loads function to get the model object
    session_obj = schema_diff_data[str(trans_id)]
    model_obj = pickle.loads(session_obj['model_obj'])

    return True, None, model_obj, session_obj


@blueprint.route(
    '/initialize',
    methods=["GET"],
    endpoint="initialize"
)
@login_required
def initialize():
    """
    This function will initialize the schema diff and return the list
    of all the server's.
    """
    res = []
    trans_id = None
    try:
        # Create a unique id for the transaction
        trans_id = str(random.randint(1, 9999999))

        if 'schemaDiff' not in session:
            schema_diff_data = dict()
        else:
            schema_diff_data = session['schemaDiff']

        # Use pickle to store the command object which will be used
        # later by the sql grid module.
        schema_diff_data[trans_id] = {
            'model_obj': pickle.dumps(SchemaDiffModel(), -1)
        }

        # Store the schema diff dictionary into the session variable
        session['schemaDiff'] = schema_diff_data

        servers = Server.query.filter_by(user_id=current_user.id)
        for server in servers:
            res.append({'id': server.id, 'name': server.name,
                        'server_group_id': server.servergroup_id})
    except Exception as e:
        app.logger.exception(e)

    return make_json_response(
        data={'servers': res, 'schemaDiffTransId': trans_id})


@blueprint.route(
    '/databases/<int:gid>/<int:sid>',
    methods=["GET"],
    endpoint="databases"
)
@login_required
def databases(gid, sid):
    """
    This function will return the list of databases for the specified
    server id.
    """
    res = None
    try:
        view = SchemaDiffRegistry.get_node_view('database')
        res = view.nodes(gid=gid, sid=sid)
    except Exception as e:
        app.logger.exception(e)

    return res


@blueprint.route(
    '/schemas/<int:gid>/<int:sid>/<int:did>',
    methods=["GET"],
    endpoint="schemas"
)
@login_required
def schemas(gid, sid, did):
    """
    This function will return the list of schemas for the specified
    server id and database id.
    """
    res = None
    try:
        view = SchemaDiffRegistry.get_node_view('schema')
        res = view.nodes(gid=gid, sid=sid, did=did)
    except Exception as e:
        app.logger.exception(e)

    return res


@blueprint.route(
    '/compare/<int:trans_id>/<int:source_sid>/<int:source_did>/'
    '<int:source_scid>/<int:target_sid>/<int:target_did>/<int:target_scid>',
    methods=["GET"],
    endpoint="compare"
)
@login_required
def compare(trans_id, source_sid, source_did, source_scid,
            target_sid, target_did, target_scid):
    """
    This function will compare the two schemas.
    """

    # Check the transaction
    status, error_msg, model_obj, session_obj = \
        check_transaction_status(trans_id)

    if error_msg == gettext('Transaction ID not found in the session.'):
        return make_json_response(success=0, errormsg=error_msg, status=404)

    res = []
    try:
        model_obj.clear_data()
        all_registered_nodes = SchemaDiffRegistry.get_registered_nodes()
        for node_name, node_view in all_registered_nodes.items():
            view = SchemaDiffRegistry.get_node_view(node_name)
            if hasattr(view, 'compare'):
                res = view.compare(source_sid=source_sid,
                                   source_did=source_did,
                                   source_scid=source_scid,
                                   target_sid=target_sid,
                                   target_did=target_did,
                                   target_scid=target_scid)

    except Exception as e:
        app.logger.exception(e)

    return make_json_response(result=res)
