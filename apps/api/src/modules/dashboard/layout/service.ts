import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../../prisma/generated/prisma/client";
import type { Dashboard } from "../../../../prisma/generated/prisma/client";
import { validateDefinition } from "../analytics/definition";
import { dashboardScope, defaultDashboardDefinition } from "../defaults";
import type { DashboardDefinition } from "../model";
import type { DashboardLayoutResponse, DashboardSaveBody } from "./model";

function conflict(message: string): createError.HttpError {
  const error = new createError.Conflict(message);
  return Object.assign(error, { apiCode: "DASHBOARD_CONFLICT" });
}

export abstract class DashboardLayoutService {
  /**
   * Reads the saved layout for the session user and context. When none exists
   * it returns the explicit unsaved default (uuid null, revision 0) and never
   * writes a row.
   */
  static async show(
    userId: string,
    organizationId: string | null,
  ): Promise<DashboardLayoutResponse> {
    const row = await prisma.dashboard.findFirst({
      where: { userId, organizationId },
      orderBy: { id: "asc" },
    });
    if (!row) return DashboardLayoutService.unsaved(organizationId);
    return DashboardLayoutService.toResponse(row, organizationId);
  }

  /**
   * Validates the whole definition and saves it atomically with the expected
   * revision. A stale revision, or a simultaneous first save, is a 409 and
   * never overwrites the stored layout.
   */
  static async save(
    userId: string,
    organizationId: string | null,
    body: DashboardSaveBody,
  ): Promise<DashboardLayoutResponse> {
    const definition = validateDefinition(
      body.definition,
      dashboardScope(organizationId),
    );
    const serialized = definition as unknown as Prisma.InputJsonValue;

    if (body.expectedRevision === 0) {
      try {
        const row = await prisma.dashboard.create({
          data: {
            userId,
            organizationId,
            schemaVersion: definition.version,
            revision: 1,
            definition: serialized,
            updatedAt: new Date(),
          },
        });
        return DashboardLayoutService.toResponse(row, organizationId);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw conflict(
            "Another save created this dashboard first. Reload before saving your changes.",
          );
        throw error;
      }
    }

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.dashboard.updateMany({
        where: {
          userId,
          organizationId,
          revision: body.expectedRevision,
        },
        data: {
          schemaVersion: definition.version,
          revision: { increment: 1 },
          definition: serialized,
          updatedAt: new Date(),
        },
      });
      if (updated.count === 0)
        throw conflict(
          "This dashboard changed since it was loaded. Reload before saving your changes.",
        );
      return tx.dashboard.findFirst({ where: { userId, organizationId } });
    });
    if (!row)
      throw new createError.InternalServerError(
        "Dashboard disappeared during save",
      );
    return DashboardLayoutService.toResponse(row, organizationId);
  }

  private static unsaved(
    organizationId: string | null,
  ): DashboardLayoutResponse {
    return {
      dashboard: {
        uuid: null,
        schemaVersion: 3,
        revision: 0,
        definition: defaultDashboardDefinition(dashboardScope(organizationId)),
        savedAt: null,
        updatedAt: null,
      },
    };
  }

  private static toResponse(
    row: Dashboard,
    organizationId: string | null,
  ): DashboardLayoutResponse {
    const scope = dashboardScope(organizationId);
    let definition: DashboardDefinition;
    try {
      // Persisted invalid JSON is reported as a server error; it is never
      // silently replaced with defaults.
      definition = validateDefinition(row.definition, scope);
    } catch {
      throw new createError.InternalServerError(
        "The saved dashboard definition is invalid",
      );
    }
    if (row.schemaVersion !== definition.version)
      throw new createError.InternalServerError(
        "The saved dashboard schema version does not match its definition",
      );
    return {
      dashboard: {
        uuid: row.uuid,
        schemaVersion: row.schemaVersion,
        revision: row.revision,
        definition,
        savedAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }
}
