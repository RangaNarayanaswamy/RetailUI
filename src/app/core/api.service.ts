import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CartLine, CheckoutRequest, CheckoutResult, ReorderSuggestion, ReturnResult, SaleForReturn, VariantLookup } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = environment.apiUrl;

  lookup(code: string) {
    return firstValueFrom(this.http.get<VariantLookup>(
      `${this.base}/api/pos/lookup/${encodeURIComponent(code)}`));
  }

  checkout(lines: CartLine[], method: string, total: number) {
    const body: CheckoutRequest = {
      storeId: this.auth.storeId(), cashierId: this.auth.userId(), cashSessionId: null,
      lines, customerId: null, couponCode: null,
      payments: [{ method: method, amount: total, reference: null }],
    };
    return firstValueFrom(this.http.post<CheckoutResult>(`${this.base}/api/pos/checkout`, body));
  }

  findSale(invoiceNo: string) {
    return firstValueFrom(this.http.get<SaleLookup>(
      `${this.base}/api/pos/sales`, { params: { invoice: invoiceNo } }));
  }

  submitReturn(saleId: string, lines: { saleLineId: string; quantity: number; restock: boolean }[],
               reason: string, refundMethod: string) {
    return firstValueFrom(this.http.post<ReturnResult>(`${this.base}/api/pos/returns`,
      { saleId, lines, reason, refundMethod }));
  }

  reorderQueue() {
    return firstValueFrom(this.http.get<ReorderSuggestion[]>(`${this.base}/api/reorders`));
  }

  saleForReturn(invoiceNo: string) {
    return firstValueFrom(this.http.get<SaleForReturn>(
      `${this.base}/api/returns/sale/${encodeURIComponent(invoiceNo)}`));
  }

  processReturn(saleId: string,
    lines: { saleLineId: string; quantity: number; restock: boolean }[],
    reason: string, refundMethod: string) {
    return firstValueFrom(this.http.post<ReturnResult>(`${this.base}/api/returns`,
      { saleId, lines, reason, refundMethod }));
  }

  createDraftPos(variantIds: string[]) {
    return firstValueFrom(this.http.post<{ created: number; poIds: string[] }>(
      `${this.base}/api/reorders/draft-pos`, { variantIds }));
  }
}
