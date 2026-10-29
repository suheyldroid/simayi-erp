"""Build both schema variants and field-level comparison from the source catalog.

No database connection is used. Explicit design changes are centralized here;
source expressions which cannot be resolved are retained in comments/catalog.
"""

import ast
import copy
import json
import pathlib
import re
from collections import defaultdict

from extract import OUT, ROOT, extract

REL = {'ForeignKey', 'TreeForeignKey', 'OneToOneField'}
RENAME = {'InvenTreeSetting': 'SystemSetting', 'InvenTreeUserSetting': 'UserSetting',
          'InvenTreeCustomUserStateModel': 'CustomStatus', 'ContentType': 'ModelType',
          'ApiToken': 'ApiKey'}
MODULE_TITLES = {
    'auth': 'Kimlik, oturum ve erişim', 'users': 'Kullanıcı profili, grup ve yetki',
    'part': 'Parça kataloğu, BOM ve fiyatlar', 'company': 'Firma, üretici ve tedarikçi',
    'stock': 'Stok, depo, izleme ve test', 'order': 'Satın alma, satış, iade ve transfer',
    'build': 'Üretim ve malzeme tahsisi', 'common': 'Ortak işlevler ve ayarlar',
    'report': 'Rapor ve etiket şablonları', 'importer': 'Veri içe aktarma',
    'plugin': 'Eklenti yapılandırması', 'machine': 'Makine ve sürücüler',
    'scim': 'SCIM yapılandırması', 'system': 'İçerik türleri, etiketler ve Django destek tabloları',
    'currency': 'Döviz kuru sağlayıcısı ve kurlar',
}


def snake(s):
    return re.sub(r'(?<!^)(?=[A-Z][a-z]|(?<=[a-z0-9])[A-Z])', '_', s).lower()


def camel(s):
    parts = s.strip('_').split('_')
    return parts[0].lower() if len(parts) == 1 and parts[0].isupper() else parts[0][:1].lower() + parts[0][1:] + ''.join(x[:1].upper() + x[1:] for x in parts[1:])


def literal(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':'))


def expr(x):
    return x.get('expression') if isinstance(x, dict) and 'expression' in x else x


def f(name, typ, **kw):
    return {'name': name, 'type': typ, 'args': [], 'kwargs': kw,
            'declaration': 'Explicit support/design field', 'source': 'tools/build.py', 'line': 1, 'declared_on': 'support'}


def fk(name, target, null=False, unique=False, action='CASCADE'):
    field = f(name, 'OneToOneField' if unique else 'ForeignKey', null=null, on_delete={'expression': 'models.' + action})
    field['args'] = [target]
    return field


def support_model(name, module, table, fields, uniques=()):
    return {'name': name, 'module': module, 'table': table, 'fields': {x['name']: x for x in fields},
            'virtual': {}, 'meta': {'unique_together': list(uniques)}, 'meta_source': {},
            'description': 'Explicit dependency support model; see scope notes.', 'source': 'tools/build.py', 'line': 1, 'support': True}


def pk():
    return f('id', 'AutoField', primary_key=True)


