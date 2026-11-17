import { CurrencyCatalog } from "@/lib/currencies";
import type { CurrenciesModel } from "./model";

export abstract class CurrenciesService {
  static index(): CurrenciesModel["currencies"] {
    return { items: [...CurrencyCatalog.items()] };
  }
}
