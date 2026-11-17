import createError from "http-errors";

export const purchaseOrderReferencePattern = "PO-{ref:04d}";
export const buildOrderReferencePattern = "BO-{ref:04d}";
export const salesBatchReferencePattern = "SB-{ref:04d}";

export type ReferencePatternKey =
  | "PURCHASEORDER_REFERENCE_PATTERN"
  | "BUILDORDER_REFERENCE_PATTERN"
  | "SALESBATCH_REFERENCE_PATTERN";

export function referencePattern(key: ReferencePatternKey): string {
  if (key === "PURCHASEORDER_REFERENCE_PATTERN")
    return purchaseOrderReferencePattern;
  if (key === "SALESBATCH_REFERENCE_PATTERN") return salesBatchReferencePattern;
  return buildOrderReferencePattern;
}

export function referenceToken(value: string): {
  width: number | null;
  token: string;
} {
  const matches = [...value.matchAll(/\{ref(?::0(\d+)d)?\}/g)];
  const remainder = value.replace(/\{ref(?::0\d+d)?\}/g, "");
  const widthText = matches[0]?.[1];
  const width = widthText === undefined ? null : Number(widthText);
  if (
    matches.length !== 1 ||
    /[{}]/.test(remainder) ||
    (width !== null && (width < 1 || width > 18))
  )
    throw new createError.UnprocessableEntity(
      "Reference pattern must contain exactly one {ref} or {ref:0Nd} token",
    );
  return {
    width,
    token: width === null ? "{ref}" : `{ref:0${width}d}`,
  };
}
