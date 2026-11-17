import createError from "http-errors";
import readXlsxFile, {
  InvalidInputError,
  InvalidSpreadsheetError,
  readSheet,
  SheetNotFoundError,
} from "read-excel-file/node";

/**
 * The one supported workbook format. The bytes must carry the ZIP/OOXML
 * signature before the parser is allowed to read them; the client file name is
 * never trusted beyond selecting the documented extension.
 */
export const workbookMaxBytes = 10 * 1024 * 1024;
/** Explicit supported workbook dimensions; larger sheets are rejected. */
export const maximumWorkbookRows = 5000;
export const maximumWorkbookColumns = 64;
const supportedExtension = ".xlsx";
const zipSignature = [0x50, 0x4b, 0x03, 0x04] as const;

export type WorkbookCell = unknown;
export type WorkbookRow = WorkbookCell[];
export type WorkbookSheet = { name: string; rows: WorkbookRow[] };

export function assertWorkbookFile(fileName: string, size: number): void {
  if (fileName.length > 255)
    throw new createError.UnprocessableEntity(
      "The workbook file name is too long",
    );
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(supportedExtension)) {
    throw new createError.UnprocessableEntity(
      lower.endsWith(".xls")
        ? "Only .xlsx workbooks are supported; re-export the report as .xlsx"
        : "Only .xlsx workbooks are supported",
    );
  }
  if (size === 0)
    throw new createError.BadRequest("The selected workbook is empty");
  if (size > workbookMaxBytes)
    throw new createError.PayloadTooLarge("Workbooks must be 10 MB or smaller");
}

function assertWorkbookBytes(bytes: Uint8Array): void {
  if (bytes.length < zipSignature.length || bytes[0] !== zipSignature[0])
    throw unreadableWorkbook();
  for (let index = 1; index < zipSignature.length; index += 1) {
    if (bytes[index] !== zipSignature[index]) throw unreadableWorkbook();
  }
  if (bytes.length > workbookMaxBytes)
    throw new createError.PayloadTooLarge("Workbooks must be 10 MB or smaller");
}

function unreadableWorkbook(): Error {
  return new createError.UnprocessableEntity(
    "The selected file is not a readable .xlsx workbook",
  );
}

function isWorkbookError(error: unknown): boolean {
  return (
    error instanceof InvalidInputError ||
    error instanceof InvalidSpreadsheetError ||
    error instanceof SheetNotFoundError
  );
}

/** Reads every worksheet once so upload can persist the available sheet names. */
export async function readWorkbook(
  bytes: Uint8Array,
): Promise<WorkbookSheet[]> {
  assertWorkbookBytes(bytes);
  try {
    const sheets = (await readXlsxFile(Buffer.from(bytes))).map((sheet) => ({
      name: sheet.sheet,
      rows: sheet.data as WorkbookRow[],
    }));
    for (const sheet of sheets) {
      const rows = lastRowNumber(sheet.rows);
      if (rows > maximumWorkbookRows)
        throw new createError.UnprocessableEntity(
          `Worksheet ${sheet.name} has ${rows} rows; at most ${maximumWorkbookRows} rows are supported`,
        );
      const columns = usedColumnCount(sheet.rows);
      if (columns > maximumWorkbookColumns)
        throw new createError.UnprocessableEntity(
          `Worksheet ${sheet.name} has ${columns} columns; at most ${maximumWorkbookColumns} columns are supported`,
        );
    }
    return sheets;
  } catch (error) {
    if (isWorkbookError(error)) throw unreadableWorkbook();
    throw error;
  }
}

/** Reads only the requested worksheet of the stored workbook. */
export async function readWorkbookSheet(
  bytes: Uint8Array,
  sheetName: string,
): Promise<WorkbookRow[]> {
  assertWorkbookBytes(bytes);
  try {
    return (await readSheet(Buffer.from(bytes), sheetName)) as WorkbookRow[];
  } catch (error) {
    if (isWorkbookError(error)) {
      throw new createError.UnprocessableEntity(
        `Worksheet ${sheetName} could not be read`,
      );
    }
    throw error;
  }
}

/** Calendar-day safe text for every cell kind the parser can return. */
export function cellText(value: WorkbookCell): string {
  if (value == null) return "";
  if (value instanceof Date)
    return Number.isNaN(value.getTime())
      ? ""
      : value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return "";
}

