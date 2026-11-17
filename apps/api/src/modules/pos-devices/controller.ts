import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { PosDevicesModel } from "./model";
import { PosDevicesService } from "./service";
import { posDeviceZReportsController } from "./z-reports/controller";

export const posDevicesController = new Elysia({ name: "pos-devices" })
  .use(authPlugin)
  .use(posDeviceZReportsController)
  .guard({
    tenant: true,
    detail: { tags: ["POS devices"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/pos-devices/",
    ({ actor, query }) => PosDevicesService.index(actor, query),
    {
      query: PosDevicesModel.query,
      response: PosDevicesModel.list,
      detail: {
        summary:
          "List POS devices of the selected branch or, without a branch, every company device",
      },
    },
  )
  .post(
    "/pos-devices/",
    ({ actor, body, set }) => {
      set.status = 201;
      return PosDevicesService.store(actor, body);
    },
    {
      body: PosDevicesModel.body,
      response: { 201: PosDevicesModel.device },
      detail: { summary: "Register a bank POS device" },
    },
  )
  .get(
    "/pos-devices/:deviceUuid",
    ({ actor, params }) => PosDevicesService.show(actor, params.deviceUuid),
    {
      params: PosDevicesModel.params,
      response: PosDevicesModel.device,
      detail: { summary: "POS device details" },
    },
  )
  .patch(
    "/pos-devices/:deviceUuid",
    ({ actor, params, body }) =>
      PosDevicesService.update(actor, params.deviceUuid, body),
    {
      params: PosDevicesModel.params,
      body: PosDevicesModel.patch,
      response: PosDevicesModel.device,
      detail: {
        summary:
          "Edit a POS device or deactivate it; devices are never deleted",
      },
    },
  );
