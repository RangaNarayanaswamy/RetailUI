import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule, ModuleRegistry, themeQuartz,
  type ColDef, type GridApi, type GridReadyEvent, type IDatasource,
  type CellValueChangedEvent,
} from 'ag-grid-community';
import { ApiService } from '../core/api.service';
import { VariantGridRow } from '../core/models';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-inventory',
  imports: [AgGridAngular, FormsModule],
  template: `
  <h1>Inventory</h1>
  <p class="muted">Scroll loads more rows · double-click price / reorder cells to edit ·
    changes save immediately</p>
  @if (toast()) { <div class="{{ toastKind() }}">{{ toast() }}</div> }

  <div class="card">
    <div class="row" style="margin-bottom:12px;">
      <input class="grow" placeholder="Search SKU, product, colour, category…"
             [(ngModel)]="search" (keydown.enter)="applySearch()" />
      <button (click)="applySearch()">Search</button>
    </div>
    <ag-grid-angular style="width:100%; height:560px;"
        [theme]="theme"
        [columnDefs]="cols"
        [defaultColDef]="defaults"
        rowModelType="infinite"
        [cacheBlockSize]="50"
        [getRowId]="rowId"
        (gridReady)="onReady($event)"
        (cellValueChanged)="onEdit($event)" />
  </div>

  @if (adjusting(); as v) {
    <div class="overlay" (click)="adjusting.set(null)">
      <div class="modal card" (click)="$event.stopPropagation()">
        <h2>Adjust stock — {{ v.skuCode }}</h2>
        <p class="muted" style="margin-top:0">{{ v.product }} · {{ v.colour }}
          {{ v.size ?? '' }} · currently {{ v.onHand }} on hand</p>
        <div class="stack">
          <label>Quantity change (− removes, + adds)
            <input type="number" [(ngModel)]="adjDelta" style="width:100%" /></label>
          <label>Reason
            <select [(ngModel)]="adjReason" style="width:100%">
              <option value="Damage">Damage</option>
              <option value="Theft">Theft</option>
              <option value="Correction">Counting correction</option>
              <option value="Expiry">Expired (write-off)</option>
              <option value="Opening">Opening stock</option>
            </select></label>
          <label>Notes (optional)
            <input [(ngModel)]="adjNotes" style="width:100%" /></label>
          <div class="row" style="justify-content:flex-end;">
            <button (click)="adjusting.set(null)">Cancel</button>
            <button class="primary" [disabled]="adjDelta === 0 || busy()"
                    (click)="submitAdjust()">Apply</button>
          </div>
        </div>
      </div>
    </div>
  }`,
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(20,20,18,.45);
               display: flex; align-items: center; justify-content: center; z-index: 50; }
    .modal { width: 420px; max-width: 92vw; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 13px;
            color: #73726c; }
  `],
})
export class InventoryComponent {
  private api = inject(ApiService);
  theme = themeQuartz;
  search = '';
  toast = signal<string | null>(null);
  toastKind = signal<'success' | 'error'>('success');
  adjusting = signal<VariantGridRow | null>(null);
  adjDelta = 0; adjReason = 'Damage'; adjNotes = '';
  busy = signal(false);
  private grid?: GridApi;

  rowId = (p: { data: VariantGridRow }) => p.data.variantId;

  defaults: ColDef = { sortable: false, resizable: true, suppressMovable: true };

  cols: ColDef<VariantGridRow>[] = [
    { field: 'skuCode', headerName: 'SKU', width: 130, sortable: true, pinned: 'left' },
    { field: 'product', headerName: 'Product', flex: 1, sortable: true },
    { field: 'category', headerName: 'Category', width: 120, sortable: true },
    { field: 'colour', headerName: 'Colour', width: 110 },
    { field: 'size', headerName: 'Size', width: 80 },
    { field: 'mrp', headerName: 'MRP ₹', width: 100, type: 'rightAligned',
      editable: true, cellClass: 'editable' },
    { field: 'sellingPrice', headerName: 'Price ₹', width: 100, type: 'rightAligned',
      sortable: true, editable: true, cellClass: 'editable' },
    { field: 'onHand', headerName: 'On hand', width: 100, type: 'rightAligned', sortable: true,
      cellStyle: p => (p.data && p.data.onHand <= p.data.reorderAt)
        ? { color: '#9c2f22', fontWeight: '600' } : null },
    { field: 'reorderAt', headerName: 'Reorder at', width: 110, type: 'rightAligned',
      editable: true, cellClass: 'editable' },
    { field: 'reorderQty', headerName: 'Reorder qty', width: 115, type: 'rightAligned',
      editable: true, cellClass: 'editable' },
    { field: 'stockValue', headerName: 'Stock value ₹', width: 130, type: 'rightAligned',
      sortable: true, valueFormatter: p => p.value == null ? '' :
        Math.round(p.value).toLocaleString('en-IN') },
    { headerName: '', width: 90, pinned: 'right',
      cellRenderer: () => `<button class="grid-btn">Adjust</button>`,
      onCellClicked: p => { if (p.data) this.openAdjust(p.data); } },
  ];

  onReady(e: GridReadyEvent) {
    this.grid = e.api;
    e.api.setGridOption('datasource', this.datasource());
  }

  private datasource(): IDatasource {
    return {
      getRows: async params => {
        try {
          const sort = params.sortModel[0] ?? null;
          const page = await this.api.variantsPage(
            params.startRow, params.endRow,
            sort?.colId ?? null, sort?.sort ?? null, this.search.trim());
          params.successCallback(page.rows, page.total);
        } catch { params.failCallback(); this.flash('Could not load inventory', 'error'); }
      },
    };
  }

  applySearch() { this.grid?.setGridOption('datasource', this.datasource()); }

  async onEdit(e: CellValueChangedEvent<VariantGridRow>) {
    const d = e.data; const field = e.colDef.field!;
    const num = Number(e.newValue);
    const revert = () => { (d as any)[field] = e.oldValue; e.api.refreshCells({ rowNodes: [e.node!] }); };
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
    } catch (err: any) {
      revert();
      this.flash(err?.error?.message ?? 'Save failed', 'error');
    }
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
      this.adjusting.set(null);
      this.grid?.refreshInfiniteCache();
      this.flash(`Stock adjusted for ${v.skuCode}`, 'success');
    } catch (err: any) {
      this.flash(err?.error?.message ?? 'Adjustment failed', 'error');
    } finally { this.busy.set(false); }
  }

  private flash(msg: string, kind: 'success' | 'error') {
    this.toastKind.set(kind); this.toast.set(msg);
    setTimeout(() => this.toast.set(null), 3500);
  }
}