export function cellAt(
  rows: WorkbookRow[],
  rowNumber: number,
  column: string,
): WorkbookCell {
  const index = columnIndex(column);
  if (index === null || rowNumber < 1) return null;
  const row = rows[rowNumber - 1];
  if (!row) return null;
  return row[index] ?? null;
}

/** Converts a zero-based array index to its spreadsheet column letters. */
export function columnLetter(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

/** Converts validated column letters to a zero-based array index. */
export function columnIndex(column: string): number | null {
  if (!/^[A-Z]{1,3}$/.test(column)) return null;
  let value = 0;
  for (const character of column) {
    value = value * 26 + (character.charCodeAt(0) - 64);
  }
  return value - 1;
}

/** Highest populated column across the sheet, capped for preview payloads. */
export function usedColumnCount(rows: WorkbookRow[]): number {
  let count = 0;
  for (const row of rows) {
    let last = row.length;
    while (last > 0 && cellText(row[last - 1]) === "") last -= 1;
    count = Math.max(count, last);
  }
  return count;
}

export function lastRowNumber(rows: WorkbookRow[]): number {
  for (let index = rows.length; index > 0; index -= 1) {
    const row = rows[index - 1];
    if (row?.some((cell) => cellText(cell) !== "")) return index;
  }
  return 0;
}

export type QuantityParse =
  | { quantity: number; issue: null }
  | {
      quantity: null;
      issue:
        | "QUANTITY_EMPTY"
        | "QUANTITY_NOT_INTEGER"
        | "QUANTITY_NOT_POSITIVE"
        | "QUANTITY_TOO_LARGE";
    };

const maximumSaleQuantity = 2147483647;

/**
 * Sale quantities stay positive integers. Fractional or negative spreadsheet
 * values become an explicit blocking row issue; they are never rounded.
 */
export function parseQuantity(value: WorkbookCell): QuantityParse {
  const text = cellText(value);
  if (text === "") return { quantity: null, issue: "QUANTITY_EMPTY" };
  const matches = /^(\d+)(?:\.0+)?$/.exec(text);
  if (matches === null)
    return { quantity: null, issue: "QUANTITY_NOT_INTEGER" };
  const quantity = Number(matches[1]);
  if (!Number.isSafeInteger(quantity))
    return { quantity: null, issue: "QUANTITY_TOO_LARGE" };
  if (quantity <= 0) return { quantity: null, issue: "QUANTITY_NOT_POSITIVE" };
  if (quantity > maximumSaleQuantity)
    return { quantity: null, issue: "QUANTITY_TOO_LARGE" };
  return { quantity, issue: null };
}

export function validColumn(column: string | null | undefined): boolean {
  return column == null || columnIndex(column) !== null;
}

export type ModposDateIssue =
  "MODPOS_DATE_MISSING" | "MODPOS_DATE_INVALID" | "MODPOS_DATE_RANGE";

/**
 * A verified Modpos "Ürün Raporu". Only the signature observed in real
 * reports is accepted; nothing is inferred from the file name or from a
 * generic sheet name.
 */
export type ModposReport = {
  sheetName: string;
  headerRow: number;
  productCodeColumn: string;
  productColumn: string;
  quantityColumn: string;
  /** Genel Toplam footers below the header, never product rows. */
  excludedRows: number[];
  dateFrom: string | null;
  dateTo: string | null;
  dateIssue: ModposDateIssue | null;
};

const modposTitle = "ürün raporu";
const modposHeaderLabels = {
  productCode: "kodu",
  product: "ürün tipi",
  quantity: "adedi",
};
const modposFooterLabel = "genel toplam";
/** The report title and header never sit deeper than this. */
const modposHeaderScanRows = 30;
const modposDatePattern = /(\d{1,2})\.(\d{1,2})\.(\d{4})/g;

function modposText(value: WorkbookCell): string {
  return cellText(value).toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

/** Strict calendar day from dotted day.month.year digits; never normalized. */
function modposDay(day: number, month: number, year: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1)
    return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return null;
  return date.toISOString().slice(0, 10);
}

function modposDates(
  rows: WorkbookRow[],
  headerRow: number,
): Pick<ModposReport, "dateFrom" | "dateTo" | "dateIssue"> {
  let text = "";
  for (let row = 1; row < headerRow && text === ""; row += 1) {
    for (const cell of rows[row - 1] ?? []) {
      if (modposText(cell).startsWith("tarih")) {
        text = cellText(cell);
        break;
      }
    }
  }
  if (text === "")
    return {
      dateFrom: null,
      dateTo: null,
      dateIssue: "MODPOS_DATE_MISSING",
    };
  const days: string[] = [];
  for (const match of text.matchAll(modposDatePattern)) {
    const parsed = modposDay(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    );
    // An unparseable stamp is reported, never corrected into a nearby day.
    if (parsed === null)
      return { dateFrom: null, dateTo: null, dateIssue: "MODPOS_DATE_INVALID" };
    days.push(parsed);
  }
  if (days.length === 0)
    return { dateFrom: null, dateTo: null, dateIssue: "MODPOS_DATE_INVALID" };
  const unique = [...new Set(days)].sort();
  if (unique.length > 1)
    return {
      dateFrom: unique[0] ?? null,
      dateTo: unique[unique.length - 1] ?? null,
      dateIssue: "MODPOS_DATE_RANGE",
    };
  return {
    dateFrom: unique[0] ?? null,
    dateTo: unique[0] ?? null,
    dateIssue: null,
  };
}

/**
 * Recognizes the Modpos Ürün Raporu layout by the printed `Ürün Raporu` title
 * and one header row that carries `Kodu`, `Ürün Tipi` and `Adedi` on the same
 * physical row, then derives the real columns from that row. A Genel Toplam
 * footer is identified separately as excluded rows and is not part of the
 * signature. Quantities stay the reported Adedi values; İkram Adet, Fixler,
 * Biletler and the money columns are never interpreted here.
 */
export function detectModposReport(
  sheetName: string,
  rows: WorkbookRow[],
): ModposReport | null {
  const lastRow = lastRowNumber(rows);
  const scan = Math.min(lastRow, modposHeaderScanRows);
  let titleRow = 0;
  let headerRow = 0;
  let productCodeIndex = -1;
  let productIndex = -1;
  let quantityIndex = -1;
  for (let row = 1; row <= scan && headerRow === 0; row += 1) {
    const cells = rows[row - 1] ?? [];
    const limit = Math.min(cells.length, maximumWorkbookColumns);
    // Every label must be printed on the same physical row; labels scattered
    // across different rows are not a Modpos header.
    let codeIndex = -1;
    let nameIndex = -1;
    let quantityColumnIndex = -1;
    for (let index = 0; index < limit; index += 1) {
      const value = modposText(cells[index]);
      if (titleRow === 0 && value === modposTitle) titleRow = row;
      if (value === modposHeaderLabels.productCode && codeIndex === -1)
        codeIndex = index;
      if (value === modposHeaderLabels.product && nameIndex === -1)
        nameIndex = index;
      if (value === modposHeaderLabels.quantity && quantityColumnIndex === -1)
        quantityColumnIndex = index;
    }
    if (codeIndex !== -1 && nameIndex !== -1 && quantityColumnIndex !== -1) {
      headerRow = row;
      productCodeIndex = codeIndex;
      productIndex = nameIndex;
      quantityIndex = quantityColumnIndex;
    }
  }
  if (
    titleRow === 0 ||
    headerRow === 0 ||
    titleRow >= headerRow ||
    headerRow >= lastRow
  )
    return null;
  const productCodeColumn = columnLetter(productCodeIndex);
  const productColumn = columnLetter(productIndex);
  const quantityColumn = columnLetter(quantityIndex);
  if (new Set([productCodeColumn, productColumn, quantityColumn]).size !== 3)
    return null;

  const excludedRows: number[] = [];
  for (let row = headerRow + 1; row <= lastRow; row += 1) {
    // The footer has no product code, prints Genel Toplam as the product and a
    // non-quantity total in the quantity column.
    if (
      modposText(cellAt(rows, row, productCodeColumn)) === "" &&
      modposText(cellAt(rows, row, productColumn)) === modposFooterLabel &&
      parseQuantity(cellAt(rows, row, quantityColumn)).quantity === null
    )
      excludedRows.push(row);
  }
  return {
    sheetName,
    headerRow,
    productCodeColumn,
    productColumn,
    quantityColumn,
    excludedRows,
    ...modposDates(rows, headerRow),
  };
}
