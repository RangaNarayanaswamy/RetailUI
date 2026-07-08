import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../core/api.service';

interface Row {
  variantId: string; sku: string; display: string;
  price: number; mrp: number; gstRate: number; onHand: number; qty: number;
}

@Component({
  selector: 'app-pos',
  imports: [FormsModule, DecimalPipe],
  template: `
  <h1>Billing</h1>
  <p class="muted">Scan a barcode or type a SKU, then Enter</p>
  @if (error()) { <div class="error">{{ error() }}</div> }
  @if (invoice()) { <div class="success">Sale complete — invoice {{ invoice() }}</div> }

  <div class="card">
    <div class="row">
      <input class="grow" [(ngModel)]="scan" (keydown.enter)="add()"
             placeholder="KUR-BLK-M or barcode" autofocus />
      <button (click)="add()">Add</button>
    </div>
  </div>

  @if (cart().length) {
    <div class="card">
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>GST</th>
          <th class="right">Amount</th><th></th></tr></thead>
        <tbody>
          @for (l of cart(); track l.variantId) {
            <tr>
              <td>{{ l.display }}<br>
                <span class="muted">{{ l.sku }} · MRP ₹{{ l.mrp }} · {{ l.onHand }} in stock</span></td>
              <td><input type="number" min="1" style="width:64px"
                         [ngModel]="l.qty" (ngModelChange)="setQty(l, $event)" /></td>
              <td>₹{{ l.price }}</td>
              <td>{{ l.gstRate }}%</td>
              <td class="right">₹{{ l.price * l.qty | number:'1.0-0' }}</td>
              <td class="right"><button (click)="remove(l)">✕</button></td>
            </tr>
          }
        </tbody>
      </table>
      <div class="row" style="margin-top:14px; justify-content:flex-end; gap:24px;">
        <span class="total-row">Total ₹{{ total() | number:'1.0-0' }}</span>
        <select [(ngModel)]="method">
          <option value="Cash">Cash</option><option value="Upi">UPI</option>
          <option value="Card">Card</option>
        </select>
        <button class="primary" [disabled]="busy()" (click)="checkout()">Complete sale</button>
      </div>
      <p class="muted right" style="margin:6px 0 0;">
        Prices are GST-inclusive; the invoice shows the tax breakup.</p>
    </div>
  }`,
})
export class PosComponent {
  private api = inject(ApiService);
  scan = ''; method = 'Cash';
  cart = signal<Row[]>([]);
  error = signal<string | null>(null);
  invoice = signal<string | null>(null);
  busy = signal(false);
  total = computed(() => this.cart().reduce((s, l) => s + l.price * l.qty, 0));

  async add() {
    this.error.set(null); this.invoice.set(null);
    const code = this.scan.trim();
    if (!code) return;
    try {
      const v = await this.api.lookup(code);
      const rows = [...this.cart()];
      const existing = rows.find(r => r.variantId === v.variantId);
      if (existing) existing.qty++;
      else rows.push({
        variantId: v.variantId, sku: v.skuCode,
        display: `${v.product} · ${v.colour ?? ''}${v.size ? ' · ' + v.size : ''}`,
        price: v.sellingPrice, mrp: v.mrp, gstRate: v.gstRate, onHand: v.onHand, qty: 1,
      });
      this.cart.set(rows);
      this.scan = '';
    } catch { this.error.set(`No item found for '${code}'`); }
  }

  setQty(l: Row, qty: number) {
    this.cart.set(this.cart().map(r => r === l ? { ...r, qty: Math.max(1, qty || 1) } : r));
  }
  remove(l: Row) { this.cart.set(this.cart().filter(r => r !== l)); }

  async checkout() {
    this.error.set(null); this.busy.set(true);
    try {
      const r = await this.api.checkout(
        this.cart().map(l => ({ variantId: l.variantId, quantity: l.qty })),
        this.method, this.total());
      this.invoice.set(r.invoiceNo);
      this.cart.set([]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.error?.title ?? 'Checkout failed — see API logs');
    } finally { this.busy.set(false); }
  }
}
