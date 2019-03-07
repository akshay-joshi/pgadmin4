##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2019, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################


class SchemaDiffRegistry(object):
    """
    SchemaDiffRegistry

    It is more of a registry for different type of nodes for schema diff.
    """
    _registered_nodes = dict()

    def __init__(self, node_name, node_view):
        if node_name not in SchemaDiffRegistry._registered_nodes:
            SchemaDiffRegistry._registered_nodes[node_name] = node_view

    @classmethod
    def get_registered_nodes(cls, node_name=None):
        if node_name is not None:
            return cls._registered_nodes[node_name]

        return cls._registered_nodes
