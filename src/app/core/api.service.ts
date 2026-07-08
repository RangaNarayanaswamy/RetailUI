import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CartLine, CheckoutRequest, CheckoutResult, ReorderSuggestion, VariantLookup } from './models';

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
      payments: [{ item1: method, item2: total, item3: null }],
    };
    return firstValueFrom(this.http.post<CheckoutResult>(`${this.base}/api/pos/checkout`, body));
  }

  reorderQueue() {
    return firstValueFrom(this.http.get<ReorderSuggestion[]>(`${this.base}/api/reorders`));
  }

  createDraftPos(variantIds: string[]) {
    return firstValueFrom(this.http.post<{ created: number; poIds: string[] }>(
      `${this.base}/api/reorders/draft-pos`, { variantIds }));
  }
}
