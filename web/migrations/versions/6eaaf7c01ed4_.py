##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2024, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################
"""

Revision ID: 6eaaf7c01ed4
Revises: ac2c2e27dc2d
Create Date: 2024-10-03 12:49:34.295563

"""
import sqlalchemy as sa
from alembic import op, context

# revision identifiers, used by Alembic.
revision = '6eaaf7c01ed4'
down_revision = 'ac2c2e27dc2d'
branch_labels = None
depends_on = None


def upgrade():
    with (op.batch_alter_table("server",
                               table_kwargs={'sqlite_autoincrement': True}) as batch_op):
        if context.get_impl().bind.dialect.name == "sqlite":
            batch_op.alter_column('id', autoincrement=True)
        batch_op.add_column(sa.Column('is_adhoc', sa.Integer(),
                                      server_default='0'))


def downgrade():
    # pgAdmin only upgrades, downgrade not implemented.
    pass
