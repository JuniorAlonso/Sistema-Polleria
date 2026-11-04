import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrdersService } from '../../../../core/services/orders.service';
import { FeedbackService } from '../../../../core/services/feedback.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ReporteIncidencia, EstadoReclamo } from '../../../../core/models/feedback.model';
import { ResolverReclamoValues } from '../../models/admin-forms';
import { FeedbackSummaryComponent } from '../../components/feedback/feedback-summary.component';
import { ClaimsListComponent } from '../../components/feedback/claims-list.component';
import { ReviewsListComponent } from '../../components/feedback/reviews-list.component';
import { ClaimResolutionModalComponent } from '../../components/feedback/claim-resolution-modal.component';
import { PhotoViewerModalComponent } from '../../components/feedback/photo-viewer-modal.component';

/** Contenedor (smart) de la pestaña FEEDBACK & RECLAMOS: reseñas y libro de reclamaciones. */
@Component({
  selector: 'app-admin-feedback-page',
  standalone: true,
  imports: [
    CommonModule,
    FeedbackSummaryComponent,
    ClaimsListComponent,
    ReviewsListComponent,
    ClaimResolutionModalComponent,
    PhotoViewerModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Feedback, Reseñas & Reclamos</span>
                
              </h2>
              <p class="text-xs text-slate-400">Calificaciones (1-5 estrellas) y Libro de Reclamaciones con reembolso automático (:8085).</p>
            </div>
        <app-feedback-summary
          [promedioEstrellas]="feedbackService.promedioEstrellas()"
          [reseniasCount]="feedbackService.resenias().length"
          [pendientesCount]="feedbackService.reclamosPendientes().length"
        />
      </div>

      <app-claims-list
        [reportesReclamos]="reportesReclamos()"
        [ordenes]="ordersService.orders()"
        (photoRequested)="abrirVisorFoto($event)"
        (resolveRequested)="abrirModalResolverReclamo($event)"
      />

      <app-reviews-list [resenias]="feedbackService.resenias()" />
    </main>

    <!-- Modal: revisar y atender reclamo -->
    @if (showResolverReclamoModal() && reclamoSeleccionado(); as reclamo) {
      <app-claim-resolution-modal
        [reclamo]="reclamo"
        [ordenes]="ordersService.orders()"
        [fotoSrc]="feedbackService.getFotoUrl(reclamo.fotoEvidenciaUrl || reclamo.fotoUrl)"
        [isResolviendoReclamo]="isResolviendoReclamo()"
        (closed)="cerrarModalResolverReclamo()"
        (photoRequested)="abrirVisorFoto($event)"
        (confirmed)="confirmarResolverReclamo($event)"
      />
    }

    <!-- Modal: visor de foto de evidencia -->
    @if (visorFotoUrl(); as fotoUrl) {
      <app-photo-viewer-modal [fotoUrl]="fotoUrl" (closed)="cerrarVisorFoto()" />
    }
  `
})
export class AdminFeedbackPage implements OnInit {
  readonly ordersService = inject(OrdersService);
  readonly feedbackService = inject(FeedbackService);
  readonly notify = inject(NotificationService);

  ngOnInit(): void {
    this.feedbackService.cargarResenias();
    this.feedbackService.cargarReportes();
  }

  // Modal de Resolver Reclamo (Fase 4)
  readonly reportesReclamos = signal<ReporteIncidencia[]>([]);
  readonly showResolverReclamoModal = signal<boolean>(false);
  readonly reclamoSeleccionado = signal<ReporteIncidencia | null>(null);
  readonly isResolviendoReclamo = signal<boolean>(false);
  readonly visorFotoUrl = signal<string | null>(null);

  private readonly sincronizarReclamosEffect = effect(() => {
    const list = this.feedbackService.reportes();
    this.reportesReclamos.set(list);
  });

  abrirVisorFoto(url?: string): void {
    if (!url) return;
    this.visorFotoUrl.set(this.feedbackService.getFotoUrl(url));
  }

  cerrarVisorFoto(): void {
    this.visorFotoUrl.set(null);
  }

  abrirModalResolverReclamo(rec: ReporteIncidencia): void {
    this.reclamoSeleccionado.set(rec);
    this.showResolverReclamoModal.set(true);
  }

  cerrarModalResolverReclamo(): void {
    this.showResolverReclamoModal.set(false);
    this.reclamoSeleccionado.set(null);
  }

  confirmarResolverReclamo(valores: ResolverReclamoValues): void {
    const rec = this.reclamoSeleccionado();
    if (!rec || this.isResolviendoReclamo()) return;

    const { estadoFinal, respuestaAdmin, emitirReembolso, montoReembolso } = valores;
    this.isResolviendoReclamo.set(true);

    this.feedbackService.resolverReclamo(
      rec.id,
      respuestaAdmin!.trim(),
      !!emitirReembolso,
      emitirReembolso ? Number(montoReembolso) : undefined,
      (estadoFinal as EstadoReclamo) || 'RESUELTO'
    ).subscribe({
      next: (actualizado) => {
        this.isResolviendoReclamo.set(false);
        this.cerrarModalResolverReclamo();
        this.reportesReclamos.update(prev => prev.map(r => r.id === rec.id ? actualizado : r));
        this.notify.showSuccess(`Reclamo #${rec.id} ${actualizado.estado.toLowerCase()} con éxito.`);
      },
      error: (err) => {
        this.isResolviendoReclamo.set(false);
        this.notify.showError('No se pudo resolver el reclamo', err?.error?.message || 'Error en pasarela de pagos.');
      }
    });
  }
}
