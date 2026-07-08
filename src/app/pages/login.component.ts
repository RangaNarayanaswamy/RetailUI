import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { StaffMember } from '../core/models';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
  <div class="login-box card">
    <h1>Priya's Boutique</h1>
    <p class="muted">Pick your name and enter your PIN</p>
    @if (failed()) { <div class="error">Wrong PIN — try again.</div> }
    <form class="stack" (ngSubmit)="submit()">
      <select [(ngModel)]="userId" name="userId" required>
        @for (s of staff(); track s.userId) {
          <option [value]="s.userId">{{ s.name }} — {{ s.role }}</option>
        }
      </select>
      <input [(ngModel)]="pin" name="pin" type="password" inputmode="numeric"
             maxlength="6" placeholder="PIN" required autofocus />
      <button type="submit" class="primary" [disabled]="busy()">Start shift</button>
    </form>
  </div>`,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  staff = signal<StaffMember[]>([]);
  failed = signal(false);
  busy = signal(false);
  userId = ''; pin = '';

  async ngOnInit() {
    const list = await this.auth.listStaff();
    this.staff.set(list);
    if (list.length) this.userId = list[0].userId;
  }

  async submit() {
    this.busy.set(true); this.failed.set(false);
    const ok = await this.auth.login(this.userId, this.pin);
    this.busy.set(false);
    if (ok) this.router.navigate(['/']);
    else { this.failed.set(true); this.pin = ''; }
  }
}
