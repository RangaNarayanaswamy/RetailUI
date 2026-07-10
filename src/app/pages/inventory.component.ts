import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule, ModuleRegistry, themeQuartz,
  type ColDef, type GridApi, type GridReadyEvent, type IDatasource,
  type CellValueChangedEvent,
} from 'ag-grid-community';
import { ApiService } from '../core/api.service';
import { CategoryOption, InventoryStats, TxnRow, VariantGridRow } from '../core/models';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-inventory',
  imports: [AgGridAngular, FormsModule, DecimalPipe, DatePipe],
  template: `
  <div class="row" style="justify-content:space-between; margin-bottom:14px;">
    <div>
      <h1>Inventory</h1>
      <p class="muted" style="margin:0">Double-click price or reorder cells to edit ·
        scroll loads more · click a row for details</p>
    </div>
  </div>

  @if (stats(); as s) {
    <div class="kpis">
      <div class="kpi"><div class="value">{{ s.skus }}</div>
        <div class="label">Active SKUs</div></div>
      <div class="kpi"><div class="value">₹{{ s.stockValue | number:'1.0-0' }}</div>
        <div class="label">Stock value (at cost)</div></div>
      <div class="kpi warn"><div class="value">{{ s.lowStock }}</div>
        <div class="label">Low stock (≤ reorder point)</div></div>
      <div class="kpi bad"><div class="value">{{ s.outOfStock }}</div>
        <div class="label">Out of stock</div></div>
    </div>
  }

  @if (toast()) { <div class="{{ toastKind() }}">{{ toast() }}</div> }

  <div class="card">
    <div class="row" style="margin-bottom:12px;">
      <input class="grow" placeholder="Search SKU, product, colour…"
             [(ngModel)]="search" (keydown.enter)="reload()" />
      <select [(ngModel)]="categoryFilter" (ngModelChange)="reload()">
        <option value="">All categories</option>
        @for (c of cats(); track c.categoryId) {
          <option [value]="c.name">{{ c.name }}</option>
        }
      </select>
      <select [(ngModel)]="stockFilter" (ngModelChange)="reload()">
        <option value="">All stock levels</option>
        <option value="low">Low stock</option>
        <option value="out">Out of stock</option>
      </select>
      <button (click)="reload()">Apply</button>
    </div>
    <ag-grid-angular style="width:100%; height:520px;"
        [theme]="theme" [columnDefs]="cols" [defaultColDef]="defaults"
        rowModelType="infinite" [cacheBlockSize]="50" [getRowId]="rowId"
        (gridReady)="onReady($event)" (cellValueChanged)="onEdit($event)"
        (rowClicked)="onRowClick($event)" />
  </div>

  <!-- ---------- detail drawer ---------- -->
  @if (detail(); as v) {
    <div class="drawer-overlay" (click)="detail.set(null)"></div>
    <div class="drawer">
      <button class="close" (click)="detail.set(null)">✕</button>
      <h2>{{ v.product }}</h2>
      <p class="muted" style="margin-top:0">{{ v.skuCode }} · {{ v.colour }}
        {{ v.size ?? '' }}
        @if (v.onHand === 0) { <span class="pill bad">Out of stock</span> }
        @else if (v.onHand <= v.reorderAt) { <span class="pill warn">Low stock</span> }
        @else { <span class="pill ok">In stock</span> }
      </p>
      <div class="tabs">
        <button [class.active]="tab() === 'overview'"
                (click)="tab.set('overview')">Overview</button>
        <button [class.active]="tab() === 'transactions'"
                (click)="tab.set('transactions')">Transactions</button>
      </div>

      @if (tab() === 'overview') {
        <div class="kv">
          <span class="k">Category</span><span>{{ v.category }}</span>
          <span class="k">MRP</span><span>₹{{ v.mrp | number:'1.0-2' }}</span>
          <span class="k">Selling price</span><span>₹{{ v.sellingPrice | number:'1.0-2' }}</span>
          <span class="k">Cost price</span><span>₹{{ v.costPrice | number:'1.0-2' }}</span>
          <span class="k">On hand</span><span>{{ v.onHand }}</span>
          <span class="k">Reorder point</span><span>{{ v.reorderAt }}</span>
          <span class="k">Reorder quantity</span><span>{{ v.reorderQty }}</span>
          <span class="k">Stock value</span><span>₹{{ v.stockValue | number:'1.0-0' }}</span>
        </div>
        <div class="row" style="margin-top:18px;">
          <button class="primary" (click)="openAdjust(v)">Adjust stock</button>
          <button (click)="rebuild(v)">Recount from ledger</button>
        </div>
      } @else {
        @if (!txns()) { <p class="muted">Loading…</p> }
        @else if (txns()!.length === 0) { <p class="muted">No movements yet.</p> }
        @else {
          <table>
            <thead><tr><th>When</th><th>Type</th><th class="right">Qty</th><th>Detail</th></tr></thead>
            <tbody>
              @for (t of txns(); track $index) {
                <tr>
                  <td>{{ t.at | date:'d MMM, h:mm a' }}</td>
                  <td>{{ t.kind }}</td>
                  <td class="right" [style.color]="t.qty < 0 ? '#b03021' : '#1d7a3d'">
                    {{ t.qty > 0 ? '+' : '' }}{{ t.qty }}</td>
                  <td class="muted">{{ t.detail }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </div>
  }

  <!-- ---------- adjust modal ---------- -->
  @if (adjusting(); as v) {
    <div class="overlay" (click)="adjusting.set(null)">
      <div class="modal card" (click)="$event.stopPropagation()">
        <h2>Adjust stock — {{ v.skuCode }}</h2>
        <p class="muted" style="margin-top:0">{{ v.product }} · currently {{ v.onHand }} on hand</p>
        <div class="stack">
          <label class="stack" style="gap:4px;">Quantity change (− removes, + adds)
            <input type="number" [(ngModel)]="adjDelta" /></label>
          <label class="stack" style="gap:4px;">Reason
            <select [(ngModel)]="adjReason">
              <option value="Damage">Damage</option>
              <option value="Theft">Theft</option>
              <option value="Correction">Counting correction</option>
              <option value="Expiry">Expired (write-off)</option>
              <option value="Opening">Opening stock</option>
            </select></label>
          <label class="stack" style="gap:4px;">Notes (optional)
            <input [(ngModel)]="adjNotes" /></label>
          <div class="row" style="justify-content:flex-end;">
            <button (click)="adjusting.set(null)">Cancel</button>
            <button class="primary" [disabled]="adjDelta === 0 || busy()"
                    (click)="submitAdjust()">Apply</button>
          </div>
        </div>
      </div>
    </div>
  }`,
})
export class InventoryComponent {
  private api = inject(ApiService);
  theme = themeQuartz;

