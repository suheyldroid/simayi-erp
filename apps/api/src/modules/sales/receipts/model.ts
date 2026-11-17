import { t, type UnwrapSchema } from "elysia";
import { resourceUuid } from "@/lib/dto";
import { FinanceModel } from "../../finance/model";
import { SalesModel } from "../model";

export const ReceiptsModel = {
  params: t.Object({ uuid: resourceUuid }),
  body: FinanceModel.positiveMoneyBody,
  sale: SalesModel.sale,
} as const;
export type ReceiptsModel = {
  [K in keyof typeof ReceiptsModel]: UnwrapSchema<(typeof ReceiptsModel)[K]>;
};
