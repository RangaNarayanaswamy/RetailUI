import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { StaffMember } from './models';

interface JwtPayload { [k: string]: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly key = 'retail.jwt';

  token = signal<string | null>(sessionStorage.getItem(this.key));
  isLoggedIn = computed(() => !!this.token());

  private payload = computed<JwtPayload | null>(() => {
    const t = this.token();
    if (!t) return null;
    try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
  });

  userName = computed(() =>
    this.payload()?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? '');
  role = computed(() =>
    this.payload()?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? '');
  userId = computed(() =>
    this.payload()?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? '');
  storeId = computed(() => this.payload()?.['store'] ?? '');

  listStaff() {
    return firstValueFrom(this.http.get<StaffMember[]>(`${environment.apiUrl}/api/auth/staff`));
  }

  async login(userId: string, pin: string): Promise<boolean> {
    try {
      const r = await firstValueFrom(this.http.post<{ token: string }>(
        `${environment.apiUrl}/api/auth/pin-login`, { userId, pin }));
      sessionStorage.setItem(this.key, r.token);
      this.token.set(r.token);
      return true;
    } catch { return false; }
  }

  logout() { sessionStorage.removeItem(this.key); this.token.set(null); }
}
