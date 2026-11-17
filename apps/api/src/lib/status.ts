const purchaseOrderLabels: Readonly<Record<number, string>> = {
  10: "Pending",
  20: "Placed",
  25: "On hold",
  30: "Complete",
  40: "Cancelled",
  50: "Lost",
  60: "Returned",
};

function label(
  labels: Readonly<Record<number, string>>,
  status: number,
): string {
  return labels[status] ?? String(status);
}

export function purchaseOrderStatusLabel(status: number): string {
  return label(purchaseOrderLabels, status);
}

/**
 * The native purchase-order status values and labels the API actually stores.
 * Callers must offer only these options; no status is invented in the client.
 */
export const purchaseOrderStatusOptions = Object.entries(
  purchaseOrderLabels,
).map(([value, label]) => ({ value: Number(value), label }));
