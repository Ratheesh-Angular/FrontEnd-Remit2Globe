import { jsPDF } from "jspdf";
import { format } from "date-fns";

export type TransferReceiptPdfData = {
  referenceCode: string;
  status: string;
  generatedAt: Date;
  amounts: {
    fromCurrency: string;
    toCurrency: string;
    youSend: number;
    fee: number;
    totalToPay: number;
    receive: number | null;
    hasRate: boolean;
    rate: number | null;
  } | null;
  recipientCountry: string;
  beneficiary: {
    displayName: string;
    deliveryLabel: string;
    payoutDetails: string;
  };
  compliance: {
    source: string;
    purpose: string;
    relationship: string;
  } | null;
  payInLabel: string;
  payerPhone: string | null;
  /** e.g. post-confirmation message on send-money */
  additionalNote?: string;
};

const PAGE_MARGIN = 36;
const PAGE_WIDTH = 595.28; // A4 width in pt
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CARD_PADDING = 14;
const SECTION_GAP = 12;
const ROW_GAP = 7;
const LABEL_WIDTH = 128;
const VALUE_WIDTH = CONTENT_WIDTH - CARD_PADDING * 2 - LABEL_WIDTH - 18;
const BRAND = { r: 13, g: 148, b: 136 };
const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const BORDER = { r: 226, g: 232, b: 240 };
const SOFT = { r: 248, g: 250, b: 252 };

function statusLabel(s: string) {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_PAYMENT: "Pending payment",
    PAYMENT_SUBMITTED: "Payment submitted",
    UNDER_REVIEW: "Under review",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  };
  return map[s] ?? s.replace(/_/g, " ");
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function setTextStyle(
  doc: jsPDF,
  opts?: {
    size?: number;
    bold?: boolean;
    color?: { r: number; g: number; b: number };
  },
) {
  const size = opts?.size ?? 10;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(size);
  const color = opts?.color ?? INK;
  doc.setTextColor(color.r, color.g, color.b);
}

function splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "—", maxWidth);
}

function lineHeight(size: number): number {
  return size + 3.5;
}

function roundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill?: { r: number; g: number; b: number },
  stroke?: { r: number; g: number; b: number },
) {
  if (fill) doc.setFillColor(fill.r, fill.g, fill.b);
  if (stroke) doc.setDrawColor(stroke.r, stroke.g, stroke.b);
  doc.roundedRect(
    x,
    y,
    w,
    h,
    radius,
    radius,
    fill && stroke ? "FD" : fill ? "F" : "S",
  );
}

function addFooter(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
  doc.line(PAGE_MARGIN, pageH - 34, PAGE_WIDTH - PAGE_MARGIN, pageH - 34);
  setTextStyle(doc, { size: 8, color: MUTED });
  doc.text("Remit 2 Globe transfer receipt", PAGE_MARGIN, pageH - 22);
  doc.text("Page 1", PAGE_WIDTH - PAGE_MARGIN, pageH - 22, { align: "right" });
}

type ReceiptRow = {
  label: string;
  value: string;
  bold?: boolean;
};

type ReceiptGroup = {
  title: string;
  rows: ReceiptRow[];
};

function rowHeight(doc: jsPDF, row: ReceiptRow, valueSize = 8.8): number {
  const labelLines = splitText(doc, row.label, LABEL_WIDTH);
  const valueLines = splitText(doc, row.value, VALUE_WIDTH);
  return Math.max(
    labelLines.length * lineHeight(8),
    valueLines.length * lineHeight(row.bold ? 9.4 : valueSize),
  );
}

function groupHeight(doc: jsPDF, group: ReceiptGroup): number {
  const rowsHeight = group.rows.reduce(
    (total, row) => total + rowHeight(doc, row) + ROW_GAP,
    0,
  );
  return 18 + Math.max(0, rowsHeight - ROW_GAP);
}

function cardHeight(doc: jsPDF, groups: ReceiptGroup[]): number {
  const groupsHeight = groups.reduce(
    (total, group) => total + groupHeight(doc, group) + SECTION_GAP,
    0,
  );
  return CARD_PADDING * 2 + Math.max(0, groupsHeight - SECTION_GAP);
}

function drawWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  opts?: {
    size?: number;
    bold?: boolean;
    color?: { r: number; g: number; b: number };
  },
) {
  const size = opts?.size ?? 9;
  setTextStyle(doc, opts);
  const lines = splitText(doc, text, maxWidth);
  doc.text(lines, x, y, { baseline: "top" });
  return y + lines.length * lineHeight(size);
}

function drawCard(
  doc: jsPDF,
  title: string,
  y: number,
  groups: ReceiptGroup[],
): number {
  const h = cardHeight(doc, groups);
  const x = PAGE_MARGIN;
  roundedRect(doc, x, y, CONTENT_WIDTH, h, 12, { r: 255, g: 255, b: 255 }, BORDER);
  let cursorY = y + CARD_PADDING;

  setTextStyle(doc, { size: 9.5, bold: true, color: INK });
  doc.text(title.toUpperCase(), x + CARD_PADDING, cursorY, { baseline: "top" });
  cursorY += 22;

  for (const group of groups) {
    if (group.title) {
      setTextStyle(doc, { size: 8, bold: true, color: BRAND });
      doc.text(group.title.toUpperCase(), x + CARD_PADDING, cursorY, {
        baseline: "top",
      });
      cursorY += 13;
    }

    for (const row of group.rows) {
      const labelX = x + CARD_PADDING;
      const valueX = labelX + LABEL_WIDTH + 18;
      const nextY = Math.max(
        drawWrapped(doc, row.label, labelX, cursorY, LABEL_WIDTH, {
          size: 8,
          color: MUTED,
        }),
        drawWrapped(doc, row.value, valueX, cursorY, VALUE_WIDTH, {
          size: row.bold ? 9.4 : 8.8,
          bold: row.bold,
          color: INK,
        }),
      );
      cursorY = nextY + ROW_GAP;
    }
    cursorY += SECTION_GAP - ROW_GAP;
  }

  return y + h + SECTION_GAP;
}

