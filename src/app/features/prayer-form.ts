import { Component, DestroyRef, ElementRef, Injectable, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Effects } from '../core/effects';

export interface PrayerCopy {
  fields: Record<'name' | 'place' | 'prayer-type' | 'prayer-request' | 'email', { label: string; placeholder: string }>;
  options: { value: string; label: string }[];
  whatsappLabel: string;
  emailLabel: string;
  whatsappToast: string;
  successToast: string;
  errorToast: string;
  whatsappTemplate: string;
  accessKey: string;
}

@Injectable()
export class PrayerState {
  readonly method = signal<'whatsapp' | 'email'>('whatsapp');
  readonly toasts = signal<{ id: number; message: string; type: 'success' | 'error'; hide: boolean }[]>([]);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private nextId = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => { for (const timer of this.timers) clearTimeout(timer); });
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const id = this.nextId++;
    this.toasts.update(toasts => [...toasts, { id, message, type, hide: false }]);
    this.schedule(() => this.toasts.update(toasts => toasts.map(toast => toast.id === id ? { ...toast, hide: true } : toast)), 3000);
    this.schedule(() => this.toasts.update(toasts => toasts.filter(toast => toast.id !== id)), 3300);
  }

  private schedule(callback: () => void, delay: number): void {
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, delay);
    this.timers.add(timer);
  }
}

@Component({
  selector: 'haf-prayer-toast',
  template: `<div class="toast-container" id="toastContainer" aria-live="polite">
    @for (toast of state.toasts(); track toast.id) {
      <div class="toast" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'" [class.hide]="toast.hide">
        <i [class]="toast.type === 'success' ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
        <span>{{ toast.message }}</span>
      </div>
    }
  </div>`,
  // Host style instead of an identical inline `styles` in both components of this file:
  // duplicate inline styles in one file make `ng build` leak an esbuild context and never exit.
  host: { style: 'display: contents' }
})
export class PrayerToast { readonly state = inject(PrayerState); }

@Component({
  selector: 'haf-prayer-form',
  imports: [FormsModule],
  preserveWhitespaces: true,
  template: `<form id="prayerForm" #form="ngForm" ngNativeValidate (ngSubmit)="submit(form)">
    <div class="form-group">
      <label for="name">{{ copy().fields.name.label }}</label>
      <input type="text" id="name" name="name" required [placeholder]="copy().fields.name.placeholder" [(ngModel)]="model.name">
    </div>
    @if (state.method() === 'email') {
      <div id="email-field" class="form-group">
        <label for="email">{{ copy().fields.email.label }}</label>
        <input type="email" id="email" name="email" required email [placeholder]="copy().fields.email.placeholder" [(ngModel)]="model.email">
      </div>
    }
    <div class="form-group">
      <label for="place">{{ copy().fields.place.label }}</label>
      <input type="text" id="place" name="location" [placeholder]="copy().fields.place.placeholder" [(ngModel)]="model.location">
    </div>
    <div class="form-group">
      <label for="prayer-type">{{ copy().fields['prayer-type'].label }}</label>
      <select id="prayer-type" name="prayer_type" required [(ngModel)]="model.prayer_type">
        @for (option of copy().options; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
      </select>
    </div>
    <div class="form-group">
      <label for="prayer-request">{{ copy().fields['prayer-request'].label }}</label>
      <textarea id="prayer-request" name="message" rows="6" required [placeholder]="copy().fields['prayer-request'].placeholder" [(ngModel)]="model.message"></textarea>
    </div>
    <button #submitButton type="submit" id="submitButton" [disabled]="submitting()" [attr.aria-busy]="submitting()">
      {{ state.method() === 'whatsapp' ? copy().whatsappLabel : copy().emailLabel }}
      <i [class]="state.method() === 'whatsapp' ? 'fab fa-whatsapp' : 'fas fa-paper-plane'"></i>
    </button>
  </form>`,
  host: { style: 'display: contents' }
})
export class PrayerForm {
  readonly copy = input.required<PrayerCopy>();
  readonly state = inject(PrayerState);
  readonly submitting = signal(false);
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly effects = inject(Effects);
  private readonly submitButton = viewChild<ElementRef<HTMLButtonElement>>('submitButton');
  model = { name: '', email: '', location: '', prayer_type: '', message: '' };

  async submit(form: NgForm): Promise<void> {
    if (form.invalid || this.submitting()) return;
    if (this.state.method() === 'whatsapp') {
      const values: Record<string, string> = { name: this.model.name, place: this.model.location, prayerType: this.model.prayer_type, request: this.model.message };
      const message = decodeURIComponent(this.copy().whatsappTemplate).replace(/\$\{(name|place|prayerType|request)\}/g, (_match, key: string) => values[key]);
      const url = new URL('https://wa.me/918639067225');
      url.searchParams.set('text', message);
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
      this.state.showToast(this.copy().whatsappToast);
      this.effects.celebrate(this.submitButton()?.nativeElement);
      this.reset(form);
      return;
    }
    this.submitting.set(true);
    const data = new FormData();
    for (const [name, value] of Object.entries(this.model)) data.set(name, value);
    data.set('access_key', this.copy().accessKey);
    try {
      const response = await firstValueFrom(this.http.post<{ success: boolean }>('https://api.web3forms.com/submit', data)
        .pipe(takeUntilDestroyed(this.destroy)));
      if (!response.success) throw new Error('Submission failed');
      this.state.showToast(this.copy().successToast);
      this.effects.celebrate(this.submitButton()?.nativeElement);
      this.reset(form);
    } catch {
      if (!this.destroy.destroyed) this.state.showToast(this.copy().errorToast, 'error');
    } finally { this.submitting.set(false); }
  }

  private reset(form: NgForm): void {
    this.model = { name: '', email: '', location: '', prayer_type: '', message: '' };
    form.resetForm(this.model);
  }
}