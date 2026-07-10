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

export interface VariantGridRow {
  variantId: string; skuCode: string; product: string; category: string;
  colour: string | null; size: string | null;
  mrp: number; sellingPrice: number; costPrice: number;
  onHand: number; reorderAt: number; reorderQty: number; stockValue: number;
}
export interface PagedVariants { rows: VariantGridRow[]; total: number; }

export interface InventoryStats {
  skus: number; stockValue: number; lowStock: number; outOfStock: number;
}
export interface CategoryOption { categoryId: string; name: string; }
export interface TxnRow { at: string; kind: string; qty: number; detail: string; }
