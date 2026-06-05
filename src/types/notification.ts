export type NotificationType =
  | "REGISTRATION_SUCCESS"
  | "KYC_SUBMITTED"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "TRANSACTION_CREATED"
  | "PAYMENT_INSTRUCTIONS"
  | "PAYMENT_RECEIVED"
  | "TRANSACTION_COMPLETED";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  emailSent: boolean;
  createdAt: string;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
