export interface StaffMember { userId: string; name: string; role: string; }

export interface VariantLookup {
  variantId: string; skuCode: string; colour: string | null; size: string | null;
  sellingPrice: number; mrp: number; onHand: number; product: string; gstRate: number;
}

export interface CartLine { variantId: string; quantity: number; overridePrice?: number | null; }

export interface CheckoutRequest {
  storeId: string; cashierId: string; cashSessionId: string | null;
  lines: CartLine[]; customerId: string | null; couponCode: string | null;
  payments: { method: string; amount: number; reference: string | null }[];
}

export interface CheckoutResult { saleId: string; invoiceNo: string; total: number; loyaltyEarned: number; }

export interface ReorderSuggestion {
  variantId: string; sku: string; display: string;
  onHand: number; weeklySold: number; suggestedQty: number; rationale: string;
}

export interface SaleForReturn {
  saleId: string; invoiceNo: string; soldAt: string; total: number;
  customerPhone: string | null;
  lines: SaleLineForReturn[];
}
export interface SaleLineForReturn {
  saleLineId: string; display: string; sku: string;
  sold: number; alreadyReturned: number; unitPrice: number; lineTotal: number;
}
export interface ReturnResult { creditNoteNo: string; totalRefund: number; refundMethod: string; }

export interface SaleLookupLine {
  saleLineId: string; display: string; skuCode: string;
  qtySold: number; qtyReturned: number; unitRefund: number;
}
export interface SaleLookup {
  saleId: string; invoiceNo: string; soldAt: string; total: number;
  lines: SaleLookupLine[];
}
export interface ReturnResult { creditNoteNo: string; totalRefund: number; refundMethod: string; }
