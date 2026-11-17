import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import { CatalogService } from "@/lib/catalog";
import type { TenantActor } from "@/lib/tenant";
import { SystemPreferencesService } from "../system-preferences/service";
import { BranchesService } from "../branches/service";
import { decimal } from "@/lib/decimal";
import { RecipesFormatter } from "./formatter";
import {
  effectiveRecipeSelect,
  RecipesModel,
  type Database,
  type EffectiveRecipe,
  type RecipeRecord,
} from "./model";

/** The two scopes a recipe request can run in. */
type RecipeContext = { organizationId: string; branchId: number | null };

/**
 * A validated ingredient to create inside the owning recipe. `childRecipeKey`
 * is always the canonical recipe identity of the context: a company template
 * id for shared definitions or a branch-local recipe id.
 */
type IngredientWrite = {
  organizationId: string;
  itemId: number | null;
  childRecipeId: number | null;
  quantity: Prisma.Decimal;
  note: string;
};

type IngredientInput = RecipesModel["body"]["ingredients"][number];

type Assignment = { active: boolean; version: number };

/** A short-lived recipe row used for reference validation only. */
type RecipeRefRow = {
  id: number;
  uuid: string;
  name: string;
  active: boolean;
  branchId: number | null;
  sourceRecipeId: number | null;
};

