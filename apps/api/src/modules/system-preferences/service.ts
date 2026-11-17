import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { CurrencyCatalog } from "@/lib/currencies";
import { prisma } from "@/lib/prisma";
import type { SystemPreferencesModel } from "./model";

type Database = Prisma.TransactionClient | typeof prisma;

/** Stable singleton discriminator; the database check allows no other value. */
const SYSTEM_KEY = "system";

export abstract class SystemPreferencesService {
  /** Reads the stored system currency without creating a row. */
  static async defaultCurrency(db: Database): Promise<string | null> {
    const row = await db.systemPreference.findUnique({
      where: { key: SYSTEM_KEY },
      select: { defaultCurrencyCode: true },
    });
    return row?.defaultCurrencyCode ?? null;
  }

  /**
   * The configured system currency for a new monetary snapshot. A missing or
   * retired value fails with an actionable message instead of minting an amount
   * in a currency that no longer means what it says.
   */
  static async requireCurrency(db: Database): Promise<string> {
    const stored = await SystemPreferencesService.defaultCurrency(db);
    if (stored === null)
      throw new createError.UnprocessableEntity(
        "The system currency is not configured; a platform administrator must set it before amounts can be recorded",
      );
    if (!CurrencyCatalog.active(stored))
      throw new createError.UnprocessableEntity(
        `The system currency ${stored} is not an active ISO 4217 code, so no new amounts can be recorded in it; a database operator must reconcile the stored system currency`,
      );
    return stored;
  }

  static async show(): Promise<SystemPreferencesModel["preference"]> {
    return {
      defaultCurrencyCode:
        await SystemPreferencesService.defaultCurrency(prisma),
    };
  }

  /**
   * Sets the system currency once. The advisory lock serializes concurrent
   * initial setup so only one code can ever be stored; repeating the stored
   * code is an idempotent no-op and any other code is a conflict. There is no
   * path that clears or switches the configured currency.
   */
  static async configure(
    body: SystemPreferencesModel["body"],
  ): Promise<SystemPreferencesModel["preference"]> {
    const requested = body.defaultCurrencyCode.trim().toUpperCase();
    return prisma.$transaction(
      async (db) => {
        // pg_advisory_xact_lock returns void; execute it without a result row.
        await db.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(814208::bigint)`,
        );
        const stored = await SystemPreferencesService.defaultCurrency(db);
        if (stored !== null) {
          // Re-sending the stored code is a no-op even when the catalog has
          // since retired it, so a repeated request never rewrites history.
          if (stored === requested) return { defaultCurrencyCode: stored };
          throw new createError.Conflict(
            `The system currency is already configured as ${stored} and cannot change`,
          );
        }
        const defaultCurrencyCode = CurrencyCatalog.canonical(requested);
        return db.systemPreference.upsert({
          where: { key: SYSTEM_KEY },
          create: { key: SYSTEM_KEY, defaultCurrencyCode },
          update: { defaultCurrencyCode },
          select: { defaultCurrencyCode: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20000,
      },
    );
  }
}
