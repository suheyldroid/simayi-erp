import type { TenantActor } from "@/lib/tenant";
import { FinanceService } from "../../finance/service";
import { SalesService } from "../service";
import type { ReceiptsModel } from "./model";

export abstract class ReceiptService {
  /**
   * Records one explicit partial or full receipt against a priced sale. The
   * cash inflow is posted by the finance service under its advisory lock,
   * which also rejects an amount above the outstanding balance and replays an
   * existing request key.
   */
  static async store(
    actor: TenantActor,
    saleUuid: string,
    body: ReceiptsModel["body"],
  ): Promise<ReceiptsModel["sale"]> {
    await FinanceService.receipt(actor, saleUuid, body);
    return SalesService.show(actor, saleUuid);
  }
}