def framework_models():
    """Known Django 5.2 auth/contenttype and taggit support shapes.

    Deliberately not presented as the complete schema of installed dependencies.
    """
    return [
        support_model('User', 'auth', 'auth_user', [pk(), f('password', 'CharField', max_length=128),
            f('last_login', 'DateTimeField', null=True), f('is_superuser', 'BooleanField', default=False),
            f('username', 'CharField', max_length=150, unique=True), f('first_name', 'CharField', max_length=150, blank=True),
            f('last_name', 'CharField', max_length=150, blank=True), f('email', 'EmailField', max_length=254, blank=True),
            f('is_staff', 'BooleanField', default=False), f('is_active', 'BooleanField', default=True),
            f('date_joined', 'DateTimeField', default={'expression': 'timezone.now'})]),
        support_model('Group', 'auth', 'auth_group', [pk(), f('name', 'CharField', max_length=150, unique=True)]),
        support_model('ContentType', 'system', 'django_content_type', [pk(), f('app_label', 'CharField', max_length=100), f('model', 'CharField', max_length=100)], [('app_label', 'model')]),
        support_model('Permission', 'auth', 'auth_permission', [pk(), f('name', 'CharField', max_length=255), fk('content_type', 'ContentType'), f('codename', 'CharField', max_length=100)], [('content_type', 'codename')]),
        support_model('UserGroup', 'auth', 'auth_user_groups', [pk(), fk('user', 'User'), fk('group', 'Group')], [('user', 'group')]),
        support_model('UserPermission', 'auth', 'auth_user_user_permissions', [pk(), fk('user', 'User'), fk('permission', 'Permission')], [('user', 'permission')]),
        support_model('GroupPermission', 'auth', 'auth_group_permissions', [pk(), fk('group', 'Group'), fk('permission', 'Permission')], [('group', 'permission')]),
        support_model('Tag', 'system', 'taggit_tag', [pk(), f('name', 'CharField', max_length=100, unique=True), f('slug', 'CharField', max_length=100, unique=True)]),
        support_model('TaggedItem', 'system', 'taggit_taggeditem', [pk(), fk('tag', 'Tag'), fk('content_type', 'ContentType'), f('object_id', 'IntegerField', db_index=True)], [('content_type', 'object_id', 'tag')]),
        support_model('ExchangeBackend', 'currency', 'exchange_exchangebackend', [f('name', 'CharField', max_length=255, primary_key=True), f('last_update', 'DateTimeField', auto_now=True), f('base_currency', 'CharField', max_length=3)]),
        support_model('Rate', 'currency', 'exchange_rate', [pk(), f('currency', 'CharField', max_length=3), f('value', 'DecimalField', max_digits=20, decimal_places=6), fk('backend', 'ExchangeBackend')], [('currency', 'backend')]),
    ]


def auth_models():
    uid = lambda: f('id', 'UUIDField', primary_key=True, default={'expression': 'uuid.uuid4'})
    stamps = lambda: [f('created_at', 'DateTimeField', auto_now_add=True), f('updated_at', 'DateTimeField', auto_now=True)]
    return [
        support_model('User', 'auth', 'auth_user', [uid(), f('name', 'TextField'), f('email', 'TextField', unique=True),
            f('email_verified', 'BooleanField', default=False), f('image', 'TextField', null=True), *stamps(),
            f('legacy_user_id', 'IntegerField', null=True, unique=True), f('legacy_username', 'CharField', max_length=150, null=True, unique=True),
            f('first_name', 'CharField', max_length=150, default=''), f('last_name', 'CharField', max_length=150, default=''),
            f('is_active', 'BooleanField', default=True), f('is_staff', 'BooleanField', default=False), f('is_superuser', 'BooleanField', default=False)]),
        support_model('Session', 'auth', 'auth_session', [uid(), fk('user', 'User'), f('token', 'TextField', unique=True),
            f('expires_at', 'DateTimeField'), f('ip_address', 'TextField', null=True), f('user_agent', 'TextField', null=True), *stamps()]),
        support_model('Account', 'auth', 'auth_account', [uid(), fk('user', 'User'), f('account_id', 'TextField'), f('provider_id', 'TextField'),
            f('access_token', 'TextField', null=True), f('refresh_token', 'TextField', null=True), f('id_token', 'TextField', null=True),
            f('access_token_expires_at', 'DateTimeField', null=True), f('refresh_token_expires_at', 'DateTimeField', null=True),
            f('scope', 'TextField', null=True), f('password', 'TextField', null=True), *stamps()], [('provider_id', 'account_id')]),
        support_model('Verification', 'auth', 'auth_verification', [uid(), f('identifier', 'TextField', db_index=True), f('value', 'TextField'), f('expires_at', 'DateTimeField'), *stamps()]),
    ]


def unique_groups(m):
    groups = m['meta'].get('unique_together', [])
    if groups and isinstance(groups[0], str):
        groups = [groups]
    groups = [list(g) for g in groups]
    for c in ast.walk(ast.parse(m['meta_source'].get('constraints', '[]'), mode='eval')):
        if isinstance(c, ast.Call) and ast.unparse(c.func).endswith('UniqueConstraint'):
            kw = {k.arg: k.value for k in c.keywords}
            if 'condition' not in kw and 'fields' in kw:
                groups.append(ast.literal_eval(kw['fields']))
    return groups


