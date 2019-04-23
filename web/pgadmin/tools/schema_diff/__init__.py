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
from pgadmin.browser.server_groups.servers import server_icon_and_background
from config import PG_DEFAULT_DRIVER
from pgadmin.utils.driver import get_driver


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
            'schema_diff.servers',
            'schema_diff.databases',
            'schema_diff.schemas',
            'schema_diff.compare',
            'schema_diff.poll',
            'schema_diff.ddl_compare'
        ]


blueprint = SchemaDiffModule(MODULE_NAME, __name__, static_url_path='/static')


@blueprint.route("/")
@login_required
def index():
    return bad_request(
        errormsg=gettext('This URL cannot be requested directly.')
    )


@blueprint.route(
    '/panel/<int:trans_id>/<path:editor_title>',
    methods=["GET"],
    endpoint='panel'
)
def panel(trans_id, editor_title):
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
        trans_id=trans_id,
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
    diff_model_obj = pickle.loads(session_obj['diff_model_obj'])

    return True, None, diff_model_obj, session_obj


def update_session_diff_transaction(trans_id, session_obj, diff_model_obj):
    """
    This function is used to update the diff model into the session.
    :param trans_id:
    :param session_obj:
    :param diff_model_obj:
    :return:
    """
    session_obj['diff_model_obj'] = pickle.dumps(diff_model_obj, -1)

    if 'schemaDiff' in session:
        schema_diff_data = session['schemaDiff']
        schema_diff_data[str(trans_id)] = session_obj
        session['schemaDiff'] = schema_diff_data


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
    trans_id = None
    try:
        # Create a unique id for the transaction
        trans_id = str(random.randint(1, 9999999))

        if 'schemaDiff' not in session:
            schema_diff_data = dict()
        else:
            schema_diff_data = session['schemaDiff']

        # Use pickle to store the Schema Diff Model which will be used
        # later by the diff module.
        schema_diff_data[trans_id] = {
            'diff_model_obj': pickle.dumps(SchemaDiffModel(), -1)
        }

        # Store the schema diff dictionary into the session variable
        session['schemaDiff'] = schema_diff_data

    except Exception as e:
        app.logger.exception(e)

    return make_json_response(
        data={'schemaDiffTransId': trans_id})


@blueprint.route(
    '/servers',
    methods=["GET"],
    endpoint="servers"
)
@login_required
def servers():
    """
    This function will return the list of databases for the specified
    server id.
    """
    res = []
    try:
        """Return a JSON document listing the server groups for the user"""
        driver = get_driver(PG_DEFAULT_DRIVER)

        for server in Server.query.filter_by(user_id=current_user.id):
            manager = driver.connection_manager(server.id)
            conn = manager.connection()
            connected = conn.connected()

            res.append({
                "id": server.id,
                "gid": server.servergroup_id,
                "label": server.name,
                "icon": server_icon_and_background(connected, manager, server),
                "_id": server.id,
            })

    except Exception as e:
        app.logger.exception(e)

    return make_json_response(data=res)


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
    # Check the transaction and connection status
    status, error_msg, diff_model_obj, session_obj = \
        check_transaction_status(trans_id)

    if error_msg == gettext('Transaction ID not found in the session.'):
        return make_json_response(success=0, errormsg=error_msg, status=404)

    comparison_result = dict()
    try:
        all_registered_nodes = SchemaDiffRegistry.get_registered_nodes()
        node_percent = round(100 / len(all_registered_nodes))
        total_percent = 0

        for node_name, node_view in all_registered_nodes.items():
            msg = "Comparing " + node_name + " ..."
            diff_model_obj.set_comparison_info(msg, total_percent)
            # Update the message and total percentage done in session object
            update_session_diff_transaction(trans_id, session_obj,
                                            diff_model_obj)

            view = SchemaDiffRegistry.get_node_view(node_name)
            if hasattr(view, 'compare'):
                res = view.compare(source_sid=source_sid,
                                   source_did=source_did,
                                   source_scid=source_scid,
                                   target_sid=target_sid,
                                   target_did=target_did,
                                   target_scid=target_scid)

                if res is not None:
                    comparison_result[node_name] = res
            total_percent = total_percent + node_percent

        msg = "Successfully compare the specified schemas."
        total_percent = 100
        diff_model_obj.set_comparison_info(msg, total_percent)
        # Update the message and total percentage done in session object
        update_session_diff_transaction(trans_id, session_obj, diff_model_obj)

    except Exception as e:
        app.logger.exception(e)

    return make_json_response(data=comparison_result)


@blueprint.route(
    '/poll/<int:trans_id>', methods=["GET"], endpoint="poll"
)
@login_required
def poll(trans_id):
    """
    This function is used to check the schema comparison is completed or not.
    :param trans_id:
    :return:
    """

    # Check the transaction and connection status
    status, error_msg, diff_model_obj, session_obj = \
        check_transaction_status(trans_id)

    if error_msg == gettext('Transaction ID not found in the session.'):
        return make_json_response(success=0, errormsg=error_msg, status=404)

    msg, diff_percentage = diff_model_obj.get_comparison_info()
    return make_json_response(data={'compare_msg': msg,
                                    'diff_percentage': diff_percentage})


@blueprint.route(
    '/ddl_compare/<int:trans_id>/<int:source_sid>/<int:source_did>/'
    '<int:source_scid>/<int:target_sid>/<int:target_did>/<int:target_scid>/'
    '<int:source_oid>/<int:target_oid>/<node_type>/<comp_status>/',
    methods=["GET"],
    endpoint="ddl_compare"
)
@login_required
def ddl_compare(trans_id, source_sid, source_did, source_scid,
                target_sid, target_did, target_scid, source_oid,
                target_oid, node_type, comp_status):
    """
    This function is used to compare the specified object and return the
    DDL comparison.
    """
    # Check the transaction and connection status
    status, error_msg, diff_model_obj, session_obj = \
        check_transaction_status(trans_id)

    if error_msg == gettext('Transaction ID not found in the session.'):
        return make_json_response(success=0, errormsg=error_msg, status=404)

    source_ddl = ''
    target_ddl = ''
    diff_ddl = ''
    view = SchemaDiffRegistry.get_node_view(node_type)
    if hasattr(view, 'get_ddl'):
        source_ddl, target_ddl, diff_ddl = \
            view.get_ddl(source_sid=source_sid, source_did=source_did,
                         source_scid=source_scid, target_sid=target_sid,
                         target_did=target_did, target_scid=target_scid,
                         source_oid=source_oid, target_oid=target_oid,
                         comp_status=comp_status)

    return make_json_response(data={'source_ddl': source_ddl,
                                    'target_ddl': target_ddl,
                                    'diff_ddl': diff_ddl})