export abstract class RecipeService {
  static async lock(db: Prisma.TransactionClient): Promise<void> {
    // pg_advisory_xact_lock returns void; execute it without a result row.
    await db.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(814204::bigint)`,
    );
  }

  static name(value: string): string {
    const name = value.trim();
    if (!name)
      throw new createError.UnprocessableEntity("Recipe name is required");
    return name;
  }

  /**
   * Exact product code, or null. Surrounding whitespace is not part of the
   * identity and an empty result clears it; the string is never parsed as a
   * number, so leading zeros stay significant.
   */
  static code(value: string | null | undefined): string | null {
    const code = value?.trim() ?? "";
    return code === "" ? null : code;
  }

  static quantity(value: string): Prisma.Decimal {
    const result = decimal(value.trim(), 5, 10);
    if (!result.gt(0))
      throw new createError.UnprocessableEntity(
        "Ingredient quantity must be greater than zero",
      );
    return result;
  }

  /** Scope of a read from the verified request actor. */
  static context(actor: TenantActor): RecipeContext {
    return { organizationId: actor.organizationId, branchId: actor.branchId };
  }

  /**
   * Authoritative active-branch guard for a branch recipe write. The branch
   * lifecycle lock is acquired inside the caller's transaction before the
   * catalog and recipe locks so a concurrent deactivation cannot commit
   * alongside this write.
   */
  static async activeBranchId(
    db: Prisma.TransactionClient,
    actor: TenantActor,
  ): Promise<number> {
    const branch = await BranchesService.requireActor(db, actor, {
      active: true,
    });
    return branch.branchId;
  }

  /**
   * A recipe price is quoted in the fixed system currency. Existing price
   * snapshots are never rewritten; a sale still requires the recorded money
   * currency to match, so a legacy finance mismatch fails clearly instead of
   * recording a price in a currency the organization no longer uses.
   */
  static async price(
    db: Prisma.TransactionClient,
    value: string | null,
  ): Promise<{
    sellingPrice: Prisma.Decimal | null;
    priceCurrencyCode: string | null;
  }> {
    if (value === null) return { sellingPrice: null, priceCurrencyCode: null };
    const amount = decimal(value.trim(), 6, 13);
    if (amount.lt(0))
      throw new createError.UnprocessableEntity(
        "Selling price cannot be negative",
      );
    const priceCurrencyCode =
      await SystemPreferencesService.requireCurrency(db);
    return { sellingPrice: amount, priceCurrencyCode };
  }

  /**
   * Sellability gate for a recipe write. The merged state that the write would
   * persist is checked, not only the request fields: marking a recipe sellable
   * while it has no price, or clearing the price of an already sellable recipe,
   * fails before anything is written. Zero is an explicit valid price, so only
   * a missing amount or currency blocks it. Turning sellability off keeps any
   * stored price and currency untouched.
   */
  private static sellable(
    value: boolean,
    price: {
      sellingPrice: Prisma.Decimal | null;
      priceCurrencyCode: string | null;
    },
  ): boolean {
    if (
      value &&
      (price.sellingPrice === null || price.priceCurrencyCode === null)
    )
      throw Object.assign(
        new createError.UnprocessableEntity(
          "Sellable recipes require a selling price",
        ),
        { apiCode: "RECIPE_PRICE_REQUIRED" },
      );
    return value;
  }

  /** Company recipes are available unless a branch explicitly opts out. */
  private static effectiveActive(
    root: Pick<RecipeRefRow, "active" | "branchId">,
    assignment: Pick<Assignment, "active"> | null,
    branchId: number | null,
  ): boolean {
    return (
      root.active &&
      (root.branchId !== null ||
        branchId === null ||
        (assignment?.active ?? true))
    );
  }

  /**
   * Composes one effective definition from its canonical row and, when the
   * branch customizes it, the branch copy. Company activation is the global
   * gate; the branch assignment is independent of the copied content and a
   * missing assignment is exactly "active, version 0" without a write.
   */
  private static effective(
    root: RecipeRecord,
    definition: RecipeRecord | null,
    assignment: Assignment | null,
    branchId: number | null,
  ): EffectiveRecipe {
    const local = root.branchId !== null;
    const effectiveRow = definition ?? root;
    return {
      key: root.id,
      definitionId: effectiveRow.id,
      uuid: root.uuid,
      sourceUuid: definition === null ? null : root.uuid,
      customizationUuid: definition?.uuid ?? null,
      scope: local ? "local" : definition === null ? "company" : "customized",
      name: effectiveRow.name,
      code: effectiveRow.code,
      description: effectiveRow.description,
      // Availability remains globally gated even with a branch customization.
      active: RecipeService.effectiveActive(root, assignment, branchId),
      // Sellability is content of the definition that sells, so a branch
      // customization pins its own value exactly like its code and price.
      sellable: effectiveRow.sellable,
      version: effectiveRow.version,
      branch: root.branchId === null ? null : root.branch,
      sellingPrice: effectiveRow.sellingPrice,
      priceCurrencyCode: effectiveRow.priceCurrencyCode,
      sourceVersion: definition?.sourceVersion ?? null,
      sourceActive: root.active,
      activation:
        branchId === null || local
          ? null
          : {
              active: assignment?.active ?? true,
              version: assignment?.version ?? 0,
            },
      ingredientCount: effectiveRow._count.ingredients,
      createdAt: effectiveRow.createdAt,
      updatedAt: effectiveRow.updatedAt,
      lines: effectiveRow.ingredients,
    };
  }

  /**
   * Resolves the effective recipe graph for one verified context, breadth
   * first. Company context only ever sees company templates. Branch context
   * maps every company template to that branch's customization when one
   * exists, so a child reference always resolves inside the same branch.
   * Cross-branch definitions are rejected; a referenced definition that is
   * absent stays absent for the caller's validation instead of being guessed.
   */
  static async graph(
    db: Database,
    organizationId: string,
    branchId: number | null,
    roots: readonly number[],
  ): Promise<Map<number, EffectiveRecipe>> {
    const graph = new Map<number, EffectiveRecipe>();
    // Definition rows referenced by their own id are mapped back to the
    // canonical identity of their company source.
    const aliases = new Map<number, number>();
    let pending = new Set<number>(roots);
    while (pending.size > 0) {
      const keys = [...pending];
      pending = new Set();
      const rows =
        branchId === null
          ? await db.recipe.findMany({
              where: { organizationId, branchId: null, id: { in: keys } },
              select: effectiveRecipeSelect,
            })
          : await db.recipe.findMany({
              where: {
                organizationId,
                OR: [
                  { branchId: null, id: { in: keys } },
                  { branchId, id: { in: keys } },
                  { branchId, sourceRecipeId: { in: keys } },
                ],
              },
              select: effectiveRecipeSelect,
            });
      if (branchId !== null) {
        const foreign = await db.recipe.findMany({
          where: {
            organizationId,
            id: { in: keys },
            branchId: { not: null },
          },
          select: { id: true, branchId: true },
        });
        if (foreign.some((row) => row.branchId !== branchId))
          throw new createError.UnprocessableEntity(
            "An ingredient recipe belongs to another branch and cannot be used here",
          );
      }
      const byId = new Map<number, RecipeRecord>(
        rows.map((row) => [row.id, row]),
      );
      const overrides = new Map<number, RecipeRecord>();
      for (const row of rows)
        if (row.sourceRecipeId !== null) {
          overrides.set(row.sourceRecipeId, row);
          aliases.set(row.id, row.sourceRecipeId);
        }
      const companyKeys = keys.filter(
        (key) => byId.get(key)?.branchId === null,
      );
      const assignments =
        branchId === null || companyKeys.length === 0
          ? []
          : await db.branchRecipe.findMany({
              where: {
                organizationId,
                branchId,
                recipeId: { in: companyKeys },
              },
              select: { recipeId: true, active: true, version: true },
            });
      const assignmentByRecipe = new Map<number, Assignment>(
        assignments.map((assignment) => [
          assignment.recipeId,
          { active: assignment.active, version: assignment.version },
        ]),
      );
      for (const key of keys) {
        const root = byId.get(key);
        if (!root) {
          const alias = rows.find(
            (row) => row.id === key && row.sourceRecipeId !== null,
          );
          if (alias && alias.sourceRecipeId !== null) {
            pending.add(alias.sourceRecipeId);
            continue;
          }
          throw new createError.UnprocessableEntity(
            "An ingredient recipe was not found in this scope",
          );
        }
        if (root.sourceRecipeId !== null) {
          pending.add(root.sourceRecipeId);
          continue;
        }
        if (root.branchId !== null && root.branchId !== branchId)
          throw new createError.UnprocessableEntity(
            "An ingredient recipe belongs to another branch and cannot be used here",
          );
        const override = branchId === null ? undefined : overrides.get(key);
        const assignment = assignmentByRecipe.get(key) ?? null;
        const effective = RecipeService.effective(
          root,
          override ?? null,
          assignment,
          branchId,
        );
        graph.set(key, effective);
        for (const line of effective.lines)
          if (line.childRecipeId !== null && !graph.has(line.childRecipeId))
            pending.add(line.childRecipeId);
      }
    }
    if (aliases.size > 0) {
      const canonical = (id: number): number => {
        let current = id;
        for (let guard = 0; guard < aliases.size; guard += 1) {
          const next = aliases.get(current);
          if (next === undefined) return current;
          current = next;
        }
        return current;
      };
      for (const recipe of graph.values())
        recipe.lines = recipe.lines.map((line) =>
          line.childRecipeId === null ||
          aliases.get(line.childRecipeId) === undefined
            ? line
            : { ...line, childRecipeId: canonical(line.childRecipeId) },
        );
    }
    return graph;
  }

  private static cycleError(): createError.HttpError {
    return new createError.UnprocessableEntity(
      "This ingredient would create a recipe cycle in one or more branches: the referenced recipe already contains this recipe, directly or indirectly",
    );
  }

  /**
   * Iterative acyclicity check over a resolved effective graph. Missing nodes
   * are impossible here because `graph` rejects them, so a visiting marker is
   * always a real cycle.
   */
  private static assertNoCycle(
    graph: ReadonlyMap<number, EffectiveRecipe>,
  ): void {
    const state = new Map<number, "visiting" | "done">();
    for (const start of graph.keys()) {
      if (state.has(start)) continue;
      const stack: { id: number; index: number }[] = [{ id: start, index: 0 }];
      state.set(start, "visiting");
      while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        if (!frame) break;
        const node = graph.get(frame.id);
        if (!node) {
          state.set(frame.id, "done");
          stack.pop();
          continue;
        }
        if (frame.index < node.lines.length) {
          const line = node.lines[frame.index];
          if (!line) {
            state.set(frame.id, "done");
            stack.pop();
            continue;
          }
          frame.index += 1;
          if (line.childRecipeId === null) continue;
          if (state.get(line.childRecipeId) === "visiting")
            throw RecipeService.cycleError();
          if (state.get(line.childRecipeId) === "done") continue;
          state.set(line.childRecipeId, "visiting");
          stack.push({ id: line.childRecipeId, index: 0 });
          continue;
        }
        state.set(frame.id, "done");
        stack.pop();
      }
    }
  }

  /**
   * Rejects an ingredient write that would make the effective graph cyclic.
   * A branch write only has to check its own branch. A company write changes
   * the shared template, so every branch that owns a customization must still
   * be acyclic afterwards: a branch override can turn an acyclic company edge
   * into an effective cycle (`A -> B` shared while the branch's `B` already
   * contains `A`). A shared path can only leave the company graph through such
   * an override. Branches that customize the edited recipe itself are
   * unaffected because their content is isolated from the shared lines.
   * The caller holds the recipe advisory lock, so two opposing edits cannot
   * each observe the other's old graph and commit a cycle together.
   */
  private static async assertAcyclic(
    db: Database,
    organizationId: string,
    branchId: number | null,
    parentKey: number,
    childKeys: readonly number[],
  ): Promise<void> {
    if (childKeys.length === 0) return;
    if (branchId !== null) {
      const graph = await RecipeService.graph(
        db,
        organizationId,
        branchId,
        childKeys,
      );
      if (graph.has(parentKey)) throw RecipeService.cycleError();
      return;
    }
    const shared = await RecipeService.graph(
      db,
      organizationId,
      null,
      childKeys,
    );
    if (shared.has(parentKey)) throw RecipeService.cycleError();
    // A shared path can only leave the company graph through a branch
    // customization, so only branches that own one can gain a cycle. A branch
    // that customizes the edited recipe itself is unaffected: its own content
    // replaces the shared lines that just changed.
    const customized = await db.recipe.findMany({
      where: {
        organizationId,
        branchId: { not: null },
        sourceRecipeId: { not: null },
      },
      select: { branchId: true, sourceRecipeId: true },
    });
    const branchIds = new Set<number>();
    const customizesParent = new Set<number>();
    for (const row of customized) {
      if (row.branchId === null) continue;
      branchIds.add(row.branchId);
      if (row.sourceRecipeId === parentKey) customizesParent.add(row.branchId);
    }
    for (const affectedBranchId of branchIds) {
      if (customizesParent.has(affectedBranchId)) continue;
      const graph = await RecipeService.graph(
        db,
        organizationId,
        affectedBranchId,
        childKeys,
      );
      if (graph.has(parentKey)) throw RecipeService.cycleError();
    }
  }

  /**
   * Validate a complete ingredient list in one read. Company context accepts
   * only company templates, so a shared recipe can never depend on a
   * branch-local definition. Branch context accepts the branch's effective
   * catalog (company templates, this branch's customizations, and its local
   * recipes) and stores canonical identities, so a later customization of a
   * child is picked up everywhere in the branch.
   */
  static async ingredients(
    db: Database,
    context: RecipeContext,
    parentKey: number | null,
    input: readonly IngredientInput[],
  ): Promise<IngredientWrite[]> {
    const { organizationId, branchId } = context;
    const itemUuids = new Set<string>();
    const recipeUuids = new Set<string>();
    for (const row of input)
      if (row.kind === "item") itemUuids.add(row.itemUuid.toLowerCase());
      else recipeUuids.add(row.recipeUuid.toLowerCase());
    const items =
      itemUuids.size === 0
        ? []
        : await db.part.findMany({
            where: { organizationId, uuid: { in: [...itemUuids] } },
            select: {
              id: true,
              uuid: true,
              name: true,
              active: true,
              unit: { select: { id: true } },
            },
          });
    const recipeRows: RecipeRefRow[] =
      recipeUuids.size === 0
        ? []
        : await db.recipe.findMany({
            where: {
              organizationId,
              uuid: { in: [...recipeUuids] },
              ...(branchId === null
                ? { branchId: null }
                : { OR: [{ branchId: null }, { branchId }] }),
            },
            select: {
              id: true,
              uuid: true,
              name: true,
              active: true,
              branchId: true,
              sourceRecipeId: true,
            },
          });
    if (branchId !== null && recipeUuids.size > 0) {
      const foreign = await db.recipe.findMany({
        where: {
          organizationId,
          uuid: { in: [...recipeUuids] },
          branchId: { not: null },
        },
        select: { uuid: true, branchId: true },
      });
      if (foreign.some((row) => row.branchId !== branchId))
        throw new createError.UnprocessableEntity(
          "An ingredient recipe belongs to another branch and cannot be used here",
        );
    }
    const companyRecipeIds = recipeRows
      .filter((row) => row.branchId === null)
      .map((row) => row.id);
    const assignments =
      branchId === null || companyRecipeIds.length === 0
        ? []
        : await db.branchRecipe.findMany({
            where: {
              organizationId,
              branchId,
              recipeId: { in: companyRecipeIds },
            },
            select: { recipeId: true, active: true },
          });
    const assignmentByRecipe = new Map(
      assignments.map((assignment) => [assignment.recipeId, assignment]),
    );
    const itemByUuid = new Map(
      items.map((item) => [item.uuid.toLowerCase(), item]),
    );
    const recipeByUuid = new Map(
      recipeRows.map((recipe) => [recipe.uuid.toLowerCase(), recipe]),
    );
    const seenItems = new Set<number>();
    const seenRecipes = new Set<number>();
    const childKeys = new Set<number>();
    const writes = input.map((row): IngredientWrite => {
      if (row.kind === "item") {
        const item = itemByUuid.get(row.itemUuid.toLowerCase());
        if (!item)
          throw new createError.NotFound("Ingredient item was not found");
        if (seenItems.has(item.id))
          throw new createError.Conflict(
            `Ingredient item ${item.uuid} appears more than once in the recipe`,
          );
        seenItems.add(item.id);
        if (!item.active)
          throw new createError.UnprocessableEntity(
            `${item.name} cannot be used as an ingredient: it must be an active item`,
          );
        if (!item.unit)
          throw new createError.UnprocessableEntity(
            `${item.name} has no unit; assign a unit before using it as an ingredient`,
          );
        return {
          organizationId,
          itemId: item.id,
          childRecipeId: null,
          quantity: RecipeService.quantity(row.quantity),
          note: row.note?.trim() ?? "",
        };
      }
      const recipe = recipeByUuid.get(row.recipeUuid.toLowerCase());
      if (!recipe)
        throw new createError.NotFound(
          "Ingredient recipe was not found in this scope",
        );
      if (recipe.sourceRecipeId !== null)
        throw new createError.UnprocessableEntity(
          "Use the company recipe or the branch-local recipe reference, not a customization definition",
        );
      const key = recipe.id;
      if (parentKey !== null && key === parentKey)
        throw new createError.UnprocessableEntity(
          "A recipe cannot use itself as an ingredient",
        );
      if (seenRecipes.has(key))
        throw new createError.Conflict(
          `Ingredient recipe ${recipe.uuid} appears more than once in the recipe`,
        );
      seenRecipes.add(key);
      const active = RecipeService.effectiveActive(
        recipe,
        assignmentByRecipe.get(key) ?? null,
        branchId,
      );
      if (!active)
        throw new createError.UnprocessableEntity(
          recipe.branchId === null && branchId !== null
            ? `${recipe.name} cannot be used as an ingredient: activate it for this branch first`
            : `${recipe.name} cannot be used as an ingredient: it must be an active recipe`,
        );
      childKeys.add(key);
      return {
        organizationId,
        itemId: null,
        childRecipeId: key,
        quantity: RecipeService.quantity(row.quantity),
        note: row.note?.trim() ?? "",
      };
    });
    if (parentKey !== null)
      await RecipeService.assertAcyclic(
        db,
        organizationId,
        branchId,
        parentKey,
        [...childKeys],
      );
    return writes;
  }

  /** Internal integer lookup of one canonical recipe row. */
  static async load(
    db: Database,
    organizationId: string,
    id: number,
  ): Promise<RecipeRecord> {
    const row = await db.recipe.findUnique({
      where: { organizationId_id: { organizationId, id } },
      select: effectiveRecipeSelect,
    });
    if (!row) throw new createError.NotFound("Recipe was not found");
    return row;
  }

  /**
   * Canonical row behind a public selector. A company root UUID stays the
   * selector for every branch, including when that branch customizes it; a
   * branch-local UUID resolves only inside its own branch.
   */
  static async loadSelector(
    db: Database,
    context: RecipeContext,
    uuid: string,
  ): Promise<RecipeRecord> {
    const row = await db.recipe.findFirst({
      where: {
        organizationId: context.organizationId,
        uuid,
        sourceRecipeId: null,
        ...(context.branchId === null
          ? { branchId: null }
          : {
              OR: [{ branchId: context.branchId }, { branchId: null }],
            }),
      },
      select: effectiveRecipeSelect,
    });
    if (!row) throw new createError.NotFound("Recipe was not found");
    return row;
  }

  /**
   * Canonical recipe ids that can carry one of these exact product codes in the
   * batch branch. A branch customization can replace the code it inherited, so
   * both rows whose own code matches and the customizations that pin a matching
   * code are candidates; the caller keeps only those whose resolved effective
   * code still equals the value, so a changed override never matches its
   * obsolete root code. Inactive roots stay candidates so the caller can
   * report a resolved but inactive recipe instead of an unmatched code, and
   * can still prefer an active duplicate. Two queries for the whole batch,
   * never one per row.
   */
  static async codeCandidates(
    db: Database,
    organizationId: string,
    branchId: number,
    codes: readonly string[],
  ): Promise<number[]> {
    if (codes.length === 0) return [];
    const values = [...new Set(codes)];
    // An override's own `active` flag is deliberately not filtered here: the
    // effective gate comes from the company root and the branch activation,
    // which the caller resolves through the effective graph.
    const roots = await db.recipe.findMany({
      where: {
        organizationId,
        sourceRecipeId: null,
        code: { in: values },
        OR: [{ branchId: null }, { branchId }],
      },
      select: { id: true },
    });
    const overrides = await db.recipe.findMany({
      where: {
        organizationId,
        branchId,
        sourceRecipeId: { not: null },
        code: { in: values },
      },
      select: { sourceRecipeId: true },
    });
    const keys = new Set(roots.map((row) => row.id));
    for (const override of overrides)
      if (override.sourceRecipeId !== null) keys.add(override.sourceRecipeId);
    return [...keys];
  }

  /** Public effective detail of one selector inside the request context. */
  static async detail(
    db: Database,
    context: RecipeContext,
    root: RecipeRecord,
  ): Promise<RecipesModel["detail"]> {
    const graph = await RecipeService.graph(
      db,
      context.organizationId,
      context.branchId,
      [root.id],
    );
    const effective = graph.get(root.id);
    if (!effective) throw new createError.NotFound("Recipe was not found");
    return RecipesFormatter.toDetail(effective, graph);
  }

  private static async write<T>(
    run: (db: Prisma.TransactionClient) => Promise<T>,
    actor?: TenantActor,
  ): Promise<T> {
    return prisma.$transaction(
      async (db) => {
        // Branch lifecycle guard first; then the global lock order: catalog
        // 814203, recipes 814204, stock 814205, finance 814207.
        if (actor) await RecipeService.activeBranchId(db, actor);
        await CatalogService.lockItem(db);
        await RecipeService.lock(db);
        return run(db);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  static async index(
    actor: TenantActor,
    query: RecipesModel["query"],
  ): Promise<RecipesModel["list"]> {
    const context = RecipeService.context(actor);
    const active = CatalogService.flag(query.active);
    const sellableOnly = CatalogService.flag(query.sellable);
    const search = query.search?.trim().toLowerCase();
    const matches = (recipe: EffectiveRecipe): boolean => {
      if (active !== undefined && recipe.active !== active) return false;
      if (sellableOnly !== undefined && recipe.sellable !== sellableOnly)
        return false;
      if (!search) return true;
      return (
        recipe.name.toLowerCase().includes(search) ||
        (recipe.code ?? "").toLowerCase().includes(search) ||
        recipe.description.toLowerCase().includes(search)
      );
    };
    const { organizationId, branchId } = context;
    // The company catalog lists canonical company templates and every
    // branch-local recipe of the organization; customization storage rows are
    // never listed because they are not a resource of their own. The explicit
    // template-only filter keeps the company-template ingredient picker from
    // offering branch-local children.
    const templatesOnly = CatalogService.flag(query.templates) === true;
    if (branchId === null) {
      const where: Prisma.RecipeWhereInput = {
        organizationId,
        sourceRecipeId: null,
        ...(templatesOnly ? { branchId: null } : {}),
        ...(active === undefined ? {} : { active }),
        ...(sellableOnly === undefined ? {} : { sellable: sellableOnly }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [rows, total] = await prisma.$transaction([
        prisma.recipe.findMany({
          where,
          select: effectiveRecipeSelect,
          orderBy: [{ name: "asc" }, { uuid: "asc" }],
          take: query.limit,
          skip: query.offset,
        }),
        prisma.recipe.count({ where }),
      ]);
      return {
        items: rows.map((row) =>
          RecipesFormatter.toSummary(
            RecipeService.effective(row, null, null, null),
          ),
        ),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    }
    const rows = await prisma.recipe.findMany({
      where: {
        organizationId,
        OR: [
          { branchId: null, sourceRecipeId: null },
          { branchId, sourceRecipeId: null },
          { branchId, sourceRecipeId: { not: null } },
        ],
      },
      select: effectiveRecipeSelect,
    });
    const assignments = await prisma.branchRecipe.findMany({
      where: { organizationId, branchId },
      select: { recipeId: true, active: true, version: true },
    });
    const assignmentByRecipe = new Map<number, Assignment>(
      assignments.map((assignment) => [
        assignment.recipeId,
        { active: assignment.active, version: assignment.version },
      ]),
    );
    const overrides = new Map<number, RecipeRecord>();
    for (const row of rows)
      if (row.sourceRecipeId !== null) overrides.set(row.sourceRecipeId, row);
    const effective: EffectiveRecipe[] = [];
    for (const row of rows) {
      if (row.branchId !== null) continue;
      effective.push(
        RecipeService.effective(
          row,
          overrides.get(row.id) ?? null,
          assignmentByRecipe.get(row.id) ?? null,
          branchId,
        ),
      );
    }
    for (const row of rows)
      if (row.branchId === branchId && row.sourceRecipeId === null)
        effective.push(RecipeService.effective(row, null, null, branchId));
    const filtered = effective
      .filter((recipe) => !templatesOnly || recipe.scope !== "local")
      .filter(matches)
      .sort((left, right) =>
        left.name === right.name
          ? left.uuid.localeCompare(right.uuid)
          : left.name.localeCompare(right.name),
      );
    return {
      items: filtered
        .slice(query.offset, query.offset + query.limit)
        .map((recipe) => RecipesFormatter.toSummary(recipe)),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<RecipesModel["detail"]> {
    const context = RecipeService.context(actor);
    const root = await RecipeService.loadSelector(prisma, context, uuid);
    return RecipeService.detail(prisma, context, root);
  }

  /**
   * Creates a company template without a branch context, or a branch-local
   * recipe inside one. Existing recipes are branch-local, so the company
   * catalog only grows through an explicit company-context create.
   */
  static async store(
    actor: TenantActor,
    body: RecipesModel["body"],
  ): Promise<RecipesModel["detail"]> {
    return RecipeService.write(
      async (db) => {
        const context = RecipeService.context(actor);
        const ingredients = await RecipeService.ingredients(
          db,
          context,
          null,
          body.ingredients,
        );
        const price =
          body.sellingPrice === undefined || body.sellingPrice === null
            ? { sellingPrice: null, priceCurrencyCode: null }
            : await RecipeService.price(db, body.sellingPrice);
        // A new recipe is not sellable unless it says so, and a sellable one
        // must already carry its price.
        const sellable = RecipeService.sellable(body.sellable ?? false, price);
        const created = await db.recipe.create({
          data: {
            organizationId: context.organizationId,
            branchId: context.branchId,
            name: RecipeService.name(body.name),
            code: RecipeService.code(body.code),
            description: body.description?.trim() ?? "",
            active: body.active ?? true,
            sellable,
            ...price,
          },
          select: { id: true },
        });
        await db.recipeLine.createMany({
          data: ingredients.map((line): Prisma.RecipeLineCreateManyInput => ({
            ...line,
            recipeId: created.id,
          })),
        });
        return RecipeService.detail(
          db,
          context,
          await RecipeService.load(db, context.organizationId, created.id),
        );
      },
      actor.branchId === null ? undefined : actor,
    );
  }

  /**
   * Company context edits the shared template. Branch context edits the
   * branch's own definition only: a local recipe, or the full customization
   * of a company template. An uncustomized template is never edited through a
   * branch, and branch activation is never changed by a content edit.
   */
  static async update(
    actor: TenantActor,
    uuid: string,
    body: RecipesModel["patch"],
  ): Promise<RecipesModel["detail"]> {
    return RecipeService.write(
      async (db) => {
        const context = RecipeService.context(actor);
        const root = await RecipeService.loadSelector(db, context, uuid);
        if (root.sourceRecipeId !== null)
          throw new createError.NotFound("Recipe was not found");
        const local = root.branchId !== null;
        if (context.branchId !== null && !local && body.active !== undefined)
          throw new createError.UnprocessableEntity(
            "Change branch activation with the activation action, not a content edit",
          );
        const definition =
          context.branchId === null || local
            ? root
            : await db.recipe.findFirst({
                where: {
                  organizationId: context.organizationId,
                  branchId: context.branchId,
                  sourceRecipeId: root.id,
                },
                select: effectiveRecipeSelect,
              });
        if (definition === null)
          throw Object.assign(
            new createError.Conflict(
              "Customize this company recipe for the branch before editing it",
            ),
            { apiCode: "RECIPE_NOT_CUSTOMIZED" },
          );
        // A stable recipe selector cannot identify a branch copy that was reset
        // and recreated between two requests. A version alone would accept a
        // stale edit of copy A against the new copy B that also starts at
        // version 0, so a customized edit must name the exact definition row.
        if (definition.id !== root.id) {
          if (body.customizationUuid === undefined)
            throw Object.assign(
              new createError.UnprocessableEntity(
                "Send the current customization UUID when editing a customized recipe",
              ),
              { apiCode: "RECIPE_CUSTOMIZATION_REQUIRED" },
            );
          if (body.customizationUuid.toLowerCase() !== definition.uuid)
            throw Object.assign(
              new createError.Conflict(
                "The branch customization was replaced by another request; reload and retry",
              ),
              { apiCode: "RECIPE_CUSTOMIZATION_STALE" },
            );
        }
        if (definition.version !== body.version)
          throw new createError.Conflict(
            "The recipe was changed by another request; reload and retry",
          );
        const ingredients =
          body.ingredients === undefined
            ? undefined
            : await RecipeService.ingredients(
                db,
                context,
                root.id,
                body.ingredients,
              );
        // A form echoes the stored amount on every save. Keeping the stored
        // snapshot for an equal amount means a legacy price currency is never
        // relabelled by a name or ingredient edit; only a genuinely new amount
        // captures the fixed system currency.
        const price =
          body.sellingPrice === undefined
            ? undefined
            : body.sellingPrice !== null &&
                definition.sellingPrice !== null &&
                decimal(body.sellingPrice.trim(), 6, 13).equals(
                  definition.sellingPrice,
                )
              ? {
                  sellingPrice: definition.sellingPrice,
                  priceCurrencyCode: definition.priceCurrencyCode,
                }
              : await RecipeService.price(db, body.sellingPrice);
        // The merged persisted state decides, so a patch cannot mark the
        // recipe sellable without a price or clear the price of one that is
        // already sellable. An omitted sellable value keeps the current one.
        const sellable = RecipeService.sellable(
          body.sellable ?? definition.sellable,
          price ?? {
            sellingPrice: definition.sellingPrice,
            priceCurrencyCode: definition.priceCurrencyCode,
          },
        );
        await db.recipe.update({
          where: {
            organizationId_id: {
              organizationId: context.organizationId,
              id: definition.id,
            },
          },
          data: {
            name:
              body.name === undefined
                ? undefined
                : RecipeService.name(body.name),
            description: body.description?.trim(),
            code:
              body.code === undefined
                ? undefined
                : RecipeService.code(body.code),
            active: definition.id === root.id ? body.active : undefined,
            sellable,
            ...price,
            version: { increment: 1 },
          },
        });
        if (ingredients !== undefined) {
          await db.recipeLine.deleteMany({
            where: {
              organizationId: context.organizationId,
              recipeId: definition.id,
            },
          });
          await db.recipeLine.createMany({
            data: ingredients.map((line): Prisma.RecipeLineCreateManyInput => ({
              ...line,
              recipeId: definition.id,
            })),
          });
        }
        return RecipeService.detail(db, context, root);
      },
      actor.branchId === null ? undefined : actor,
    );
  }

  /**
   * Company templates are deleted in company context only, and never while a
   * branch customization or any ingredient line still references them.
   * Branch-local recipes are deleted in their own branch. A customization is
   * reset to the company definition instead of deleted.
   */
  static async destroy(
    actor: TenantActor,
    uuid: string,
    version: number,
  ): Promise<RecipesModel["success"]> {
    return RecipeService.write(
      async (db) => {
        const context = RecipeService.context(actor);
        const root = await RecipeService.loadSelector(db, context, uuid);
        if (root.sourceRecipeId !== null)
          throw new createError.NotFound("Recipe was not found");
        const local = root.branchId !== null;
        if (context.branchId !== null && !local) {
          const customized = await db.recipe.findFirst({
            where: {
              organizationId: context.organizationId,
              branchId: context.branchId,
              sourceRecipeId: root.id,
            },
            select: { id: true },
          });
          throw Object.assign(
            new createError.Conflict(
              customized
                ? "This recipe is customized in this branch; reset it to the company definition instead"
                : "Company recipes are managed in company context",
            ),
            {
              apiCode: customized ? "RECIPE_CUSTOMIZED" : "RECIPE_SHARED",
            },
          );
        }
        if (root.version !== version)
          throw new createError.Conflict(
            "The recipe was changed by another request; reload and retry",
          );
        if (local) {
          const [usedAsIngredient, mappings] = await Promise.all([
            db.recipeLine.count({
              where: {
                organizationId: context.organizationId,
                childRecipeId: root.id,
              },
            }),
            db.salesProductMapping.count({
              where: {
                organizationId: context.organizationId,
                recipeId: root.id,
              },
            }),
          ]);
          if (usedAsIngredient > 0 || mappings > 0)
            throw Object.assign(
              new createError.Conflict(
                usedAsIngredient > 0
                  ? "This recipe is used as an ingredient by another recipe; remove those ingredient lines before deleting it"
                  : "This recipe is mapped to a sales product in this branch; clear that product mapping before deleting it",
              ),
              { apiCode: "RECIPE_IN_USE" },
            );
          await db.recipe.delete({
            where: {
              organizationId_id: {
                organizationId: context.organizationId,
                id: root.id,
              },
            },
          });
          return { success: true as const };
        }
        const [usedAsIngredient, customizations, assignments, mappings] =
          await Promise.all([
            db.recipeLine.count({
              where: {
                organizationId: context.organizationId,
                childRecipeId: root.id,
              },
            }),
            db.recipe.count({
              where: {
                organizationId: context.organizationId,
                sourceRecipeId: root.id,
              },
            }),
            db.branchRecipe.count({
              where: {
                organizationId: context.organizationId,
                recipeId: root.id,
              },
            }),
            db.salesProductMapping.count({
              where: {
                organizationId: context.organizationId,
                recipeId: root.id,
              },
            }),
          ]);
        if (
          usedAsIngredient > 0 ||
          customizations > 0 ||
          assignments > 0 ||
          mappings > 0
        )
          throw Object.assign(
            new createError.Conflict(
              "This company recipe is still used by another recipe or assigned to a branch; detach it before deleting it",
            ),
            { apiCode: "RECIPE_IN_USE" },
          );
        await db.recipe.delete({
          where: {
            organizationId_id: {
              organizationId: context.organizationId,
              id: root.id,
            },
          },
        });
        return { success: true as const };
      },
      actor.branchId === null ? undefined : actor,
    );
  }

  /**
   * Branch activation of a company template. The activation row is
   * independent of the branch's copied content, defaults to active with
   * version 0 without a write, and is guarded by its own version. A company
   * template that is globally inactive stays unavailable in every branch.
   */
  static async setActivation(
    actor: TenantActor,
    uuid: string,
    body: RecipesModel["activation"],
  ): Promise<RecipesModel["detail"]> {
    return RecipeService.write(async (db) => {
      const context = RecipeService.context(actor);
      if (context.branchId === null)
        throw Object.assign(
          new createError.BadRequest(
            "Select an active branch before activating a recipe",
          ),
          { apiCode: "BRANCH_REQUIRED" },
        );
      const root = await RecipeService.loadSelector(db, context, uuid);
      if (root.branchId !== null)
        throw Object.assign(
          new createError.UnprocessableEntity(
            "Branch-local recipes use their own active flag",
          ),
          { apiCode: "RECIPE_LOCAL_ASSIGNMENT" },
        );
      if (body.active && !root.active)
        throw Object.assign(
          new createError.UnprocessableEntity(
            "This company recipe is globally inactive and cannot be activated in a branch",
          ),
          { apiCode: "RECIPE_COMPANY_INACTIVE" },
        );
      // Activation never changes content, but it must not expose a recipe
      // whose effective graph is already cyclic.
      RecipeService.assertNoCycle(
        await RecipeService.graph(
          db,
          context.organizationId,
          context.branchId,
          [root.id],
        ),
      );
      const assignment = await db.branchRecipe.findFirst({
        where: {
          organizationId: context.organizationId,
          branchId: context.branchId,
          recipeId: root.id,
        },
        select: { id: true, version: true },
      });
      const current = assignment?.version ?? 0;
      if (current !== body.version)
        throw new createError.Conflict(
          "The branch activation was changed by another request; reload and retry",
        );
      if (assignment === null)
        await db.branchRecipe.create({
          data: {
            organizationId: context.organizationId,
            branchId: context.branchId,
            recipeId: root.id,
            active: body.active,
            version: 1,
          },
        });
      else
        await db.branchRecipe.update({
          where: {
            organizationId_id: {
              organizationId: context.organizationId,
              id: assignment.id,
            },
          },
          data: { active: body.active, version: { increment: 1 } },
        });
      return RecipeService.detail(db, context, root);
    }, actor);
  }

  /**
   * Creates the branch's full customization of a company template: a complete
   * copy of the effective content, optionally replaced in the same request,
   * pinning the company source version. Ingredient-level merging does not
   * exist. Customizing does not change branch activation.
   */
  static async customize(
    actor: TenantActor,
    uuid: string,
    body: RecipesModel["customize"],
  ): Promise<RecipesModel["detail"]> {
    return RecipeService.write(async (db) => {
      const context = RecipeService.context(actor);
      if (context.branchId === null)
        throw Object.assign(
          new createError.BadRequest(
            "Select an active branch before customizing a recipe",
          ),
          { apiCode: "BRANCH_REQUIRED" },
        );
      const root = await RecipeService.loadSelector(db, context, uuid);
      if (root.branchId !== null)
        throw Object.assign(
          new createError.UnprocessableEntity(
            "Only company recipes can be customized; local recipes are already branch-specific",
          ),
          { apiCode: "RECIPE_LOCAL" },
        );
      if (!root.active)
        throw Object.assign(
          new createError.UnprocessableEntity(
            "This company recipe is globally inactive; activate it in company context before customizing it",
          ),
          { apiCode: "RECIPE_COMPANY_INACTIVE" },
        );
      if (root.version !== body.sourceVersion)
        throw Object.assign(
          new createError.Conflict(
            "The company recipe changed since it was loaded; reload and retry",
          ),
          { apiCode: "RECIPE_SOURCE_STALE" },
        );
      const existing = await db.recipe.findFirst({
        where: {
          organizationId: context.organizationId,
          branchId: context.branchId,
          sourceRecipeId: root.id,
        },
        select: { id: true },
      });
      if (existing)
        throw Object.assign(
          new createError.Conflict(
            "This recipe is already customized in this branch",
          ),
          { apiCode: "RECIPE_ALREADY_CUSTOMIZED" },
        );
      const ingredients =
        body.ingredients === undefined
          ? await RecipeService.copyLines(db, context, root)
          : await RecipeService.ingredients(
              db,
              context,
              root.id,
              body.ingredients,
            );
      // Copying the shared lines can still close a branch cycle: this
      // branch may customize a child that already contains this recipe.
      if (body.ingredients === undefined)
        await RecipeService.assertAcyclic(
          db,
          context.organizationId,
          context.branchId,
          root.id,
          ingredients.flatMap((line) =>
            line.childRecipeId === null ? [] : [line.childRecipeId],
          ),
        );
      const price =
        body.sellingPrice === undefined
          ? {
              sellingPrice: root.sellingPrice,
              priceCurrencyCode: root.priceCurrencyCode,
            }
          : await RecipeService.price(db, body.sellingPrice);
      // The copy starts from the company definition's sellability and pins the
      // requested value, so a later company edit never changes it; it still
      // has to end up priced when it is sellable.
      const sellable = RecipeService.sellable(
        body.sellable ?? root.sellable,
        price,
      );
      const created = await db.recipe.create({
        data: {
          organizationId: context.organizationId,
          branchId: context.branchId,
          sourceRecipeId: root.id,
          sourceVersion: root.version,
          name:
            body.name === undefined ? root.name : RecipeService.name(body.name),
          code:
            body.code === undefined ? root.code : RecipeService.code(body.code),
          description: body.description?.trim() ?? root.description,
          active: root.active,
          sellable,
          ...price,
        },
        select: { id: true },
      });
      await db.recipeLine.createMany({
        data: ingredients.map((line): Prisma.RecipeLineCreateManyInput => ({
          ...line,
          recipeId: created.id,
        })),
      });
      return RecipeService.detail(db, context, root);
    }, actor);
  }

  /** Copies the company template's ingredient lines for a full branch copy. */
  private static async copyLines(
    db: Database,
    context: RecipeContext,
    root: RecipeRecord,
  ): Promise<IngredientWrite[]> {
    return root.ingredients.map((line) => ({
      organizationId: context.organizationId,
      itemId: line.itemId,
      childRecipeId: line.childRecipeId,
      quantity: line.quantity,
      note: line.note,
    }));
  }

  /**
   * Explicit reset: removes only the branch customization so the branch
   * follows the company template again. Branch activation is preserved,
   * including its active default when no activation row exists.
   */
  static async reset(
    actor: TenantActor,
    uuid: string,
    body: RecipesModel["reset"],
  ): Promise<RecipesModel["detail"]> {
    return RecipeService.write(async (db) => {
      const context = RecipeService.context(actor);
      if (context.branchId === null)
        throw Object.assign(
          new createError.BadRequest(
            "Select an active branch before resetting a recipe",
          ),
          { apiCode: "BRANCH_REQUIRED" },
        );
      const root = await RecipeService.loadSelector(db, context, uuid);
      if (root.branchId !== null)
        throw Object.assign(
          new createError.UnprocessableEntity(
            "Only a company recipe customization can be reset",
          ),
          { apiCode: "RECIPE_LOCAL" },
        );
      const customization = await db.recipe.findFirst({
        where: {
          organizationId: context.organizationId,
          branchId: context.branchId,
          sourceRecipeId: root.id,
        },
        select: { id: true, uuid: true, version: true },
      });
      if (customization === null)
        throw Object.assign(
          new createError.NotFound(
            "This company recipe is not customized in this branch",
          ),
          { apiCode: "RECIPE_NOT_CUSTOMIZED" },
        );
      // Reset deletes the row, so the stable selector cannot tell a reset and
      // re-created copy from the original one. The expected definition row and
      // its version must both match before anything is deleted.
      if (
        body.customizationUuid.toLowerCase() !== customization.uuid ||
        customization.version !== body.version
      )
        throw Object.assign(
          new createError.Conflict(
            "The branch customization was replaced or changed by another request; reload and retry",
          ),
          { apiCode: "RECIPE_CUSTOMIZATION_STALE" },
        );
      await db.recipe.delete({
        where: {
          organizationId_id: {
            organizationId: context.organizationId,
            id: customization.id,
          },
        },
      });
      // Following the company template again can close a cycle that the
      // isolated customization hid, so the resulting effective graph is
      // verified before the reset commits.
      RecipeService.assertNoCycle(
        await RecipeService.graph(
          db,
          context.organizationId,
          context.branchId,
          [root.id],
        ),
      );
      return RecipeService.detail(db, context, root);
    }, actor);
  }
}