def field_type(field):
    typ, kw = field['type'], field['kwargs']
    if typ in {'AutoField', 'IntegerField', 'PositiveIntegerField', 'InvenTreeCustomStatusModelField'}:
        return 'Int', '', 'integer'
    if typ == 'BigIntegerField':
        return 'BigInt', '@db.BigInt', 'bigint'
    if typ == 'BooleanField':
        return 'Boolean', '', 'boolean'
    if typ in {'DecimalField', 'RoundingDecimalField', 'InvenTreeModelMoneyField'}:
        digits, places = kw.get('max_digits', 19), kw.get('decimal_places', 6)
        return 'Decimal', f'@db.Decimal({digits}, {places})', f'numeric({digits},{places})'
    if typ == 'FloatField':
        return 'Float', '@db.DoublePrecision', 'double precision'
    if typ in {'UUIDField', 'InvenTreeUUIDField'}:
        return 'String', '@db.Uuid', 'uuid'
    if typ == 'JSONField':
        return 'Json', '@db.JsonB', 'jsonb'
    if typ == 'DateTimeField':
        return 'DateTime', '@db.Timestamptz(6)', 'timestamptz(6)'
    if typ == 'DateField':
        return 'DateTime', '@db.Date', 'date'
    if typ == 'TextField':
        return 'String', '@db.Text', 'text'
    lengths = {'EmailField': 254, 'URLField': 200, 'InvenTreeURLField': 2000,
               'FileField': 100, 'ImageField': 100, 'StdImageField': 100}
    if typ == 'InvenTreeURLField':
        length = 2000  # Custom constructor overrides any caller max_length.
    else:
        length = kw.get('max_length', lengths.get(typ))
    if typ in {'CharField', *lengths} and isinstance(length, int):
        return 'String', f'@db.VarChar({length})', f'varchar({length})'
    raise ValueError(f'Unhandled field: {field}')


def resolve_default(field, codes):
    k = field['kwargs']
    if field['type'] == 'AutoField':
        return 'autoincrement()', None
    if k.get('auto_now_add') or k.get('auto_now'):
        return 'now()', 'CURRENT_TIMESTAMP'
    val = k.get('default')
    if val is None:
        if k.get('blank') and not k.get('null') and field_type(field)[0] == 'String':
            return '""', "''"
        return None, None
    if isinstance(val, dict) and 'expression' in val:
        x = val['expression']
        if x == 'uuid.uuid4':
            return 'dbgenerated("gen_random_uuid()")', 'gen_random_uuid()'
        if x in {'timezone.now', 'InvenTree.helpers.current_time'}:
            return 'now()', 'CURRENT_TIMESTAMP'
        parts = x.split('.')
        if len(parts) > 1 and parts[0] in codes and parts[1] in codes[parts[0]]:
            val = codes[parts[0]][parts[1]]
        elif x == 'UniqueOptions.NONE':
            val = 0
        elif x == 'UserType.INTERNAL':
            val = 'internal'
        elif x == 'ColorEnum.secondary.value':
            val = 'secondary'
        else:
            return None, None
    if isinstance(val, bool):
        return str(val).lower(), str(val).upper()
    if isinstance(val, (float, int)):
        return str(val), str(val)
    if isinstance(val, str):
        return literal(val), "'" + val.replace("'", "''") + "'"
    return None, None


def target_name(field, model, names):
    target = expr(field['args'][0])
    if target == 'self':
        return model['name']
    target = target.split('.')[-1]
    if target == 'AUTH_USER_MODEL':
        target = 'User'
    return names[target.lower()]


