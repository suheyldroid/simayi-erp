// Run: node tools/verify.mjs [absolute path to a locally installed PGlite module]
// Uses isolated, in-memory PostgreSQL. Never connects to the application DB.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'current/catalog.json'), 'utf8'));
const results = { engine: 'PGlite 0.3.15 (PostgreSQL WASM)', prismaCli: 'NOT RUN: Prisma 7 is not installed; network installation permission was declined.', variants: {}, cases: [] };

async function mustFail(db, sql, values, code, label) {
  let actual;
  try { await db.query(sql, values); } catch (error) { actual = error.code; }
  assert.equal(actual, code, label);
  results.cases.push(label);
}

for (const variant of ['current', 'optimized']) {
  const dir = path.join(root, variant);
  const models = JSON.parse(await fs.readFile(path.join(dir, 'model-map.json'), 'utf8'));
  const schemaFiles = (await fs.readdir(path.join(dir, 'prisma'))).filter(f => f.endsWith('.prisma'));
  const schema = (await Promise.all(schemaFiles.map(f => fs.readFile(path.join(dir, 'prisma', f), 'utf8')))).join('\n');
  const blocks = [...schema.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm)];
  assert.equal(blocks.length, Object.keys(models).length);
  for (const [_, name, body] of blocks) {
    const model = models[name];
    assert.ok(model, name);
    const declared = [...body.matchAll(/^  (\w+)\s+(\w+)(\[\]|\?)?(?:\s|$)/gm)].map(m => m[1]);
    assert.equal(new Set(declared).size, declared.length, `duplicate field in ${name}`);
    for (const field of model.fields) assert.ok(declared.includes(field.name), `${name}.${field.name}`);
    for (const relation of model.relations) {
      const target = models[relation.target];
      const local = model.fields.find(f => f.name === relation.scalar);
      const remote = target.fields.find(f => f.name === relation.ref);
      assert.equal(local.type, remote.type, `${name}.${relation.name} scalar type`);
      assert.equal(local.native, remote.native, `${name}.${relation.name} PostgreSQL type`);
      assert.ok(remote.primary || remote.unique);
      assert.ok(relation.action !== 'SetNull' || local.null);
      assert.equal(target.reverse.filter(r => r.relation_name === relation.relation_name).length, 1);
    }
  }
  if (variant === 'current') {
    for (const source of catalog.models) {
      const current = models[source.name];
      assert.ok(current, source.name);
      assert.equal(current.fields.length, Object.keys(source.fields).length, source.name);
      for (const field of current.fields) assert.ok(source.fields[field.source.name]);
    }
  }
  const db = new PGlite();
  results.postgresVersion = (await db.query('SELECT version() AS version')).rows[0].version;
  await db.exec(await fs.readFile(path.join(dir, 'schema.sql'), 'utf8'));
  const tables = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
  assert.equal(tables.rows[0].n, Object.keys(models).length);
  const columns = await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public'");
  assert.equal(columns.rows[0].n, Object.values(models).reduce((n, m) => n + m.fields.length, 0));
  results.variants[variant] = { tables: tables.rows[0].n, columns: columns.rows[0].n, sql: 'PASS', structuralPrismaChecks: 'PASS (not a substitute for prisma validate)' };

  if (variant === 'optimized') {
    async function insert(name, overrides = {}) {
      const m = models[name];
      const data = {};
      for (const f of m.fields) {
        if (f.auto || f.null || f.default) continue;
        const samples = { String: 'test', Int: 1, BigInt: '1', Float: 1, Decimal: '1', Boolean: false, Json: '{}' };
        data[f.column] = f.type === 'DateTime' ? (f.sqltype === 'date' ? '2026-10-29' : '2026-10-29T00:00:00Z') : samples[f.type];
      }
      Object.assign(data, overrides);
      const keys = Object.keys(data);
      const sql = `INSERT INTO "${m.table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`;
      return (await db.query(sql, Object.values(data))).rows[0];
    }

    const user = await insert('User', { name: 'Schema Test', email: 'schema@example.invalid' });
    assert.match(user.id, /^[0-9a-f-]{36}$/);
    const session = await insert('Session', { user_id: user.id, token: 'only-in-memory-test', expires_at: '2026-11-01T00:00:00Z' });
    assert.equal(session.user_id, user.id);
    await insert('Account', { user_id: user.id, account_id: user.id, provider_id: 'credential', password: 'not-a-real-password-hash' });
    await insert('Verification', { identifier: 'test', value: 'test', expires_at: '2026-11-01T00:00:00Z' });
    results.cases.push('Better Auth core insert shapes and UUID user relations');
    const group = await insert('Group', { name: 'Schema Test Group' });
    await db.query('INSERT INTO "owner" (user_id) VALUES ($1)', [user.id]);
    await mustFail(db, 'INSERT INTO "owner" DEFAULT VALUES', [], '23514', 'Owner: exactly one target required');
    await mustFail(db, 'INSERT INTO "owner" (user_id,group_id) VALUES ($1,$2)', [user.id, group.id], '23514', 'Owner: two targets rejected');
    await mustFail(db, 'INSERT INTO "owner" (group_id) VALUES ($1)', [2147483647], '23503', 'Owner: missing target rejected by FK');

    const part = await insert('Part', { name: 'Test Part' });
    const part2 = await insert('Part', { name: 'Test Part 2' });
    const stock = await insert('StockItem', { part_id: part.id, serial: 'SERIAL-1', quantity: '9999999999.99999' });
    assert.equal((await db.query('SELECT quantity::text AS amount FROM stock_item WHERE id = $1', [stock.id])).rows[0].amount, '9999999999.99999');
    await insert('StockItem', { part_id: part2.id, serial: 'SERIAL-1' });
    await insert('StockItem', { part_id: part.id, serial: null });
    await insert('StockItem', { part_id: part.id, serial: null });
    await insert('StockItem', { part_id: part.id, serial: '' });
    await insert('StockItem', { part_id: part.id, serial: '' });
    await mustFail(db, 'UPDATE stock_item SET serial = $1, part_id = $2 WHERE part_id = $3', ['SERIAL-1', part.id, part2.id], '23505', 'Nonempty serial unique within a part; NULL/empty remain allowed');
    await mustFail(db, 'UPDATE stock_item SET quantity = -1 WHERE id = $1', [stock.id], '23514', 'Negative stock quantity rejected');
    await mustFail(db, "UPDATE part SET metadata = '[]'::jsonb WHERE id = $1", [part.id], '23514', 'Metadata must be an object');
    results.cases.push('Decimal quantity exact round-trip');

    const modelType = await insert('ModelType', { app_label: 'part', model: 'part' });
    const note = await insert('Note', { model_type_id: modelType.id, model_id: part.id, primary: true, template: false });
    const second = await insert('Note', { model_type_id: modelType.id, model_id: part.id, primary: false, template: false });
    await mustFail(db, 'UPDATE note SET "primary" = TRUE WHERE id = $1', [second.id], '23505', 'Only one primary non-template note per target');
    await insert('Note', { model_type_id: modelType.id, model_id: part.id, primary: true, template: true });
    assert.ok(note.id);
    // Same stock version can only be consumed once by compare-and-swap writes.
    const firstWrite = await db.query('UPDATE stock_item SET version = version + 1 WHERE id = $1 AND version = 0 RETURNING id', [stock.id]);
    const staleWrite = await db.query('UPDATE stock_item SET version = version + 1 WHERE id = $1 AND version = 0 RETURNING id', [stock.id]);
    assert.equal(firstWrite.rows.length, 1);
    assert.equal(staleWrite.rows.length, 0);
    results.cases.push('Optimistic version predicate rejects a stale write');
  }
  await db.close();
}
await fs.writeFile(path.join(root, 'validation-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
