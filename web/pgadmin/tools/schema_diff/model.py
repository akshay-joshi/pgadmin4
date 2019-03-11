##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2019, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################


class SchemaDiffModel(object):
    """
    SchemaDiffModel
    """

    def __init__(self, **kwargs):
        """
        This method is used to initialize the class and
        create a proper object name which will be used
        to fetch the data using namespace name and object name.

        Args:
            **kwargs : N number of parameters
        """
        self.source_children = dict()
        self.target_children = dict()

    def clear_data(self):
        """
        This function clear the model data.
        """
        self.source_children.clear()
        self.target_children.clear()