def make_variant(catalog, optimized):
    source = copy.deepcopy(catalog['models']) + framework_models()
    if optimized:
        source = [m for m in source if m['name'] != 'User'] + auth_models()
    names = {m['name'].lower(): m['name'] for m in source}
    source_by_name = {m['name']: m for m in source}
    result = {}
    mappings = []
    for m in source:
        original = m['name']
        name = RENAME.get(original, original) if optimized else original
        table = (m['table'] if m['module'] == 'auth' and original in {'User', 'Session', 'Account', 'Verification'} else snake(name)) if optimized else m['table']
        obj = {'name': name, 'old_name': original, 'module': m['module'], 'table': table,
               'source': m, 'fields': [], 'relations': [], 'reverse': [], 'unique': [], 'indexes': [], 'checks': []}
        result[name] = obj
        for fname, field in m['fields'].items():
            reason = 'Korundu; camelCase erişim' if optimized else 'Kaynak şema'
            if optimized and fname in {'lft', 'rght', 'tree_id', 'level'} and field.get('synthetic', '').startswith('django-mptt'):
                mappings.append((m, field, name, None, 'Kaldırıldı: parent/variantOf + recursive CTE; ağaç taşıma servisi gerekli'))
                continue
            if optimized and original == 'Owner' and fname in {'owner_type', 'owner_id'}:
                mappings.append((m, field, name, None, 'Dönüştürüldü: userId/groupId gerçek FK ve XOR kontrolü'))
                continue
            if optimized and original == 'ApiToken' and fname == 'key':
                mappings.append((m, field, name, None, 'Dönüştürüldü: tokenHash; mevcut anahtarlar geçişte iptal/yenileme'))
                continue
            k = field['kwargs']
            is_rel = field['type'] in REL
            scalar = (camel(fname) if optimized else fname.lstrip('_')) + ('Id' if optimized else '_id') * is_rel
            if optimized and original in {'WebhookMessage', 'EmailMessage', 'EmailThread'} and k.get('primary_key'):
                scalar = 'id'
                reason = 'PK ismi id olarak birleştirildi; UUID değeri korundu'
            col = k.get('db_column') or (fname + '_id' if is_rel else fname)
            if optimized:
                col = snake(scalar)
            if is_rel:
                target = target_name(field, m, names)
                target_model = source_by_name[target]
                target_pk = next(f for f in target_model['fields'].values() if f['kwargs'].get('primary_key'))
                typ, native, sqltyp = field_type(target_pk)
                target = RENAME.get(target, target) if optimized else target
            else:
                typ, native, sqltyp = field_type(field)
            default, sql_default = (resolve_default(field, catalog['status_codes']) if not is_rel else (None, None))
            if not optimized and field['type'] != 'AutoField':
                default, sql_default = None, None
            record = {'name': scalar, 'column': col, 'type': typ, 'native': native, 'sqltype': sqltyp,
                      'null': bool(k.get('null', False)), 'primary': bool(k.get('primary_key', False)),
                      'unique': bool(k.get('unique', False) or field['type'] == 'OneToOneField'),
                      'default': default, 'sql_default': sql_default, 'source': field,
                      'updated': bool(optimized and k.get('auto_now')), 'auto': field['type'] == 'AutoField'}
            obj['fields'].append(record)
            if is_rel:
                action = expr(k.get('on_delete', {'expression': 'models.CASCADE'})).split('.')[-1]
                action_map = {'CASCADE': 'Cascade', 'SET_NULL': 'SetNull', 'PROTECT': 'Restrict', 'RESTRICT': 'Restrict', 'DO_NOTHING': 'NoAction'}
                obj['relations'].append({'name': camel(fname) if optimized else fname.lstrip('_'), 'scalar': scalar,
                    'target': target, 'unique': record['unique'], 'null': record['null'],
                    'action': action_map[action] if optimized else 'NoAction', 'django_action': action})
                if not record['unique']:
                    obj['indexes'].append([scalar])
                if optimized and target == 'User':
                    reason = 'Int kullanıcı FK → UUID; User.legacyUserId ile eşleme'
            elif k.get('db_index') and not record['unique']:
                obj['indexes'].append([scalar])
            if field['type'] in {'PositiveIntegerField', 'InvenTreeCustomStatusModelField'}:
                obj['checks'].append(f'"{col}" >= 0')
            if optimized and not is_rel:
                validators = k.get('validators')
                if isinstance(validators, dict) and 'expression' in validators:
                    for validator in ast.walk(ast.parse(validators['expression'], mode='eval')):
                        if isinstance(validator, ast.Call) and validator.args:
                            func = ast.unparse(validator.func).split('.')[-1]
                            val = validator.args[0]
                            if func in {'MinValueValidator', 'MaxValueValidator'} and isinstance(val, ast.Constant) and isinstance(val.value, (int, float)):
                                op = '>=' if func == 'MinValueValidator' else '<='
                                check = f'"{col}" {op} {val.value}'
                                if check not in obj['checks']:
                                    obj['checks'].append(check)
                if field['type'] == 'InvenTreeModelMoneyField' and not k.get('allow_negative') and not validators:
                    obj['checks'].append(f'"{col}" >= 0')
                if fname == 'metadata':
                    obj['checks'].append(f'"{col}" IS NULL OR jsonb_typeof("{col}") = \'object\'')
            mappings.append((m, field, name, record, reason))
        field_map = {f['source']['name']: f['name'] for f in obj['fields']}
        for group in unique_groups(m):
            if all(x in field_map for x in group):
                obj['unique'].append([field_map[x] for x in group])
        for n in ast.walk(ast.parse(m['meta_source'].get('indexes', '[]'), mode='eval')):
            if isinstance(n, ast.Call):
                for kw in n.keywords:
                    if kw.arg == 'fields':
                        obj['indexes'].append([field_map[x] for x in ast.literal_eval(kw.value)])
        if not optimized and all(x in field_map for x in ['tree_id', 'lft']):
            obj['indexes'].append([field_map['tree_id'], field_map['lft']])
        if original == 'TaggedItem':
            obj['indexes'].append([field_map['content_type'], field_map['object_id']])

    def add_field(model, field, relation=None):
        obj = result[model]
        typ, native, sqltyp = field_type(field)
        k = field['kwargs']
        default, sql_default = resolve_default(field, catalog['status_codes'])
        rec = {'name': camel(field['name']), 'column': field['name'], 'type': typ, 'native': native, 'sqltype': sqltyp,
               'null': k.get('null', False), 'primary': k.get('primary_key', False), 'unique': k.get('unique', False),
               'default': default, 'sql_default': sql_default, 'source': field, 'updated': k.get('auto_now', False), 'auto': False}
        obj['fields'].append(rec)
        if relation:
            obj['relations'].append({'name': relation[0], 'scalar': rec['name'], 'target': relation[1], 'null': rec['null'], 'unique': rec['unique'], 'action': 'Cascade', 'django_action': 'NEW'})

    if optimized:
        add_field('Owner', f('user_id', 'UUIDField', null=True, unique=True), ('user', 'User'))
        add_field('Owner', f('group_id', 'IntegerField', null=True, unique=True), ('group', 'Group'))
        result['Owner']['checks'].append('num_nonnulls("user_id", "group_id") = 1')
        add_field('ApiKey', f('token_hash', 'CharField', max_length=64, unique=True))
        add_field('ApiKey', f('token_prefix', 'CharField', max_length=16))
        for name in ['Part', 'StockItem', 'Build', 'PurchaseOrder', 'SalesOrder', 'ReturnOrder', 'TransferOrder']:
            add_field(name, f('version', 'PositiveIntegerField', default=0))
            result[name]['checks'].append('"version" >= 0')
        indexes = {
            'Part': [['categoryId', 'active', 'id'], ['ipn'], ['variantOfId', 'id'], ['revisionOfId', 'id']],
            'StockItem': [['partId', 'locationId', 'status'], ['locationId', 'status', 'id'], ['expiryDate'], ['batch'], ['serial']],
            'StockItemTracking': [['itemId', 'date'], ['partId', 'date']],
            'StockItemTestResult': [['stockItemId', 'templateId', 'date']],
            'Build': [['status', 'targetDate'], ['partId', 'status']],
            'PurchaseOrder': [['supplierId', 'status'], ['status', 'targetDate']],
            'SalesOrder': [['customerId', 'status'], ['status', 'targetDate']],
            'ReturnOrder': [['customerId', 'status']], 'TransferOrder': [['status', 'targetDate']],
            'NotificationMessage': [['userId', 'read', 'creation']],
            'Attachment': [['modelType', 'modelId']], 'Note': [['modelTypeId', 'modelId']],
            'TaggedItem': [['contentTypeId', 'objectId']],
            'DataImportRow': [['sessionId', 'complete', 'rowIndex']],
            'Session': [['userId', 'expiresAt'], ['expiresAt']], 'Verification': [['expiresAt']],
            'ApiKey': [['userId', 'revoked']], 'EmailMessage': [['threadId', 'timestamp']],
            'WebhookMessage': [['endpointId', 'workedOn']],
        }
        for model, groups in indexes.items():
            result[model]['indexes'].extend(groups)

    # All relationships receive stable, unambiguous names and inverse fields.
    for model in result.values():
        pk_field = next(x for x in model['fields'] if x['primary'])
        model['pk'] = pk_field['name']
        model['pk_column'] = pk_field['column']
    for model in result.values():
        for rel in model['relations']:
            target = result[rel['target']]
            rel['ref'] = target['pk']
            rel['relation_name'] = model['name'] + '_' + rel['name']
            reverse_name = 'from' + model['name'] + rel['name'][:1].upper() + rel['name'][1:]
            if optimized and target['name'] == 'User' and model['name'] in {'Session', 'Account'}:
                reverse_name = model['name'].lower() + 's'
            target['reverse'].append({'name': reverse_name,
                                      'type': model['name'], 'unique': rel['unique'], 'relation_name': rel['relation_name']})
        # Drop redundant leading-column indexes, including unique indexes.
        candidates = sorted({tuple(i) for i in model['indexes']}, key=len, reverse=True)
        covering = [tuple(i) for i in model['unique']] + [(f['name'],) for f in model['fields'] if f['unique'] or f['primary']]
        keep = []
        for idx in candidates:
            if not any(other[:len(idx)] == idx for other in covering + keep):
                keep.append(idx)
        model['indexes'] = keep if optimized else sorted(set(tuple(i) for i in model['indexes']))
        fields = {f['name'] for f in model['fields']}
        for group in model['unique'] + model['indexes']:
            assert set(group) <= fields, (model['name'], group, fields)
    return result, mappings


