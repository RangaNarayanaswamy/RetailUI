import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginComponent } from './pages/login.component';
import { PosComponent } from './pages/pos.component';
import { ReordersComponent } from './pages/reorders.component';
import { ReturnsComponent } from './pages/returns.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: PosComponent, canActivate: [authGuard] },
  { path: 'reorders', component: ReordersComponent, canActivate: [authGuard] },
  { path: 'returns', component: ReturnsComponent, canActivate: [authGuard] },
  { path: 'returns', component: ReturnsComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
