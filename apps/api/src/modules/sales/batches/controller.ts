import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { SalesBatchesModel } from "./model";
import { SalesBatchesService } from "./service";

function attachmentName(value: string): string {
  const base = value.split(/[\\/]/).pop() ?? "workbook.xlsx";
  const safe = base.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "_");
  return safe === "" ? "workbook.xlsx" : safe;
}

export const salesBatchesController = new Elysia({
  name: "sales-batches",
  prefix: "/sales/batches",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Sales"], security: [{ cookieAuth: [] }] },
  })
  .get("/", ({ actor, query }) => SalesBatchesService.index(actor, query), {
    query: SalesBatchesModel.query,
    response: SalesBatchesModel.list,
    detail: { summary: "List uploaded sales batches" },
  })
  .post(
    "/",
    ({ actor, body, set }) => {
      set.status = 201;
      return SalesBatchesService.store(actor, body.file);
    },
    {
      body: SalesBatchesModel.body,
      response: { 201: SalesBatchesModel.detail },
      detail: {
        summary:
          "Upload an original .xlsx sales report and create a draft batch",
      },
    },
  )
  .get(
    "/:uuid",
    ({ actor, params }) => SalesBatchesService.show(actor, params.uuid),
    {
      params: SalesBatchesModel.params,
      response: SalesBatchesModel.detail,
      detail: { summary: "Sales batch details" },
    },
  )
  .get(
    "/:uuid/preview",
    ({ actor, params, query }) =>
      SalesBatchesService.preview(actor, params.uuid, query.sheet),
    {
      params: SalesBatchesModel.params,
      query: SalesBatchesModel.previewQuery,
      response: SalesBatchesModel.preview,
      detail: { summary: "Preview the draft workbook rows and stock plan" },
    },
  )
  .patch(
    "/:uuid",
    ({ actor, params, body }) =>
      SalesBatchesService.update(actor, params.uuid, body),
    {
      params: SalesBatchesModel.params,
      body: SalesBatchesModel.patch,
      response: SalesBatchesModel.detail,
      detail: {
        summary:
          "Save the draft business date, worksheet mapping, exclusions and channel/product mappings",
      },
    },
  )
  .post(
    "/:uuid/process",
    ({ actor, params }) => SalesBatchesService.process(actor, params.uuid),
    {
      params: SalesBatchesModel.params,
      response: SalesBatchesModel.detail,
      detail: { summary: "Record every mapped row as sales atomically" },
    },
  )
  .delete(
    "/:uuid",
    ({ actor, params }) => SalesBatchesService.destroy(actor, params.uuid),
    {
      params: SalesBatchesModel.params,
      response: SalesBatchesModel.success,
      detail: {
        summary:
          "Delete a draft batch or reverse a processed batch's recorded stock",
      },
    },
  )
  .get(
    "/:uuid/file",
    async ({ actor, params }) => {
      const file = await SalesBatchesService.download(actor, params.uuid);
      const body = new Uint8Array(file.bytes.byteLength);
      body.set(file.bytes);
      return new Response(body, {
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${attachmentName(
            file.fileName,
          )}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    },
    {
      params: SalesBatchesModel.downloadParams,
      detail: { summary: "Download the original private workbook" },
    },
  );
