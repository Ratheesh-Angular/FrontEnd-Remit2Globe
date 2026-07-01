/** Human-readable labels for Prisma DocumentType (KYC uploads). */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PASSPORT_FRONT: "Passport (front)",
  PASSPORT_BACK: "Passport (back)",
  WORK_PERMIT: "Work Permit / Foreign Card",
  WORK_PERMIT_FRONT: "Work Permit / Foreign Card",
  WORK_PERMIT_BACK: "Work Permit / Foreign Card",
  NATIONAL_ID_FRONT: "National ID (front)",
  NATIONAL_ID_BACK: "National ID (back)",
  OTHER_GOVT_ID: "Other government ID",
  CERTIFICATE_OF_INCORPORATION: "Certificate of incorporation",
  TRADING_LICENSE: "Trading license",
  CR12: "CR12",
  REGULATORY_LICENSE: "Regulatory license",
  PROOF_OF_ADDRESS: "Proof of address",
  DIRECTOR_ID: "Director ID",
  SHAREHOLDER_ID: "Shareholder ID",
  REPRESENTATIVE_ID: "Representative ID",
};

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}