def render_prisma(models, directory, optimized):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'schema.prisma').write_text('''// PostgreSQL; Prisma ORM 7 multi-file schema.
// See the package README.md before applying; use the optimized variant for the fork.
generator client {
  provider = "prisma-client"
  output   = "../generated/client"
}

datasource db {
  provider = "postgresql"
}
''')
    modules = defaultdict(list)
    for m in models.values():
        lines = [f'/// {m["source"]["description"]}', f'/// Source: {m["source"]["source"]}:{m["source"]["line"]}', f'model {m["name"]} {{']
        for field in m['fields']:
            source = field['source']
            if source['kwargs'].get('default') is not None:
                lines.append(f'  /// Source application default: {expr(source["kwargs"]["default"])}')
            if source.get('synthetic'):
                lines.append(f'  /// {source["synthetic"]}')
            attrs = []
            if field['primary']:
                attrs.append('@id')
            elif field['unique']:
                attrs.append('@unique')
            if field['default']:
                attrs.append('@default(' + field['default'] + ')')
            if field['updated']:
                attrs.append('@updatedAt')
            if field['native']:
                attrs.append(field['native'])
            if field['name'] != field['column']:
                attrs.append('@map(' + literal(field['column']) + ')')
            lines.append(f'  {field["name"]} {field["type"]}{"?" if field["null"] else ""} ' + ' '.join(attrs))
        for rel in m['relations']:
            lines.append(f'  /// Django on_delete: {rel["django_action"]}; see deletion policy in README.')
            lines.append(f'  {rel["name"]} {rel["target"]}{"?" if rel["null"] else ""} @relation({literal(rel["relation_name"])}, fields: [{rel["scalar"]}], references: [{rel["ref"]}], onDelete: {rel["action"]}, onUpdate: NoAction)')
        for rel in m['reverse']:
            lines.append(f'  {rel["name"]} {rel["type"]}{"?" if rel["unique"] else "[]"} @relation({literal(rel["relation_name"])})')
        for group in m['unique']:
            lines.append('  @@unique([' + ', '.join(group) + '])')
        for group in m['indexes']:
            lines.append('  @@index([' + ', '.join(group) + '])')
        lines.extend([f'  @@map({literal(m["table"])})', '}', ''])
        modules[m['module']].append('\n'.join(line.rstrip() for line in lines))
    for module, content in modules.items():
        (directory / f'{module}.prisma').write_text(f'// {MODULE_TITLES[module]}\n\n' + '\n'.join(content))