  search = ''; categoryFilter = ''; stockFilter = '';
  stats = signal<InventoryStats | null>(null);
  cats = signal<CategoryOption[]>([]);
  toast = signal<string | null>(null);
  toastKind = signal<'success' | 'error'>('success');

  detail = signal<VariantGridRow | null>(null);
  tab = signal<'overview' | 'transactions'>('overview');
  txns = signal<TxnRow[] | null>(null);

  adjusting = signal<VariantGridRow | null>(null);
  adjDelta = 0; adjReason = 'Damage'; adjNotes = '';
  busy = signal(false);
  private grid?: GridApi;
  private suppressRowClick = false;

  rowId = (p: { data: VariantGridRow }) => p.data.variantId;
  defaults: ColDef = { sortable: false, resizable: true, suppressMovable: true };

  cols: ColDef<VariantGridRow>[] = [
    { field: 'skuCode', headerName: 'SKU', width: 130, sortable: true, pinned: 'left' },
    { field: 'product', headerName: 'Product', flex: 1, sortable: true },
    { field: 'category', headerName: 'Category', width: 115, sortable: true },
    { field: 'colour', headerName: 'Colour', width: 105 },
    { field: 'size', headerName: 'Size', width: 75 },
    { field: 'mrp', headerName: 'MRP ₹', width: 95, type: 'rightAligned',
      editable: true, cellClass: 'editable' },
    { field: 'sellingPrice', headerName: 'Price ₹', width: 95, type: 'rightAligned',
      sortable: true, editable: true, cellClass: 'editable' },
    { headerName: 'Status', width: 115,
      cellRenderer: (p: { data?: VariantGridRow }) => {
        const d = p.data; if (!d) return '';
        if (d.onHand === 0) return `<span class="pill bad">Out</span>`;
        if (d.onHand <= d.reorderAt) return `<span class="pill warn">Low</span>`;
        return `<span class="pill ok">In stock</span>`;
      } },
    { field: 'onHand', headerName: 'On hand', width: 95, type: 'rightAligned', sortable: true },
    { field: 'reorderAt', headerName: 'Reorder at', width: 105, type: 'rightAligned',
      editable: true, cellClass: 'editable' },
    { field: 'reorderQty', headerName: 'Reorder qty', width: 110, type: 'rightAligned',
      editable: true, cellClass: 'editable' },
    { field: 'stockValue', headerName: 'Value ₹', width: 110, type: 'rightAligned',
      sortable: true, valueFormatter: p => p.value == null ? '' :
        Math.round(p.value).toLocaleString('en-IN') },
    { headerName: '', width: 88, pinned: 'right',
      cellRenderer: () => `<button class="grid-btn">Adjust</button>`,
      onCellClicked: p => { this.suppressRowClick = true;
                            if (p.data) this.openAdjust(p.data); } },
  ];

