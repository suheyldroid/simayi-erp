"""Extract repository-owned Django models without importing/running Django.

Run from any directory. The JSON retains source expressions and provenance;
it is a source snapshot, not an introspection of a deployed database.
"""

import ast
import copy
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = pathlib.Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'src/backend/InvenTree'


def value(node):
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError):
        return {'expression': ast.unparse(node)}


def assignments(body):
    return {n.targets[0].id: n.value for n in body
            if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)}


def extract():
    classes = {}
    hashes = {}
    for path in sorted(BACKEND.glob('*/models.py')):
        rel = str(path.relative_to(ROOT))
        hashes[rel] = hashlib.sha256(path.read_bytes()).hexdigest()
        for node in ast.parse(path.read_text()).body:
            if not isinstance(node, ast.ClassDef):
                continue
            meta = next((n for n in node.body if isinstance(n, ast.ClassDef)
                         and n.name == 'Meta'), None)
            meta_nodes = assignments(meta.body) if meta else {}
            fields = {}
            virtual = {}
            class_values = assignments(node.body)
            for name, field in assignments(node.body).items():
                if not isinstance(field, ast.Call):
                    continue
                field_type = ast.unparse(field.func).split('.')[-1]
                if field_type not in {'TaggableManager', 'GenericRelation', 'GenericForeignKey'} and not field_type.endswith(('Field', 'ForeignKey')):
                    continue
                data = {
                    'name': name, 'type': field_type,
                    'args': [value(a) for a in field.args],
                    'kwargs': {
                        k.arg: value(class_values[k.value.id])
                        if isinstance(k.value, ast.Name) and k.value.id in class_values
                        and isinstance(class_values[k.value.id], ast.Constant)
                        else value(k.value)
                        for k in field.keywords
                    },
                    'declaration': ast.unparse(field),
                    'source': rel, 'line': field.lineno, 'declared_on': node.name,
                }
                (virtual if field_type in {'TaggableManager', 'GenericRelation', 'GenericForeignKey'} else fields)[name] = data
            classes[node.name] = {
                'name': node.name, 'module': path.parent.name,
                'bases': [ast.unparse(b).split('.')[-1] for b in node.bases],
                'abstract': value(meta_nodes.get('abstract', ast.Constant(False))),
                'meta': {k: value(v) for k, v in meta_nodes.items()},
                'has_meta': meta is not None,
                'meta_source': {k: ast.unparse(v) for k, v in meta_nodes.items()},
                'source': rel, 'line': node.lineno,
                'description': (ast.get_docstring(node) or '').split('\n')[0],
                'own_fields': fields, 'own_virtual': virtual,
            }

    def ancestor(name, target):
        if name == target:
            return True
        return any(ancestor(b, target) for b in classes.get(name, {}).get('bases', []))

    def inherited(name, key):
        c = classes.get(name)
        if not c:
            return {}
        result = {}
        for base in reversed(c['bases']):
            result.update(inherited(base, key))
        result.update(copy.deepcopy(c[key]))
        return result

    def inherited_meta(name):
        c = classes.get(name)
        if not c:
            return {}, {}
        if c['has_meta']:
            return copy.deepcopy(c['meta']), copy.deepcopy(c['meta_source'])
        for base in c['bases']:
            meta, raw = inherited_meta(base)
            if meta:
                return meta, raw
        return {}, {}

    models = []
    for name, c in classes.items():
        if c['abstract'] or not (ancestor(name, 'Model') or ancestor(name, 'MPTTModel') or ancestor(name, 'AuthToken')):
            continue
        model = {k: v for k, v in c.items() if k not in {'own_fields', 'own_virtual', 'has_meta'}}
        model['fields'] = inherited(name, 'own_fields')
        model['virtual'] = inherited(name, 'own_virtual')
        model['meta'], model['meta_source'] = inherited_meta(name)
        model['table'] = model['meta'].get('db_table', f"{c['module']}_{name.lower()}")

        def synthetic(fname, ftype, kwargs, reason):
            model['fields'][fname] = {
                'name': fname, 'type': ftype, 'args': [], 'kwargs': kwargs,
                'declaration': reason, 'source': c['source'], 'line': c['line'],
                'declared_on': name, 'synthetic': reason,
            }

        if ancestor(name, 'AuthToken'):
            synthetic('created', 'DateTimeField', {'auto_now_add': True}, 'rest_framework.authtoken.Token.created (abstract parent)')
        if not any(f['kwargs'].get('primary_key') for f in model['fields'].values()):
            synthetic('id', 'AutoField', {'primary_key': True}, 'DEFAULT_AUTO_FIELD = django.db.models.AutoField')
        if ancestor(name, 'MPTTModel'):
            for field in ['lft', 'rght', 'tree_id', 'level']:
                synthetic(field, 'PositiveIntegerField', {'db_index': field == 'tree_id'}, 'django-mptt generated nested-set column')
        for fname, field in list(model['fields'].items()):
            if field['type'] == 'InvenTreeModelMoneyField':
                synthetic(fname + '_currency', 'CharField', {'max_length': 3, 'null': field['kwargs'].get('null', False)}, 'django-money companion currency column; default resolved by application settings')
            if field['type'] == 'InvenTreeCustomStatusModelField':
                synthetic(fname + '_custom_key', 'PositiveIntegerField', {'null': True, 'default': None}, 'generic/states/fields.py contribute_to_class companion column')
        # Keep primary keys first in generated documentation.
        model['fields'] = dict(sorted(model['fields'].items(), key=lambda pair: not pair[1]['kwargs'].get('primary_key', False)))
        models.append(model)

    status_codes = {}
    for path in sorted(BACKEND.glob('*/status_codes.py')):
        hashes[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
        for c in ast.parse(path.read_text()).body:
            if not isinstance(c, ast.ClassDef):
                continue
            codes = {}
            for name, n in assignments(c.body).items():
                if isinstance(n, ast.Tuple) and n.elts and isinstance(n.elts[0], ast.Constant) and isinstance(n.elts[0].value, int):
                    codes[name] = n.elts[0].value
            if codes:
                status_codes[c.name] = codes
    for relative in ['InvenTree/fields.py', 'InvenTree/settings.py', 'generic/states/fields.py', 'report/mixins.py']:
        path = BACKEND / relative
        hashes[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
    data = {
        'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'source_date': '2026-10-29', 'scope': 'repository-owned concrete Django models; source-derived, not live DB introspection',
        'files_sha256': hashes, 'models': models, 'status_codes': status_codes,
    }
    target = OUT / 'current/catalog.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(models)} models, {sum(len(m["fields"]) for m in models)} fields -> {target.relative_to(ROOT)}')
    return data


if __name__ == '__main__':
    extract()