def sql_name(m, suffix):
    # Stable identifiers within PostgreSQL's 63-byte limit.
    import hashlib
    name = m['table'] + '_' + suffix
    return name if len(name) < 63 else name[:51] + '_' + hashlib.sha1(name.encode()).hexdigest()[:10]


def extras(models, optimized):
    stock = models['StockItem']; note = models['Note']
    def col(m, name):
        return next(f['column'] for f in m['fields'] if f['source']['name'] == name)
    return [
        f'CREATE UNIQUE INDEX "stock_item_unique_part_serial" ON "{stock["table"]}" ("{col(stock, "part")}", "serial") WHERE "serial" IS NOT NULL AND "serial" <> \'\';',
        f'CREATE UNIQUE INDEX "unique_primary_note_per_model" ON "{note["table"]}" ("{col(note, "model_type")}", "{col(note, "model_id")}") WHERE "primary" = TRUE AND "template" = FALSE;',
    ]


def render_sql(models, path, optimized, only_extras=False):
    lines = ['-- Source-derived PostgreSQL equivalent. No live DB was introspected.',
             '-- This file is for an EMPTY database; never run over existing Django tables.',
             '-- Generated by tools/build.py. Review README.md and MIGRATION.md.', 'BEGIN;']
    if not only_extras:
        for m in models.values():
            cols = []
            for field in m['fields']:
                text = f'  "{field["column"]}" {field["sqltype"]}'
                if field['auto']:
                    text += ' GENERATED BY DEFAULT AS IDENTITY'
                if not field['null']:
                    text += ' NOT NULL'
                if field['sql_default']:
                    text += ' DEFAULT ' + field['sql_default']
                if field['primary']:
                    text += ' PRIMARY KEY'
                elif field['unique']:
                    text += ' UNIQUE'
                cols.append(text)
            for i, group in enumerate(m['unique']):
                columns = [next(f['column'] for f in m['fields'] if f['name'] == name) for name in group]
                cols.append('  CONSTRAINT "' + sql_name(m, f'uq_{i}') + '" UNIQUE (' + ', '.join('"' + c + '"' for c in columns) + ')')
            lines.append(f'CREATE TABLE "{m["table"]}" (\n' + ',\n'.join(cols) + '\n);')
        for m in models.values():
            for i, rel in enumerate(m['relations']):
                col = next(f['column'] for f in m['fields'] if f['name'] == rel['scalar'])
                target = models[rel['target']]
                action = {'Cascade': 'CASCADE', 'Restrict': 'RESTRICT', 'NoAction': 'NO ACTION', 'SetNull': 'SET NULL'}[rel['action']]
                deferred = '' if optimized else ' DEFERRABLE INITIALLY DEFERRED'
                lines.append(f'ALTER TABLE "{m["table"]}" ADD CONSTRAINT "{sql_name(m, f"fk_{i}")}" FOREIGN KEY ("{col}") REFERENCES "{target["table"]}" ("{target["pk_column"]}") ON DELETE {action} ON UPDATE NO ACTION{deferred};')
            for i, group in enumerate(m['indexes']):
                columns = [next(f['column'] for f in m['fields'] if f['name'] == name) for name in group]
                lines.append(f'CREATE INDEX "{sql_name(m, f"idx_{i}")}" ON "{m["table"]}" (' + ', '.join('"' + c + '"' for c in columns) + ');')
    for m in models.values():
        for i, check in enumerate(m['checks']):
            lines.append(f'ALTER TABLE "{m["table"]}" ADD CONSTRAINT "{sql_name(m, f"check_{i}")}" CHECK ({check});')
    lines.extend(extras(models, optimized))
    lines.append('COMMIT;')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n\n'.join(lines) + '\n')


