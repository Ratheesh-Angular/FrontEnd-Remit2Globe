/** Name suffix for first/last name when delivery channel is payout in person. */
export function payoutInPersonNameSuffix(couCode: string): string {
  const code = couCode.trim().toUpperCase();
  if (code === "ARE") return " (as per emirates id)";
  return " (as per passport/ national id)";
}

/** ID document field label for payout in person beneficiaries. */
export function payoutInPersonIdFieldLabel(couCode: string): string {
  const code = couCode.trim().toUpperCase();
  if (code === "ARE") return "Emirates Id Number";
  return "Passport/national Id number";
}

export function beneficiaryNameLabelSuffix(
  deliveryChannel: string,
  couCode: string,
): string {
  if (deliveryChannel === "BANK_TRANSFER") return " (as per bank account)";
  if (deliveryChannel === "PAYOUT_IN_PERSON") {
    return payoutInPersonNameSuffix(couCode);
  }
  return "";
}
