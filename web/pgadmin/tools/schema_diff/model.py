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
        self.comparison_result = dict()

    def clear_data(self):
        """
        This function clear the model data.
        """
        self.comparison_result.clear()
