import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { SecurityAuditService } from '../../../../core/services/security-audit.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Incidente } from '../../../../core/models/incident.model';
import { IncidentsHeaderComponent } from '../../components/soporte/incidents-header.component';
import { IncidentsLogComponent } from '../../components/soporte/incidents-log.component';
import { BlockedIpsListComponent } from '../../components/soporte/blocked-ips-list.component';
import { IncidentCreateModalComponent } from '../../components/soporte/incident-create-modal.component';

/** Contenedor (smart) de la pestaña SOPORTE & INCIDENTES: bitácora y auditoría de seguridad. */
@Component({
  selector: 'app-admin-soporte-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IncidentsHeaderComponent,
    IncidentsLogComponent,
    BlockedIpsListComponent,
    IncidentCreateModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      <app-incidents-header (documentRequested)="showIncidenteModal = true" />

      <app-incidents-log
        [incidentes]="securityAuditService.incidentes()"
        (resolveRequested)="abrirModalResolver($event)"
      />

      <app-blocked-ips-list
        [ipsBloqueadas]="securityAuditService.ipsBloqueadas()"
        (unblockRequested)="desbloquearIp($event)"
      />
    </main>

    <!-- Modal: documentar incidente -->
    @if (showIncidenteModal) {
      <app-incident-create-modal
        [initial]="incidenteForm"
        (closed)="showIncidenteModal = false"
        (confirmed)="incidenteForm = $event; confirmarRegistroIncidente()"
      />
    }

    <!-- Modal: resolver incidente -->
    @if (showResolverModal && incidenteSeleccionado) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div class="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
          <div class="flex justify-between items-center border-b border-white/10 pb-3">
            <div>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-polleria-gold font-bold">INC-{{ incidenteSeleccionado.id }}</span>
              <h3 class="font-display text-lg font-bold text-white mt-1">Marcar Incidente Resuelto</h3>
            </div>
            <button (click)="showResolverModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <p class="text-sm text-slate-300 font-semibold">{{ incidenteSeleccionado.titulo }}</p>

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-bold text-slate-400 mb-1">Causa Raíz:</label>
              <textarea
                [(ngModel)]="resolverForm.causaRaiz"
                rows="2"
                placeholder="Describe la causa del incidente..."
                class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
              ></textarea>
            </div>
            <div>
              <label class="block font-bold text-slate-400 mb-1">Solución Aplicada:</label>
              <textarea
                [(ngModel)]="resolverForm.solucionAplicada"
                rows="2"
                placeholder="Describe cómo se resolvió..."
                class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
              ></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              (click)="showResolverModal = false"
              class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="confirmarResolver()"
              [disabled]="!resolverForm.causaRaiz.trim() || !resolverForm.solucionAplicada.trim()"
              class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer"
            >
              Confirmar Resolución
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class AdminSoportePage implements OnInit {
  readonly authService = inject(AuthService);
  readonly securityAuditService = inject(SecurityAuditService);
  readonly notify = inject(NotificationService);

  ngOnInit(): void {
    this.securityAuditService.cargarIncidentes();
    this.securityAuditService.cargarIpsBloqueadas();
  }

  desbloquearIp(ip: string): void {
    this.securityAuditService.desbloquearIp(ip).subscribe({
      next: () => {
        this.notify.showSuccess(`IP ${ip} desbloqueada`);
        this.securityAuditService.cargarIpsBloqueadas();
      },
      error: err => this.notify.showError(
        err?.error?.error || err?.error?.message || `No se pudo desbloquear la IP ${ip}`
      )
    });
  }

  // Modal de Documentar Incidente
  showIncidenteModal = false;
  incidenteForm = {
    titulo: '',
    modulo: 'COCINA_HORNO' as 'PAGOS' | 'COCINA_HORNO' | 'RED_WIFI' | 'SISTEMA_LOCAL',
    severidad: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAJA',
    causaRaiz: '',
    solucionAplicada: ''
  };

  confirmarRegistroIncidente(): void {
    if (!this.incidenteForm.titulo.trim() || !this.incidenteForm.causaRaiz.trim()) {
      this.notify.showWarning('Por favor ingresa título y causa raíz del incidente');
      return;
    }
    this.securityAuditService.registrarIncidente({
      titulo: this.incidenteForm.titulo,
      modulo: this.incidenteForm.modulo,
      severidad: this.incidenteForm.severidad,
      causaRaiz: this.incidenteForm.causaRaiz,
      solucionAplicada: this.incidenteForm.solucionAplicada || 'En seguimiento',
      reportadoPor: this.authService.currentUser()?.nombre || 'Administrador'
    }).subscribe({
      next: () => {
        this.notify.showSuccess('Incidente documentado en bitácora de soporte');
        this.showIncidenteModal = false;
        this.incidenteForm.titulo = '';
        this.incidenteForm.causaRaiz = '';
        this.incidenteForm.solucionAplicada = '';
      },
      error: () => {
        this.notify.showError('No se pudo documentar el incidente');
      }
    });
  }

  // Modal de Resolver Incidente
  showResolverModal = false;
  incidenteSeleccionado: Incidente | null = null;
  resolverForm = { causaRaiz: '', solucionAplicada: '' };

  abrirModalResolver(inc: Incidente): void {
    this.incidenteSeleccionado = inc;
    this.resolverForm = {
      causaRaiz: inc.causaRaiz || '',
      solucionAplicada: inc.solucionAplicada || ''
    };
    this.showResolverModal = true;
  }

  confirmarResolver(): void {
    const inc = this.incidenteSeleccionado;
    if (!inc || !this.resolverForm.causaRaiz.trim() || !this.resolverForm.solucionAplicada.trim()) return;

    this.securityAuditService.resolverIncidente(inc.id, {
      estado: 'RESUELTO',
      causaRaiz: this.resolverForm.causaRaiz.trim(),
      solucionAplicada: this.resolverForm.solucionAplicada.trim(),
      responsable: this.authService.currentUser()?.nombre || 'Administrador'
    }).subscribe({
      next: () => {
        this.showResolverModal = false;
        this.incidenteSeleccionado = null;
      },
      error: () => this.notify.showError('No se pudo resolver el incidente')
    });
  }
}
