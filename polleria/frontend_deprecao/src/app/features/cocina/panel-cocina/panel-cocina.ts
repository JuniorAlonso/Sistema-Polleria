import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OrdenService } from '../../../core/services/orden';
import { Orden, OrdenEstado } from '../../../core/models/orden.models';

@Component({
  selector: 'app-panel-cocina',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './panel-cocina.html',
  styles: [`
    .cocina-container {
      padding: 16px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .page-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #e65100;
    }
    .refresh-info {
      font-size: 0.8rem;
      color: #9e9e9e;
    }
    .panel-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .panel-grid { grid-template-columns: 1fr; }
    }
    .column-title {
      font-size: 1.1rem;
      font-weight: 600;
      padding: 8px 12px;
      border-radius: 8px 8px 0 0;
      margin-bottom: 12px;
    }
    .column-recibido .column-title {
      background: #fff3e0;
      color: #e65100;
      border-left: 4px solid #ff6d00;
    }
    .column-preparacion .column-title {
      background: #e3f2fd;
      color: #1565c0;
      border-left: 4px solid #1976d2;
    }
    .orden-card {
      margin-bottom: 12px;
    }
    .orden-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .orden-id {
      font-weight: 700;
      font-size: 1rem;
    }
    .orden-tipo {
      font-size: 0.8rem;
      color: #757575;
    }
    .orden-items {
      list-style: none;
      padding: 0;
      margin: 8px 0;
    }
    .orden-item {
      display: flex;
      gap: 8px;
      padding: 4px 0;
      font-size: 0.9rem;
      border-bottom: 1px dashed #e0e0e0;
    }
    .item-cantidad {
      font-weight: 700;
      color: #e65100;
      min-width: 24px;
    }
    .item-notas {
      font-style: italic;
      color: #757575;
      font-size: 0.8rem;
    }
    .orden-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }
    .tiempo-transcurrido {
      font-size: 0.8rem;
      color: #757575;
    }
    .tiempo-urgente {
      color: #f44336;
      font-weight: 600;
    }
    .empty-column {
      text-align: center;
      padding: 32px;
      color: #9e9e9e;
      background: #fafafa;
      border-radius: 8px;
      border: 2px dashed #e0e0e0;
    }
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
      grid-column: 1/-1;
    }
  `],
})
export class PanelCocinaComponent implements OnInit, OnDestroy {
  private readonly ordenService = inject(OrdenService);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(true);
  ordenes = signal<Orden[]>([]);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly ordenesRecibidas = () => this.ordenes().filter(o => o.estado === 'RECIBIDO');
  readonly ordenesEnPreparacion = () => this.ordenes().filter(o => o.estado === 'EN_PREPARACION');

  ngOnInit(): void {
    this.cargarOrdenes();
    this.intervalId = setInterval(() => this.cargarOrdenes(), 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  cargarOrdenes(): void {
    this.ordenService.paraCocina().subscribe({
      next: (ordenes) => {
        this.ordenes.set(ordenes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Error al cargar órdenes de cocina', 'OK', { duration: 3000 });
      },
    });
  }

  avanzarEstado(orden: Orden): void {
    const nuevoEstado: OrdenEstado = orden.estado === 'RECIBIDO' ? 'EN_PREPARACION' : 'LISTO';
    const label = nuevoEstado === 'EN_PREPARACION' ? 'en preparación' : 'lista';

    this.ordenService.actualizarEstado(orden.id, nuevoEstado).subscribe({
      next: (updated) => {
        this.ordenes.update(items =>
          items.map(o => o.id === updated.id ? updated : o)
            .filter(o => o.estado !== 'LISTO')
        );
        this.snackBar.open(`Orden #${orden.id} marcada como ${label}`, 'OK', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Error al actualizar el estado', 'OK', { duration: 3000 });
      },
    });
  }

  tiempoTranscurrido(creadoEn: string): string {
    const diff = Date.now() - new Date(creadoEn).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}min`;
  }

  esUrgente(creadoEn: string): boolean {
    const diff = Date.now() - new Date(creadoEn).getTime();
    return diff > 20 * 60000; // más de 20 minutos
  }

  labelMesaTipo(orden: Orden): string {
    if (orden.mesaNumero) return `Mesa ${orden.mesaNumero}`;
    return orden.tipo;
  }

  labelBotonAvanzar(estado: OrdenEstado): string {
    return estado === 'RECIBIDO' ? '▶ Iniciar Preparación' : '✓ Marcar Listo';
  }

  colorBotonAvanzar(estado: OrdenEstado): string {
    return estado === 'RECIBIDO' ? 'primary' : 'accent';
  }
}