export function downloadTransferReceiptPdf(data: TransferReceiptPdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = PAGE_MARGIN;
  const x = PAGE_MARGIN;

  roundedRect(doc, x, y, CONTENT_WIDTH, 92, 14, SOFT, BORDER);
  setTextStyle(doc, { size: 9, bold: true, color: BRAND });
  doc.text("REMIT 2 GLOBE", x + CARD_PADDING, y + CARD_PADDING, {
    baseline: "top",
  });
  setTextStyle(doc, { size: 21, bold: true, color: INK });
  doc.text("Transfer receipt", x + CARD_PADDING, y + 34, { baseline: "top" });
  setTextStyle(doc, { size: 9, color: MUTED });
  doc.text(
    `Generated ${format(data.generatedAt, "PPP p")}`,
    x + CARD_PADDING,
    y + 66,
    { baseline: "top" },
  );

  const status = statusLabel(data.status);
  const pillW = Math.max(96, doc.getTextWidth(status) + 28);
  roundedRect(
    doc,
    PAGE_WIDTH - PAGE_MARGIN - CARD_PADDING - pillW,
    y + CARD_PADDING,
    pillW,
    26,
    13,
    { r: 236, g: 253, b: 245 },
    { r: 153, g: 246, b: 228 },
  );
  setTextStyle(doc, { size: 9, bold: true, color: BRAND });
  doc.text(status, PAGE_WIDTH - PAGE_MARGIN - CARD_PADDING - pillW / 2, y + CARD_PADDING + 8, {
    align: "center",
    baseline: "top",
  });
  setTextStyle(doc, { size: 9, color: MUTED });
  doc.text("Reference", PAGE_WIDTH - PAGE_MARGIN - CARD_PADDING, y + 56, {
    align: "right",
    baseline: "top",
  });
  setTextStyle(doc, { size: 11, bold: true, color: INK });
  doc.text(data.referenceCode, PAGE_WIDTH - PAGE_MARGIN - CARD_PADDING, y + 72, {
    align: "right",
    baseline: "top",
  });
  y += 106;

  let summaryGroups: ReceiptGroup[];
  if (data.amounts) {
    const a = data.amounts;
    const amountRows: ReceiptRow[] = [
      {
        label: "You send",
        value: `${fmtNum(a.youSend)} ${a.fromCurrency}`,
      },
      { label: "Fee", value: `${fmtNum(a.fee)} ${a.fromCurrency}` },
      {
        label: "Total to pay",
        value: `${fmtNum(a.totalToPay)} ${a.fromCurrency}`,
        bold: true,
      },
      {
        label: "Recipient receives",
        value: `${a.receive != null ? fmtNum(a.receive) : "—"} ${a.toCurrency}`,
        bold: true,
      },
    ];
    if (a.hasRate && a.rate != null) {
      amountRows.push({
        label: "Indicative rate",
        value: `1 ${a.fromCurrency} = ${fmtNum(a.rate)} ${a.toCurrency}`,
      });
    }
    summaryGroups = [{ title: "", rows: amountRows }];
  } else {
    summaryGroups = [
      {
        title: "",
        rows: [
          {
            label: "Amount details",
            value: "Amount details are not available on this receipt.",
          },
        ],
      },
    ];
  }
  y = drawCard(doc, "Payment summary", y, summaryGroups);

  const detailGroups: ReceiptGroup[] = [
    {
      title: "Recipient",
      rows: [
        { label: "Country", value: data.recipientCountry },
        { label: "Name", value: data.beneficiary.displayName, bold: true },
        { label: "Delivery", value: data.beneficiary.deliveryLabel },
        { label: "Payout", value: data.beneficiary.payoutDetails },
      ],
    },
  ];

  if (data.compliance) {
    detailGroups.push({
      title: "Compliance",
      rows: [
        { label: "Source of income", value: data.compliance.source },
        { label: "Transfer purpose", value: data.compliance.purpose },
        { label: "Relationship", value: data.compliance.relationship },
      ],
    });
  }

  const payRows: ReceiptRow[] = [
    { label: "Payment method", value: data.payInLabel },
  ];
  if (data.payerPhone) {
    payRows.push({ label: "Payer phone (STK)", value: data.payerPhone });
  }
  detailGroups.push({ title: "How to pay us", rows: payRows });

  if (data.additionalNote?.trim()) {
    detailGroups.push({
      title: "Note",
      rows: [{ label: "Message", value: data.additionalNote.trim() }],
    });
  }

  drawCard(doc, "Transfer details", y, detailGroups);

  addFooter(doc);
  const safe = data.referenceCode.replace(/[^\w.-]+/g, "_");
  doc.save(`transfer-receipt-${safe || "receipt"}.pdf`);
}
