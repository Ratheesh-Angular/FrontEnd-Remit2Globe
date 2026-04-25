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

const MARGIN = 48;
const MAX_TEXT_W = 520;
const GAP = 14;
const GAP_SM = 10;

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
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function addPara(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts?: { size?: number; bold?: boolean; maxW?: number },
): number {
  const size = opts?.size ?? 10;
  const maxW = opts?.maxW ?? MAX_TEXT_W;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * (size * 0.45 + 2);
}

export function downloadTransferReceiptPdf(data: TransferReceiptPdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;
  const x = MARGIN;
  const pageH = doc.internal.pageSize.getHeight();

  const needSpace = (h: number) => {
    if (y + h > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Transfer receipt", x, y);
  y += 28;

  y = addPara(doc, `Reference: ${data.referenceCode}`, x, y, { bold: true, size: 11 });
  y = addPara(
    doc,
    `Status: ${statusLabel(data.status)}`,
    x,
    y + GAP_SM * 0.2,
  );
  y = addPara(
    doc,
    `Generated: ${format(data.generatedAt, "PPP p")}`,
    x,
    y,
  );
  y += GAP + 4;

  needSpace(80);
  doc.setDrawColor(200, 200, 200);
  doc.line(x, y, x + MAX_TEXT_W, y);
  y += GAP + 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Amounts", x, y);
  y += GAP;

  if (data.amounts) {
    const a = data.amounts;
    y = addPara(
      doc,
      `You send: ${fmtNum(a.youSend)} ${a.fromCurrency}`,
      x,
      y,
    );
    y = addPara(doc, `Fee: ${fmtNum(a.fee)} ${a.fromCurrency}`, x, y);
    y = addPara(
      doc,
      `Total to pay: ${fmtNum(a.totalToPay)} ${a.fromCurrency}`,
      x,
      y,
      { bold: true, size: 10 },
    );
    y += GAP_SM * 0.5;
    if (a.receive != null) {
      y = addPara(
        doc,
        `Recipient receives: ${fmtNum(a.receive)} ${a.toCurrency}`,
        x,
        y,
      );
    } else {
      y = addPara(
        doc,
        `Recipient receives: — ${a.toCurrency}`,
        x,
        y,
      );
    }
    if (a.hasRate && a.rate != null) {
      y = addPara(
        doc,
        `Indicative rate: 1 ${a.fromCurrency} = ${fmtNum(a.rate)} ${a.toCurrency}`,
        x,
        y,
      );
    }
  } else {
    y = addPara(
      doc,
      "Amount details are not available on this receipt.",
      x,
      y,
    );
  }
  y += GAP + 2;

  needSpace(100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Recipient", x, y);
  y += GAP;
  y = addPara(
    doc,
    `Country: ${data.recipientCountry}`,
    x,
    y,
  );
  y = addPara(
    doc,
    `Name: ${data.beneficiary.displayName}`,
    x,
    y,
  );
  y = addPara(
    doc,
    `Delivery: ${data.beneficiary.deliveryLabel}`,
    x,
    y,
  );
  y = addPara(
    doc,
    `Payout: ${data.beneficiary.payoutDetails}`,
    x,
    y,
  );
  y += GAP + 2;

  if (data.compliance) {
    needSpace(90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Compliance", x, y);
    y += GAP;
    y = addPara(
      doc,
      `Source of income: ${data.compliance.source}`,
      x,
      y,
    );
    y = addPara(
      doc,
      `Transfer purpose: ${data.compliance.purpose}`,
      x,
      y,
    );
    y = addPara(
      doc,
      `Relationship: ${data.compliance.relationship}`,
      x,
      y,
    );
    y += GAP + 2;
  }

  needSpace(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("How to pay us", x, y);
  y += GAP;
  y = addPara(doc, data.payInLabel, x, y, { maxW: MAX_TEXT_W });
  if (data.payerPhone) {
    y = addPara(
      doc,
      `Payer phone (STK): ${data.payerPhone}`,
      x,
      y,
    );
  }
  y += GAP + 2;

  if (data.additionalNote?.trim()) {
    needSpace(50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Note", x, y);
    y += GAP;
    y = addPara(
      doc,
      data.additionalNote.trim(),
      x,
      y,
      { maxW: MAX_TEXT_W },
    );
  }

  const safe = data.referenceCode.replace(/[^\w.-]+/g, "_");
  doc.save(`transfer-receipt-${safe || "receipt"}.pdf`);
}