  async ngOnInit() {
    this.stats.set(await this.api.inventoryStats());
    this.cats.set(await this.api.categories());
  }

  onReady(e: GridReadyEvent) {
    this.grid = e.api;
    e.api.setGridOption('datasource', this.datasource());
  }

  private datasource(): IDatasource {
    return {
      getRows: async params => {
        try {
          const sort = params.sortModel[0] ?? null;
          const terms = [this.search.trim(), this.categoryFilter].filter(Boolean).join(' ');
          const page = await this.api.variantsPage(
            params.startRow, params.endRow,
            sort?.colId ?? null, sort?.sort ?? null, terms);
          let rows = page.rows;
          if (this.stockFilter === 'low')
            rows = rows.filter(r => r.onHand > 0 && r.onHand <= r.reorderAt);
          if (this.stockFilter === 'out') rows = rows.filter(r => r.onHand === 0);
          params.successCallback(rows,
            this.stockFilter ? params.startRow + rows.length : page.total);
        } catch { params.failCallback(); this.flash('Could not load inventory', 'error'); }
      },
    };
  }

  reload() { this.grid?.setGridOption('datasource', this.datasource()); }

  onRowClick(e: { data?: VariantGridRow }) {
    if (this.suppressRowClick) { this.suppressRowClick = false; return; }
    if (!e.data) return;
    this.detail.set(e.data); this.tab.set('overview'); this.txns.set(null);
    this.api.variantTransactions(e.data.variantId)
      .then(t => this.txns.set(t)).catch(() => this.txns.set([]));
  }

  async onEdit(e: CellValueChangedEvent<VariantGridRow>) {
    const d = e.data; const field = e.colDef.field!;
    const num = Number(e.newValue);
    const revert = () => { (d as any)[field] = e.oldValue;
                           e.api.refreshCells({ rowNodes: [e.node!] }); };
    if (Number.isNaN(num)) { revert(); return; }
    try {
      if (field === 'sellingPrice' || field === 'mrp') {
        await this.api.updatePrice(d.variantId,
          field === 'sellingPrice' ? num : d.sellingPrice,
          field === 'mrp' ? num : d.mrp);
        this.flash(`Price saved for ${d.skuCode} (change logged)`, 'success');
      } else if (field === 'reorderAt' || field === 'reorderQty') {
        await this.api.updateReorder(d.variantId, d.reorderAt, d.reorderQty);
        this.flash(`Reorder settings saved for ${d.skuCode}`, 'success');
      }
    } catch (err: any) { revert(); this.flash(err?.error?.message ?? 'Save failed', 'error'); }
  }

  openAdjust(v: VariantGridRow) {
    this.adjDelta = 0; this.adjReason = 'Damage'; this.adjNotes = '';
    this.adjusting.set(v);
  }

  async submitAdjust() {
    const v = this.adjusting()!; this.busy.set(true);
    try {
      await this.api.adjustStock(v.variantId, this.adjDelta, this.adjReason,
        this.adjNotes.trim() || null);
      this.adjusting.set(null); this.detail.set(null);
      this.grid?.refreshInfiniteCache();
      this.stats.set(await this.api.inventoryStats());
      this.flash(`Stock adjusted for ${v.skuCode}`, 'success');
    } catch (err: any) { this.flash(err?.error?.message ?? 'Adjustment failed', 'error'); }
    finally { this.busy.set(false); }
  }

  async rebuild(v: VariantGridRow) {
    try {
      const r = await this.api.rebuildOnHand(v.variantId);
      this.grid?.refreshInfiniteCache();
      this.flash(`${v.skuCode} recounted from ledger: ${r.onHand} on hand`, 'success');
      this.detail.set(null);
    } catch { this.flash('Recount failed', 'error'); }
  }

  private flash(msg: string, kind: 'success' | 'error') {
    this.toastKind.set(kind); this.toast.set(msg);
    setTimeout(() => this.toast.set(null), 3500);
  }
}