def clean_md(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')


def render_docs(catalog, models, mappings, variant):
    folder = OUT / variant / 'modules'; folder.mkdir(parents=True, exist_ok=True)
    modules = defaultdict(list)
    for m in models.values():
        modules[m['module']].append(m)
    for module, items in modules.items():
        rows = [f'# {MODULE_TITLES[module]}', '',
                f'Varyant: **{variant}**. Kaynak commit: `{catalog["source_commit"]}`.', '',
                f'Prisma: [modül şeması](../prisma/{module}.prisma).', '',
                'İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.', '']
        for m in items:
            rows.extend([f'## {m["name"]}', '', f'Tablo: `{m["table"]}`. {m["source"]["description"]}', '',
                         f'Kaynak: `{m["source"]["source"]}:{m["source"]["line"]}`.', '',
                         '| Alan | PostgreSQL | NULL | Varsayılan / not |', '|---|---|---|---|'])
            for field in m['fields']:
                src = field['source']
                notes = []
                if field['primary']: notes.append('PK')
                elif field['unique']: notes.append('UNIQUE')
                if field['default']: notes.append('Prisma: ' + field['default'])
                if 'default' in src['kwargs']: notes.append('Django: ' + str(expr(src['kwargs']['default'])))
                if src['kwargs'].get('auto_now'): notes.append('Uygulama güncelleme zamanı')
                if src['kwargs'].get('auto_now_add'): notes.append('Uygulama oluşturma zamanı')
                if src.get('synthetic'): notes.append(src['synthetic'])
                rows.append(f'| `{field["name"]}` → `{field["column"]}` | `{field["sqltype"]}` | {"Evet" if field["null"] else "Hayır"} | {clean_md("; ".join(notes))} |')
            if m['relations']:
                rows.extend(['', '**İlişkiler**', ''])
                for rel in m['relations']:
                    rows.append(f'- `{rel["scalar"]}` → `{rel["target"]}.{rel["ref"]}`; {"1:1" if rel["unique"] else "N:1"}; SQL onDelete `{rel["action"]}`; kaynak Django `{rel["django_action"]}`.')
            rows.extend(['', '**Kısıtlar ve indeksler**', ''])
            for group in m['unique']: rows.append('- UNIQUE: `' + ', '.join(group) + '`.')
            for group in m['indexes']: rows.append('- INDEX: `' + ', '.join(group) + '`.')
            for check in m['checks']: rows.append('- SQL CHECK: `' + check + '`.')
            if m['old_name'] in {'StockItem', 'Note'}: rows.append('- Koşullu benzersizlik `constraints.sql` dosyasında; Prisma şemasının tek başına uygulanması yeterli değildir.')
            if not (m['unique'] or m['indexes'] or m['checks']): rows.append('- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.')
            if m['source'].get('virtual'):
                rows.extend(['', '**Sütun olmayan Django alanları**', ''])
                for key, v in m['source']['virtual'].items():
                    rows.append(f'- `{key}`: `{v["type"]}`. ' + ('`Tag` / `TaggedItem` tablolarıyla bağlantılıdır.' if v['type'] == 'TaggableManager' else 'Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.'))
            rows.append('')
        (folder / f'{module}.md').write_text('\n'.join(rows) + '\n')

    if variant == 'optimized':
        rows = ['# Alan bazında mevcut → hedef eşlemesi', '',
                'Her kaynak alanı bu listede yer alır. Kaldırılan/dönüştürülen alanların nedeni yazılıdır. Ek hedef alanları modül şemalarında bulunur.', '',
                '| Modül / model | Kaynak alan | Hedef alan | Karar |', '|---|---|---|---|']
        native_names = {m['name'] for m in catalog['models']}
        for m, field, name, target, reason in mappings:
            if m['name'] in native_names:
                rows.append(f'| {m["module"]}.{m["name"]} | `{field["name"]}` | `{name}.{target["name"]}` | {reason} |' if target else f'| {m["module"]}.{m["name"]} | `{field["name"]}` | — | {reason} |')
        (OUT / 'FIELD-MAPPING.md').write_text('\n'.join(rows) + '\n')


def main():
    catalog = extract()
    summary = {}
    for variant, optimized in [('current', False), ('optimized', True)]:
        models, mappings = make_variant(catalog, optimized)
        render_prisma(models, OUT / variant / 'prisma', optimized)
        render_sql(models, OUT / variant / 'schema.sql', optimized)
        render_sql(models, OUT / variant / 'constraints.sql', optimized, only_extras=True)
        render_docs(catalog, models, mappings, variant)
        summary[variant] = {'models': len(models), 'scalar_fields': sum(len(m['fields']) for m in models.values()),
                            'relations': sum(len(m['relations']) for m in models.values()),
                            'modules': {module: sum(m['module'] == module for m in models.values()) for module in MODULE_TITLES}}
        # Machine-readable validation input and migration map.
        (OUT / variant / 'model-map.json').write_text(json.dumps(models, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'schema-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    (OUT / 'optimized/status-codes.ts').write_text('// Source codes are integers so custom states remain extensible.\n' +
        '\n'.join(f'export const {name} = {json.dumps(codes, indent=2)} as const;\n' for name, codes in catalog['status_codes'].items()))
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
