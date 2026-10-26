import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';
import { SecurityAuditService } from '../../../../core/services/security-audit.service';
import { NotificationService } from '../../../../core/services/notification.service';
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
    IncidentsHeaderComponent,
    IncidentsLogComponent,
    BlockedIpsListComponent,
    IncidentCreateModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      <app-incidents-header (documentRequested)="showIncidenteModal = true" />

      <app-incidents-log [incidentes]="securityAuditService.incidentes()" />

      <app-blocked-ips-list
        [ipsBloqueadas]="securityAuditService.ipsBloqueadas()"
        (unblockRequested)="securityAuditService.desbloquearIp($event)"
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

  // Modal de Documentar Incidente (Fase 6)
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
}
