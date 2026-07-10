import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ApiService } from '../core/api.service';
import { SaleLookup } from '../core/models';

interface ReturnRow { saleLineId: string; qty: number; restock: boolean; }

@Component({
  selector: 'app-returns',
  imports: [FormsModule, DecimalPipe, DatePipe],
  template: `
  <h1>Returns</h1>
  <p class="muted">Find the original bill by its invoice number (on the receipt)</p>
  @if (error()) { <div class="error">{{ error() }}</div> }
  @if (done()) {
    <div class="success">Credit note {{ done()!.creditNoteNo }} —
      refund ₹{{ done()!.totalRefund | number:'1.0-2' }} ({{ done()!.refundMethod }})</div>
  }

  <div class="card">
    <div class="row">
      <input class="grow" [(ngModel)]="invoiceNo" (keydown.enter)="find()"
             placeholder="2627/00500" autofocus />
      <button (click)="find()">Find bill</button>
    </div>
  </div>

  @if (sale(); as s) {
    <div class="card">
      <p class="muted" style="margin-top:0">Invoice {{ s.invoiceNo }} ·
        {{ s.soldAt | date:'d MMM y, h:mm a' }} · total ₹{{ s.total | number:'1.0-0' }}</p>
      <table>
        <thead><tr><th>Item</th><th>Sold</th><th>Already returned</th>
          <th>Return qty</th><th>Resellable?</th><th class="right">Refund</th></tr></thead>
        <tbody>
          @for (l of s.lines; track l.saleLineId) {
            <tr>
              <td>{{ l.display }}<br><span class="muted">{{ l.skuCode }}</span></td>
              <td>{{ l.qtySold }}</td>
              <td>{{ l.qtyReturned }}</td>
              <td><input type="number" min="0" [max]="l.qtySold - l.qtyReturned"
                         style="width:64px" [ngModel]="row(l.saleLineId).qty"
                         (ngModelChange)="setQty(l.saleLineId, $event, l.qtySold - l.qtyReturned)" /></td>
              <td><input type="checkbox" [ngModel]="row(l.saleLineId).restock"
                         (ngModelChange)="setRestock(l.saleLineId, $event)" />
                  <span class="muted"> back to shelf</span></td>
              <td class="right">₹{{ row(l.saleLineId).qty * l.unitRefund | number:'1.0-2' }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="row" style="margin-top:14px; justify-content:flex-end; gap:16px;">
        <select [(ngModel)]="reason">
          <option value="Size">Wrong size</option>
          <option value="Defect">Defective</option>
          <option value="ChangedMind">Changed mind</option>
          <option value="Other">Other</option>
        </select>
        <select [(ngModel)]="refundMethod">
          <option value="Cash">Refund cash</option>
          <option value="Upi">Refund UPI</option>
          <option value="StoreCredit">Store credit</option>
        </select>
        <span class="total-row">₹{{ totalRefund() | number:'1.0-2' }}</span>
        <button class="primary" [disabled]="totalRefund() === 0 || busy()"
                (click)="submit()">Process return</button>
      </div>
      <p class="muted right" style="margin:6px 0 0;">
        Untick "back to shelf" for damaged items — they are written off, not restocked.</p>
    </div>
  }`,
})
export class ReturnsComponent {
  private api = inject(ApiService);
  invoiceNo = ''; reason = 'Size'; refundMethod = 'Cash';
  sale = signal<SaleLookup | null>(null);
  rows = signal<Map<string, ReturnRow>>(new Map());
  error = signal<string | null>(null);
  done = signal<{ creditNoteNo: string; totalRefund: number; refundMethod: string } | null>(null);
  busy = signal(false);

  totalRefund = computed(() => {
    const s = this.sale(); if (!s) return 0;
    return s.lines.reduce((sum, l) => sum + this.row(l.saleLineId).qty * l.unitRefund, 0);
  });

  row(id: string): ReturnRow {
    return this.rows().get(id) ?? { saleLineId: id, qty: 0, restock: true };
  }
  private upsert(id: string, patch: Partial<ReturnRow>) {
    const next = new Map(this.rows());
    next.set(id, { ...this.row(id), ...patch });
    this.rows.set(next);
  }
  setQty(id: string, qty: number, max: number) {
    this.upsert(id, { qty: Math.max(0, Math.min(max, qty || 0)) });
  }
  setRestock(id: string, restock: boolean) { this.upsert(id, { restock }); }

  async find() {
    this.error.set(null); this.done.set(null); this.sale.set(null);
    this.rows.set(new Map());
    const inv = this.invoiceNo.trim();
    if (!inv) return;
    try { this.sale.set(await this.api.findSale(inv)); }
    catch (e: any) { this.error.set(e?.error?.message ?? `No bill found for '${inv}'`); }
  }

  async submit() {
    this.error.set(null); this.busy.set(true);
    try {
      const lines = [...this.rows().values()].filter(r => r.qty > 0)
        .map(r => ({ saleLineId: r.saleLineId, quantity: r.qty, restock: r.restock }));
      const result = await this.api.submitReturn(
        this.sale()!.saleId, lines, this.reason, this.refundMethod);
      this.done.set(result);
      this.sale.set(null); this.invoiceNo = '';
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Return failed');
    } finally { this.busy.set(false); }
  }
}
