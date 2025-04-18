##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2025, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################


import uuid
import json

from pgadmin.browser.server_groups.servers.databases.schemas.tests import \
    utils as schema_utils
from pgadmin.browser.server_groups.servers.databases.tests import \
    utils as database_utils
from pgadmin.utils.route import BaseTestGenerator
from regression import parent_node_dict
from regression.python_test_utils import test_utils as utils
from . import utils as fts_configuration_utils


class FTSConfDeleteMultipleTestCase(BaseTestGenerator):
    """ This class will delete added FTS configurations under schema node. """

    scenarios = [
        # Fetching default URL for fts_configuration node.
        ('Delete Multiple FTS Configuration Node',
         dict(url='/browser/fts_configuration/obj/'))
    ]

    def setUp(self):
        """ This function will create FTS configuration."""

        schema_data = parent_node_dict['schema'][-1]
        self.schema_name = schema_data['schema_name']
        self.schema_id = schema_data['schema_id']
        self.server_id = schema_data['server_id']
        self.db_id = schema_data['db_id']
        self.db_name = parent_node_dict["database"][-1]["db_name"]

        self.fts_conf_ids = [fts_configuration_utils.create_fts_configuration(
            self.server,
            self.db_name,
            self.schema_name,
            "fts_conf_%s" % str(uuid.uuid4())[1:8]),
            fts_configuration_utils.create_fts_configuration(
                self.server,
                self.db_name,
                self.schema_name,
                "fts_conf_%s" % str(uuid.uuid4())[1:8])
        ]

    def runTest(self):
        """ This function will delete the FTS configurations under test
        schema. """

        db_con = database_utils.connect_database(self,
                                                 utils.SERVER_GROUP,
                                                 self.server_id,
                                                 self.db_id)

        if not db_con["info"] == "Database connected.":
            raise Exception("Could not connect to database.")

        schema_response = schema_utils.verify_schemas(self.server,
                                                      self.db_name,
                                                      self.schema_name)
        if not schema_response:
            raise Exception("Could not find the schema.")

        data = {'ids': self.fts_conf_ids}
        delete_response = self.tester.delete(
            self.url + str(utils.SERVER_GROUP) + '/' +
            str(self.server_id) + '/' +
            str(self.db_id) + '/' +
            str(self.schema_id) + '/',
            follow_redirects=True,
            data=json.dumps(data),
            content_type='html/json')
        self.assertEqual(delete_response.status_code, 200)

    def tearDown(self):
        """This function disconnect the test database."""

        database_utils.disconnect_database(self, self.server_id,
                                           self.db_id)
