import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { DashboardLayoutModel } from "./model";
import { DashboardLayoutService } from "./service";

export const dashboardLayoutController = new Elysia({
  name: "dashboard-layout",
})
  .use(authPlugin)
  .get(
    "/dashboard/layout",
    ({ user }) => DashboardLayoutService.show(user.id, null),
    {
      auth: true,
      response: DashboardLayoutModel.response,
      detail: {
        tags: ["Dashboard"],
        security: [{ cookieAuth: [] }],
        summary: "Read the account's global dashboard layout",
      },
    },
  )
  .put(
    "/dashboard/layout",
    ({ user, body }) => DashboardLayoutService.save(user.id, null, body),
    {
      auth: true,
      body: DashboardLayoutModel.saveBody,
      response: DashboardLayoutModel.response,
      detail: {
        tags: ["Dashboard"],
        security: [{ cookieAuth: [] }],
        summary: "Save the account's global dashboard layout",
      },
    },
  )
  .get(
    "/dashboard/organization/layout",
    ({ actor }) =>
      DashboardLayoutService.show(actor.userId, actor.organizationId),
    {
      tenant: true,
      response: DashboardLayoutModel.response,
      detail: {
        tags: ["Dashboard"],
        security: [{ cookieAuth: [] }],
        summary:
          "Read the account's personal dashboard layout in this organization",
      },
    },
  )
  .put(
    "/dashboard/organization/layout",
    ({ actor, body }) =>
      DashboardLayoutService.save(actor.userId, actor.organizationId, body),
    {
      tenant: true,
      body: DashboardLayoutModel.saveBody,
      response: DashboardLayoutModel.response,
      detail: {
        tags: ["Dashboard"],
        security: [{ cookieAuth: [] }],
        summary:
          "Save the account's personal dashboard layout in this organization",
      },
    },
  );
