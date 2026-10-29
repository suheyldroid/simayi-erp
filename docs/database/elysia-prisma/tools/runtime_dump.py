"""Run inside the configured Django management shell; no writes or row values.

Exports registered model fields plus actual table/column/constraint metadata,
including dependency-owned tables omitted from the source-only catalog.
"""

import json

from django.apps import apps
from django.db import connection

output = {'vendor': connection.vendor, 'registered_models': [], 'physical_tables': []}
for model in apps.get_models(include_auto_created=True):
    fields = []
    for field in model._meta.local_fields:
        _, field_path, args, kwargs = field.deconstruct()
        fields.append({
            'name': field.name, 'column': field.column, 'field_class': field_path,
            'db_type': field.db_type(connection), 'null': field.null,
            'primary_key': field.primary_key, 'unique': field.unique,
            'args': args, 'kwargs': kwargs,
            'target': field.remote_field.model._meta.label if field.remote_field else None,
        })
    output['registered_models'].append({
        'label': model._meta.label, 'table': model._meta.db_table,
        'managed': model._meta.managed, 'fields': fields,
    })

with connection.cursor() as cursor:
    for table in connection.introspection.get_table_list(cursor):
        columns = connection.introspection.get_table_description(cursor, table.name)
        constraints = connection.introspection.get_constraints(cursor, table.name)
        output['physical_tables'].append({
            'name': table.name, 'kind': table.type,
            'columns': [c._asdict() for c in columns], 'constraints': constraints,
        })

print(json.dumps(output, indent=2, default=str, ensure_ascii=False))
