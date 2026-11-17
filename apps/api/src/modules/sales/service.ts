import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { Decimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { CatalogService } from "@/lib/catalog";
import { moneyMovementKind } from "../finance/model";
import { FinanceService } from "../finance/service";
import { ItemStockService } from "../items/stock/service";
import { BranchesService } from "../branches/service";
import { OrderService } from "../order/service";
import { RecipeService } from "../recipes/service";
import type { EffectiveRecipe } from "../recipes/model";
import { SalesFormatter } from "./formatter";
import {
  SalesModel,
  saleReceiptSelect,
  salesFullSelect,
  salesSummarySelect,
  type Database,
  type IngredientPlan,
  type SaleReceiptRecord,
  type SalesRecord,
  type Shortage,
} from "./model";

export type SaleSource = {
  sheet: string;
  row: number;
  channelText: string;
  productText: string;
};

export type SaleBatchRef = {
  id: number;
  uuid: string;
  reference: string;
};

export type SaleChannel = {
  id: number;
  uuid: string;
  name: string;
};

export abstract class SalesService {
  static async index(
    actor: TenantActor,
    query: SalesModel["query"],
  ): Promise<SalesModel["list"]> {
    const organizationId = actor.organizationId;
    const search = query.search?.trim();
    const where: Prisma.BuildWhereInput = {
      organizationId,
      // A branch context never lists another branch's sales; company context
      // deliberately aggregates every branch.
      ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: "insensitive" } },
              { recipeName: { contains: search, mode: "insensitive" } },
              { createdByName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.build.findMany({
        where,
        select: salesSummarySelect,
        orderBy: [{ id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.build.count({ where }),
    ]);
    return {
      items: rows.map((row) => SalesFormatter.toSummary(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<SalesModel["sale"]> {
    const { id, ...sale } = await SalesService.loadFull(
      prisma,
      actor.organizationId,
      actor.branchId,
      uuid,
    );
    const receipts = await SalesService.receipts(
      prisma,
      actor.organizationId,
      id,
    );
    const collected = receipts.reduce(
      (sum, receipt) => sum.plus(receipt.amount),
      new Decimal(0),
    );
    return SalesFormatter.toSale(sale, receipts, collected);
  }

  /** Posted receipts and their reversals for one sale, oldest first. */
  static async receipts(
    db: Database,
    organizationId: string,
    buildId: number,
  ): Promise<SaleReceiptRecord[]> {
    return db.moneyMovement.findMany({
      where: {
        organizationId,
        buildId,
        entryKind: {
          in: [moneyMovementKind.saleReceipt, moneyMovementKind.reversal],
        },
      },
      select: saleReceiptSelect,
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
  }

  static async loadFull(
    db: Database,
    organizationId: string,
    branchId: number | null,
    uuid: string,
  ): Promise<SalesRecord> {
    const row = await db.build.findFirst({
      where: {
        organizationId,
        uuid,
        ...(branchId === null ? {} : { branchId }),
      },
      select: salesFullSelect,
    });
    if (!row) throw new createError.NotFound("Sale was not found");
    return row;
  }

  static async resolveChannel(
    db: Database,
    organizationId: string,
    uuid: string,
  ): Promise<SaleChannel> {
    const channel = await db.salesChannel.findFirst({
      where: { organizationId, uuid },
      select: { id: true, uuid: true, name: true, active: true },
    });
    if (!channel) throw new createError.NotFound("Sales channel was not found");
    if (!channel.active)
      throw new createError.UnprocessableEntity(
        "Inactive sales channels cannot be used",
      );
    return { id: channel.id, uuid: channel.uuid, name: channel.name };
  }

  /**
   * Loads every effective recipe reachable from the requested roots inside
   * one context, breadth first. Missing, cross-branch or foreign descendants
   * fail validation instead of being trusted; one query per graph level, never
   * per path. See `RecipeService.graph`.
   */
  static async graph(
    db: Database,
    organizationId: string,
    branchId: number | null,
    rootIds: readonly number[],
  ): Promise<Map<number, EffectiveRecipe>> {
    return RecipeService.graph(db, organizationId, branchId, rootIds);
  }

  /**
   * Expands one effective root recipe into its leaf recipe lines. Child
   * quantities are units of the child recipe per one unit of its parent, so
   * every path multiplies its way down to an item. Results are memoized per
   * recipe and accumulated in post-order keyed by the leaf recipe line, so a
   * shared subtree is expanded once, the same leaf reached by several paths is
   * summed, and two different leaves of one item keep their own UUID and note.
   * A visiting/done marker rejects cycles without recursion, so nesting depth
   * is bounded only by the stored graph.
   */
  static plan(
    recipe: EffectiveRecipe,
    graph: Map<number, EffectiveRecipe>,
    quantity: number,
  ): IngredientPlan[] {
    if (quantity < 1)
      throw new createError.UnprocessableEntity(
        "Sale quantity must be a positive integer",
      );
    if (!recipe.active)
      throw new createError.UnprocessableEntity(
        "This recipe is not active for the selected branch and cannot be sold",
      );
    // Only the recipe being sold directly has to be marked sellable. Nested
    // ingredient recipes are expanded below and never need a sellability flag
    // or a price of their own.
    if (!recipe.sellable)
      throw Object.assign(
        new createError.UnprocessableEntity(
          "This recipe is not marked as sellable",
        ),
        { apiCode: "RECIPE_NOT_SELLABLE" },
      );
    if (recipe.lines.length === 0)
      throw new createError.UnprocessableEntity(
        "This recipe does not have any ingredients",
      );

    type Leaf = {
      factor: Prisma.Decimal;
      line: { id: number; uuid: string; note: string };
      item: IngredientPlan["item"];
    };
    // Memoized per recipe, keyed by the leaf recipe line id.
    const leaves = new Map<number, Map<number, Leaf>>();
    const state = new Map<number, "visiting" | "done">();
    const stack: { id: number; index: number }[] = [
      { id: recipe.key, index: 0 },
    ];
    state.set(recipe.key, "visiting");

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (!frame)
        throw new createError.InternalServerError(
          "Recipe graph traversal lost its frame",
        );
      const node = graph.get(frame.id);
      if (!node)
        throw new createError.UnprocessableEntity(
          "An ingredient recipe was not found in this scope",
        );
      if (frame.index < node.lines.length) {
        const line = node.lines[frame.index];
        if (!line)
          throw new createError.InternalServerError(
            "Recipe graph traversal lost its ingredient line",
          );
        frame.index += 1;
        if (line.childRecipeId === null) continue;
        const childId = line.childRecipeId;
        if (state.get(childId) === "visiting")
          throw new createError.UnprocessableEntity(
            `Recipe ${node.name} cannot be sold: its ingredient chain contains a cycle`,
          );
        if (state.get(childId) === "done") continue;
        state.set(childId, "visiting");
        stack.push({ id: childId, index: 0 });
        continue;
      }

      const map = new Map<number, Leaf>();
      for (const line of node.lines) {
        const amount = new Decimal(line.quantity.toString());
        if (!amount.gt(0))
          throw new createError.UnprocessableEntity(
            `An ingredient amount of recipe ${node.name} must be greater than zero`,
          );
        if (line.item !== null) {
          const item = line.item;
          if (!item.active)
            throw new createError.UnprocessableEntity(
              `Ingredient ${item.name} must be an active item`,
            );
          if (!item.unit)
            throw new createError.UnprocessableEntity(
              `Ingredient ${item.name} has no unit; assign a unit before selling this recipe`,
            );
          const existing = map.get(line.id);
          if (existing) existing.factor = existing.factor.add(amount);
          else
            map.set(line.id, {
              factor: amount,
              line: { id: line.id, uuid: line.uuid, note: line.note },
              item,
            });
          continue;
        }
        const childId = line.childRecipeId;
        if (childId === null)
          throw new createError.UnprocessableEntity(
            `Recipe ${node.name} has an ingredient without an item or recipe`,
          );
        const child = graph.get(childId);
        if (!child)
          throw new createError.UnprocessableEntity(
            `An ingredient recipe of ${node.name} was not found in this scope`,
          );
        if (!child.active)
          throw new createError.UnprocessableEntity(
            `Ingredient recipe ${child.name} must be active for the selected branch`,
          );
        if (child.lines.length === 0)
          throw new createError.UnprocessableEntity(
            `Ingredient recipe ${child.name} does not have any ingredients`,
          );
        const childLeaves = leaves.get(childId);
        if (!childLeaves)
          throw new createError.InternalServerError(
            "Recipe graph was expanded out of order",
          );
        for (const [leafLineId, leaf] of childLeaves) {
          const scaled = leaf.factor.mul(amount);
          const existing = map.get(leafLineId);
          if (existing) existing.factor = existing.factor.add(scaled);
          else map.set(leafLineId, { ...leaf, factor: scaled });
        }
      }
      leaves.set(node.key, map);
      state.set(node.key, "done");
      stack.pop();
    }

    const requirements: IngredientPlan[] = [];
    const rootLeaves = [...(leaves.get(recipe.key) ?? [])].sort(
      (left, right) => left[0] - right[0],
    );
    for (const [, leaf] of rootLeaves) {
      const name = leaf.item.name;
      const recipeQuantity = leaf.factor;
      const required = recipeQuantity.mul(quantity);
      if (recipeQuantity.decimalPlaces() > 5)
        throw new createError.UnprocessableEntity(
          `Effective quantity for ${name} needs more than 5 decimal places per sold unit; adjust the nested ingredient amounts`,
        );
      if (
        !recipeQuantity.isFinite() ||
        recipeQuantity.gte(new Decimal(10).pow(10))
      )
        throw new createError.UnprocessableEntity(
          `Effective quantity for ${name} per sold unit exceeds the supported precision`,
        );
      if (!required.isFinite() || required.gte(new Decimal(10).pow(10)))
        throw new createError.UnprocessableEntity(
          `Required quantity for ${name} exceeds the supported precision`,
        );
      if (required.decimalPlaces() > 5)
        throw new createError.UnprocessableEntity(
          `Required quantity for ${name} needs more than 5 decimal places`,
        );
      requirements.push({
        line: leaf.line,
        item: leaf.item,
        recipeQuantity,
        required,
        unitCode: leaf.item.unit?.code ?? "",
      });
    }
    return requirements;
  }

  /**
   * Compares summed demand per item with the exact balance of the sale branch.
   * The snapshot keeps one row per leaf recipe line, so several leaves of one
   * item must be added before any shortage decision; otherwise each leaf could
   * pass alone while the shared balance cannot cover them together.
   */
  static shortagesFor(
    requirements: readonly Pick<
      IngredientPlan,
      "item" | "required" | "unitCode"
    >[],
    balances: ReadonlyMap<number, Prisma.Decimal>,
  ): Shortage[] {
    const demand = new Map<
      number,
      {
        item: IngredientPlan["item"];
        unitCode: string;
        required: Prisma.Decimal;
      }
    >();
    for (const requirement of requirements) {
      const existing = demand.get(requirement.item.id);
      if (existing)
        existing.required = existing.required.add(requirement.required);
      else
        demand.set(requirement.item.id, {
          item: requirement.item,
          unitCode: requirement.unitCode,
          required: requirement.required,
        });
    }
    const shortages: Shortage[] = [];
    for (const { item, required, unitCode } of demand.values()) {
      const available = balances.get(item.id) ?? new Decimal(0);
      if (available.lt(required)) {
        shortages.push({
          componentName: item.name,
          componentUnits: unitCode,
          required: required.toString(),
          available: available.toString(),
          missing: required.sub(available).toString(),
        });
      }
    }
    return shortages;
  }

  /**
   * Writes one sale from an already validated plan. The caller owns the
   * transaction, has resolved the sale branch and must hold the branch
   * lifecycle lock plus catalog -> recipes -> stock locks. Used by both the
   * manual store path and batch processing so snapshots, branch stock ledger
   * and reference generation cannot drift apart.
   */
  static async create(
    db: Prisma.TransactionClient,
    actor: TenantActor,
    input: {
      organizationId: string;
      branchId: number;
      recipe: EffectiveRecipe;
      requirements: IngredientPlan[];
      quantity: number;
      requestKey: string;
      channel: SaleChannel;
      businessDate: Date;
      createdByName: string;
      batch?: SaleBatchRef;
      source?: SaleSource;
      /** Preallocated under the same catalog lock; skips a per-sale query. */
      reference?: { reference: string; referenceInt: bigint };
    },
  ): Promise<string> {
    const {
      organizationId,
      branchId,
      recipe,
      requirements,
      quantity,
      requestKey,
      channel,
      businessDate,
      createdByName,
      batch,
      source,
    } = input;

    // The sold recipe must be priced in the organization finance currency at
    // recording time. The price is frozen into the sale, so a later recipe
    // price change never reprices history and a retry returns the original
    // snapshot instead of a new amount.
    await FinanceService.lock(db);
    const currencyCode = await FinanceService.currency(db, organizationId);
    if (recipe.sellingPrice == null || recipe.priceCurrencyCode == null)
      throw new createError.UnprocessableEntity(
        `Recipe ${recipe.name} has no selling price; set a price before selling it`,
      );
    if (recipe.priceCurrencyCode !== currencyCode)
      throw new createError.UnprocessableEntity(
        `Recipe ${recipe.name} is priced in ${recipe.priceCurrencyCode}, but this organization records money in ${currencyCode}`,
      );
    const unitPrice = recipe.sellingPrice;
    const totalPrice = unitPrice.mul(quantity).toDecimalPlaces(6);
    if (totalPrice.gte(new Decimal(10).pow(13)))
      throw new createError.UnprocessableEntity(
        "Sale total exceeds the supported precision",
      );

    const reference =
      input.reference ??
      (await OrderService.reference(
        "BUILDORDER_REFERENCE_PATTERN",
        undefined,
        async () =>
          (
            await db.build.aggregate({
              where: { organizationId },
              _max: { referenceInt: true },
            })
          )._max.referenceInt ?? 0n,
        async (value) =>
          (await db.build.findUnique({
            where: {
              organizationId_reference: { organizationId, reference: value },
            },
            select: { id: true },
          })) != null,
      ));

    const sale = await db.build.create({
      data: {
        organizationId,
        branchId,
        reference: reference.reference,
        referenceInt: reference.referenceInt,
        requestKey,
        // The selector identity survives customization and reset; the frozen
        // definition and its source version keep the provenance explicit.
        requestedRecipeId: recipe.key,
        requestedRecipeUuid: recipe.uuid,
        recipeId: recipe.definitionId,
        recipeName: recipe.name,
        recipeVersion: recipe.version,
        recipeDefinitionUuid:
          recipe.scope === "customized"
            ? recipe.customizationUuid
            : recipe.uuid,
        recipeSourceVersion: recipe.sourceVersion,
        quantity,
        ingredientCount: requirements.length,
        unitPrice,
        totalPrice,
        currencyCode,
        channelId: channel.id,
        businessDate,
        batchId: batch?.id ?? null,
        sourceSheet: source?.sheet ?? null,
        sourceRow: source?.row ?? null,
        sourceChannelText: source?.channelText ?? null,
        sourceProductText: source?.productText ?? null,
        createdById: actor.userId,
        createdByName,
      },
    });

    const scope = {
      organizationId,
      branchId,
      userId: actor.userId,
    };
    for (const requirement of requirements) {
      const row = await db.buildComponent.create({
        data: {
          organizationId,
          buildId: sale.id,
          recipeLineRef: requirement.line.id,
          recipeLineUuidRef: requirement.line.uuid,
          recipeLineId: requirement.line.id,
          componentRef: requirement.item.id,
          componentUuidRef: requirement.item.uuid,
          componentId: requirement.item.id,
          componentName: requirement.item.name,
          componentIpn: requirement.item.ipn,
          componentUnits: requirement.unitCode,
          recipeQuantity: requirement.recipeQuantity,
          requiredQuantity: requirement.required,
          consumedQuantity: requirement.required,
          note: requirement.line.note,
        },
      });
      const removed = await ItemStockService.change(
        db,
        scope,
        requirement.item.id,
        "remove",
        requirement.required,
        {
          notes: batch
            ? `Sold in batch ${batch.reference}`
            : `Prepared ${reference.reference}`,
          deltas: {
            buildUuid: sale.uuid,
            buildReference: reference.reference,
            itemUuid: requirement.item.uuid,
            ...(batch
              ? {
                  salesBatchUuid: batch.uuid,
                  salesBatchReference: batch.reference,
                }
              : {}),
          },
        },
      );
      await db.buildConsumption.create({
        data: {
          organizationId,
          buildId: sale.id,
          buildComponentId: row.id,
          itemRef: requirement.item.id,
          itemUuidRef: requirement.item.uuid,
          itemId: requirement.item.id,
          quantity: requirement.required,
          quantityBefore: removed.before,
          quantityAfter: removed.after,
          createdById: actor.userId,
          createdByName,
        },
      });
    }

    return sale.uuid;
  }

  /**
   * Records one manual sale in the request branch. The branch header is
   * mandatory here: a sale always consumes one concrete branch balance and no
   * branch is ever chosen implicitly.
   */
  static async store(
    actor: TenantActor,
    body: SalesModel["body"],
  ): Promise<SalesModel["sale"]> {
    const organizationId = actor.organizationId;
    const requestKey = body.requestKey.trim();
    // PostgreSQL uuid columns canonicalize to lowercase; normalize the input
    // once so a replay with different hex casing resolves the same sale.
    const requestedRecipeUuid = body.recipeUuid.toLowerCase();
    const requestedChannelUuid = body.channelUuid.toLowerCase();
    const saleUuid = await prisma.$transaction(
      async (db) => {
        // Branch lifecycle guard first, then the global lock order: catalog
        // 814203, recipes 814204, stock 814205, finance 814207. The price
        // snapshot captures the finance currency.
        const branch = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        await CatalogService.lockItem(db);
        await RecipeService.lock(db);
        await ItemStockService.lock(db);

        // The request key freezes the sold branch, recipe, channel and
        // quantity. Replay must resolve before any live recipe read so edited
        // or deleted recipes still return the original sale.
        const existing = await db.build.findUnique({
          where: {
            organizationId_requestKey: { organizationId, requestKey },
          },
          select: {
            ...salesFullSelect,
            channel: { select: { uuid: true, name: true } },
          },
        });
        if (existing) {
          if (
            existing.branch.uuid !== branch.branchUuid ||
            existing.requestedRecipeUuid !== requestedRecipeUuid ||
            existing.quantity !== body.quantity ||
            existing.channel?.uuid !== requestedChannelUuid
          )
            throw new createError.Conflict(
              "This request key belongs to a different sale",
            );
          return existing.uuid;
        }

        const channel = await SalesService.resolveChannel(
          db,
          organizationId,
          requestedChannelUuid,
        );
        const context = {
          organizationId,
          branchId: branch.branchId,
        };
        const root = await RecipeService.loadSelector(
          db,
          context,
          requestedRecipeUuid,
        );
        const graph = await SalesService.graph(
          db,
          organizationId,
          branch.branchId,
          [root.id],
        );
        const recipe = graph.get(root.id);
        if (!recipe) throw new createError.NotFound("Recipe was not found");
        const requirements = SalesService.plan(recipe, graph, body.quantity);
        const balances = await ItemStockService.balances(
          db,
          organizationId,
          branch.branchId,
          [...new Set(requirements.map((requirement) => requirement.item.id))],
        );
        const shortages = SalesService.shortagesFor(requirements, balances);
        if (shortages.length > 0) throw SalesService.shortage(shortages);

        const createdBy = await db.user.findUnique({
          where: { id: actor.userId },
          select: { name: true },
        });
        const saleUuid = await SalesService.create(db, actor, {
          organizationId,
          branchId: branch.branchId,
          recipe,
          requirements,
          quantity: body.quantity,
          requestKey,
          channel,
          businessDate: OrderService.today(),
          createdByName: createdBy?.name ?? "",
        });
        return saleUuid;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20000,
      },
    );
    // The stored row is re-read outside the write transaction so the response
    // is exactly the frozen snapshot, including its posted receipts.
    return SalesService.show(actor, saleUuid);
  }

  static shortage(shortages: Shortage[]): Error {
    const error = new createError.Conflict(
      `Insufficient stock: ${shortages
        .map(
          (shortage) =>
            `${shortage.componentName} needs ${shortage.required} and is missing ${shortage.missing}`,
        )
        .join("; ")}`,
    );
    return Object.assign(error, {
      apiCode: "BUILD_SHORTAGE",
      details: { shortages },
    });
  }
}
