import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { dashboardCatalog } from "./catalog";
import { DashboardAnalyticsModel } from "./model";
import { DashboardAnalyticsService } from "./service";

export const dashboardAnalyticsController = new Elysia({
  name: "dashboard-analytics",
})
  .use(authPlugin)
  .get("/dashboard/catalog", () => dashboardCatalog("global"), {
    auth: true,
    response: DashboardAnalyticsModel.catalog,
    detail: {
      tags: ["Dashboard"],
      security: [{ cookieAuth: [] }],
      summary: "Server-owned capabilities for the global dashboard editor",
    },
  })
  .post(
    "/dashboard/data",
    ({ user, body }) =>
      DashboardAnalyticsService.resolveMany(body.widgets, {
        kind: "global",
        userId: user.id,
      }),
    {
      auth: true,
      body: DashboardAnalyticsModel.dataBody,
      response: DashboardAnalyticsModel.data,
      detail: {
        tags: ["Dashboard"],
        security: [{ cookieAuth: [] }],
        summary: "Resolve global dashboard widget aggregates",
      },
    },
  )
  .get(
    "/dashboard/organization/catalog",
    () => dashboardCatalog("organization"),
    {
      tenant: true,
      response: DashboardAnalyticsModel.catalog,
      detail: {
        tags: ["Dashboard"],
        security: [{ cookieAuth: [] }],
        summary:
          "Server-owned capabilities for the organization dashboard editor",
      },
    },
  )
  .post(
    "/dashboard/organization/data",
    ({ actor, body }) =>
      DashboardAnalyticsService.resolveMany(body.widgets, {
        kind: "organization",
        organizationId: actor.organizationId,
        // Optional selected branch: absent means the company roll-up.
        branchId: actor.branchId,
      }),
    {
      tenant: true,
      body: DashboardAnalyticsModel.dataBody,
      response: DashboardAnalyticsModel.data,
      detail: {
        tags: ["Dashboard"],
        security: [{ cookieAuth: [] }],
        summary:
          "Resolve organization dashboard widget aggregates for the company or selected branch",
      },
    },
  );
