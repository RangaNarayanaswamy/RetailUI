import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
  <div class="shell">
    @if (auth.isLoggedIn()) {
      <nav class="topbar">
        <span class="brand">Priya's Boutique</span>
        <a routerLink="/">Billing</a>
        @if (auth.role() !== 'Cashier') {
          <a routerLink="/returns">Returns</a>
          <a routerLink="/inventory">Inventory</a>
          <a routerLink="/reorders">Reorder queue</a>
        }
        <span class="spacer"></span>
        <span class="who">{{ auth.userName() }} · {{ auth.role() }}</span>
        <button class="link" (click)="logout()">Switch user</button>
      </nav>
    }
    <main><router-outlet /></main>
  </div>`,
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);
  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
