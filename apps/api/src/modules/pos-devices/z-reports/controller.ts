import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { PosDeviceZReportsModel } from "./model";
import { PosDeviceZReportsService } from "./service";

export const posDeviceZReportsController = new Elysia({
  name: "pos-devices-z-reports",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["POS devices"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/pos-devices/z-reports/",
    ({ actor, query }) => PosDeviceZReportsService.index(actor, query),
    {
      query: PosDeviceZReportsModel.query,
      response: PosDeviceZReportsModel.list,
      detail: {
        summary:
          "List Z reports of the selected branch or every company report, optionally filtered by POS device or sales batch",
      },
    },
  )
  .post(
    "/pos-devices/:deviceUuid/z-reports/",
    ({ actor, params, body, set }) => {
      set.status = 201;
      return PosDeviceZReportsService.store(actor, params.deviceUuid, body);
    },
    {
      params: PosDeviceZReportsModel.createParams,
      body: PosDeviceZReportsModel.body,
      response: { 201: PosDeviceZReportsModel.report },
      detail: {
        summary:
          "Record a bank POS Z report and optionally link one processed sales batch",
      },
    },
  )
  .get(
    "/pos-devices/:deviceUuid/z-reports/:uuid",
    ({ actor, params }) =>
      PosDeviceZReportsService.show(actor, params.deviceUuid, params.uuid),
    {
      params: PosDeviceZReportsModel.params,
      response: PosDeviceZReportsModel.report,
      detail: { summary: "Z report details for one POS device" },
    },
  )
  .patch(
    "/pos-devices/:deviceUuid/z-reports/:uuid",
    ({ actor, params, body }) =>
      PosDeviceZReportsService.update(
        actor,
        params.deviceUuid,
        params.uuid,
        body,
      ),
    {
      params: PosDeviceZReportsModel.params,
      body: PosDeviceZReportsModel.patch,
      response: PosDeviceZReportsModel.report,
      detail: {
        summary:
          "Edit a Z report and attach, detach or reassign its single sales batch",
      },
    },
  );
