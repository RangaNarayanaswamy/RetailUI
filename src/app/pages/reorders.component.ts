import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { ReorderSuggestion } from '../core/models';

@Component({
  selector: 'app-reorders',
  imports: [],
  template: `
  <h1>Reorder queue</h1>
  <p class="muted">14-day sell-through · sold well → reorder small · didn't sell → don't</p>
  @if (error()) { <div class="error">{{ error() }}</div> }
  @if (created() !== null) { <div class="success">{{ created() }} draft purchase order(s) created.</div> }

  @if (!queue()) { <div class="card"><p class="muted">Loading…</p></div> }
  @else {
    <div class="card">
      <table>
        <thead><tr><th style="width:36px"></th><th>Item</th><th>On hand</th>
          <th>Sold 14d</th><th>Suggestion</th><th>Why</th></tr></thead>
        <tbody>
          @for (s of queue(); track s.variantId) {
            <tr>
              <td>
                @if (s.suggestedQty > 0) {
                  <input type="checkbox" [checked]="accepted().has(s.variantId)"
                         (change)="toggle(s.variantId, $event)" />
                }
              </td>
              <td>{{ s.display }}<br><span class="muted">{{ s.sku }}</span></td>
              <td>{{ s.onHand }}</td>
              <td>{{ s.weeklySold }}</td>
              <td>
                @if (s.suggestedQty > 0) { <span class="pill ok">Reorder {{ s.suggestedQty }}</span> }
                @else { <span class="pill bad">Don't reorder</span> }
              </td>
              <td class="muted">{{ s.rationale }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="row" style="margin-top:14px; justify-content:flex-end; gap:16px;">
        <span class="muted">{{ accepted().size }} accepted</span>
        <button class="primary" [disabled]="!accepted().size || busy()"
                (click)="createDrafts()">Create draft POs</button>
      </div>
    </div>
  }`,
})
export class ReordersComponent {
  private api = inject(ApiService);
  queue = signal<ReorderSuggestion[] | null>(null);
  accepted = signal(new Set<string>());
  error = signal<string | null>(null);
  created = signal<number | null>(null);
  busy = signal(false);

  async ngOnInit() { await this.load(); }

  private async load() {
    const q = await this.api.reorderQueue();
    this.queue.set(q);
    this.accepted.set(new Set(q.filter(s => s.suggestedQty > 0).map(s => s.variantId)));
  }

  toggle(id: string, ev: Event) {
    const next = new Set(this.accepted());
    (ev.target as HTMLInputElement).checked ? next.add(id) : next.delete(id);
    this.accepted.set(next);
  }

  async createDrafts() {
    this.error.set(null); this.created.set(null); this.busy.set(true);
    try {
      const r = await this.api.createDraftPos([...this.accepted()]);
      this.created.set(r.created);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Could not create draft POs');
    } finally { this.busy.set(false); }
  }
}
