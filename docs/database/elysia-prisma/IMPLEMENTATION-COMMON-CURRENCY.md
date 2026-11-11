# Common and currency cutover

The common module, `/common` management screen, and public model-types catalog are removed.
Historical schema notes remain in [DESIGN.md](DESIGN.md) and [common](optimized/modules/common.md). Those snapshots are not the running contract.

`src/modules/common/` is gone. `app.ts` does not mount a common controller. There is no currency controller or refresh worker.
Generic paging and resource DTOs live in `src/lib/dto.ts`. Tenant row publishing uses `src/lib/publish.ts`. Built-in stock, build, and purchase-order status labels live in `src/lib/status.ts`. Purchase-order and build references use the fixed patterns `PO-{ref:04d}` and `BO-{ref:04d}` in `src/lib/reference.ts`.
`ModelType` remains an internal registry for parameter templates, parameters, notes, tags, and notifications. It has no public catalog endpoint. Part and parameter unit strings remain ordinary product fields. Built-in status integers and transitions remain.

`erp_settings` remains for users, profiles, and owners. It does not gate a settings catalog.

`20261102000000_remove_common_features` is a forward migration. This document did not record it as applied. Apply it in a maintenance window after a backup, with application writers stopped. PostgreSQL does not treat the file as atomic unless the file says so. The script starts a transaction, then drops; a later failure rolls the whole scope back. It drops `project_code`, `custom_status`, `custom_unit`, `system_setting`, and `user_setting`, and drops `project_code_id` / `status_custom_key` from purchase orders, builds, and stock items. Custom labels, project links, custom unit definitions, and stored setting overrides are discarded. Existing order and build reference values stay.

## Deployment

From `apps/api`, generate the client and apply the committed migrations:

```bash
bun run db:generate
bun run db:deploy
```

`20261101000000_common_currency` adds the original common tables and registered ModelType records. It does not change existing credentials or business grants.
`20261101013000_remove_currency_external_email` is a later forward migration. Apply it in a maintenance window after a backup, with application writers stopped. PostgreSQL does not treat the file as atomic unless the file says so. The script starts a transaction, takes `ACCESS EXCLUSIVE` locks in alphabetical order on `company`, `exchange_backend`, `part_internal_price_break`, `part_sell_price_break`, `purchase_order`, `purchase_order_extra_line`, `purchase_order_line_item`, `rate`, `stock_item`, and `supplier_price_break`, then runs the denomination guard, then the drops. A failure after the guard rolls the whole scope back, including the locks. It drops `exchange_backend` and `rate`, price denomination columns, `build.external`, `company.email`, `contact.email`, the company name/email uniqueness index, `email_thread`, `email_message`, their `model_type` rows, and the currency system-setting rows. Numeric prices, quantities, discounts, and totals are not rewritten. No conversion and no default currency are written. If nonzero priced rows already use more than one currency code, including a mix of a stored code and a missing label, the guard raises, the transaction rolls back, and no drop is kept. The operator reconciles those amounts to one denomination by hand and retries. The migration does not convert them. When zero or one code is present, the denomination labels are discarded with the columns. That label loss is destructive; the backup is the way back to the old labels. Company names are not given a new unique constraint. Auth `user.email`, `emailVerified`, and the unique email index are not part of this migration. That is an intentional limitation: email is not eliminated, and username sign-in without an email address is not done. It waits for an architecture selection. Session DTOs, login, admin bootstrap, and security auth paths stay on the current Better Auth email contract.
User foreign keys retain the existing Better Auth string IDs. No conversion to PostgreSQL UUID occurs.

Delegated organization access never grants native Better Auth account, role, or password administration. Platform `user.role` `admin` is separate from the organization `admin` role.
Mutations use serializable transactions. A concurrent transaction conflict returns HTTP 409 through the existing error handler.

## Prices

Supplier, sell, and internal price breaks, stock purchase prices, and purchase-order line, extra-line, and total amounts stay decimal strings.
There is no currency code, exchange rate, or conversion on those values.
A purchase-order line without an explicit price takes the supplier price break with the greatest quantity that does not exceed the ordered quantity.
`src/lib/decimal.ts` uses an isolated Prisma Decimal constructor with 80-digit intermediate precision and half-up rounding.
Stored prices use `Decimal(19,6)`. There is no pricing display setting that changes storage precision.
The API does not send mail. Company and contact records do not store email. Auth account email remains on the user record, so email is not fully eliminated. Username sign-in without an email address is not done and waits for an architecture selection.

## Static checks

From `apps/api`:

```bash
bun run check-types
bun run lint
```

From `apps/web`, run `bun run build` and `bun run lint` for frontend compilation and static analysis.

Project policy prohibits automated and manual tests. Schema generation and static checks do not establish runtime correctness.
