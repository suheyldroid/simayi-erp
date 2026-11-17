import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { UsersService } from "../users/service";
import { dashboardAnalyticsController } from "./analytics/controller";
import { dashboardLayoutController } from "./layout/controller";
import { DashboardModel } from "./model";
import { DashboardService } from "./service";

export const dashboardController = new Elysia({ name: "dashboard-controller" })
  .use(authPlugin)
  .use(dashboardLayoutController)
  .use(dashboardAnalyticsController)
  .guard({
    auth: true,
    detail: { tags: ["Dashboard"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/dashboard/system",
    ({ user }) => {
      UsersService.requireAdministrator(user.role);
      return DashboardService.system();
    },
    {
      response: DashboardModel.system,
      detail: {
        summary: "Platform-wide aggregate totals and six-month activity",
      },
    },
  )
  .get(
    "/dashboard/personal",
    ({ user }) => DashboardService.personal(user.id),
    {
      response: DashboardModel.personal,
      detail: {
        summary: "Membership-scoped totals and low-stock alerts",
      },
    },
  );
