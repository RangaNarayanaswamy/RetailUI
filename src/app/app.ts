import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
  @if (auth.isLoggedIn()) {
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="logo">P</span> Priya's Boutique</div>
        <nav>
          <a routerLink="/" [routerLinkActiveOptions]="{exact:true}"
             routerLinkActive="active">🧾 Billing</a>
          @if (auth.role() !== 'Cashier') {
            <a routerLink="/inventory" routerLinkActive="active">📦 Inventory</a>
            <a routerLink="/returns" routerLinkActive="active">↩️ Returns</a>
            <a routerLink="/reorders" routerLinkActive="active">🔁 Reorder queue</a>
          }
        </nav>
        <div class="foot muted">v0.2 · single store</div>
      </aside>
      <div class="content">
        <header class="topbar">
          <span class="page-title">Store management</span>
          <span class="spacer"></span>
          <span class="who">
            <span class="avatar">{{ auth.userName().charAt(0) }}</span>
            {{ auth.userName() }} <span class="muted">· {{ auth.role() }}</span>
          </span>
          <button class="link" (click)="logout()">Switch user</button>
        </header>
        <main><router-outlet /></main>
      </div>
    </div>
  } @else {
    <main><router-outlet /></main>
  }`,
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);
  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
