import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MesaService } from '../../../core/services/mesa';
import { Mesa, MesaEstado } from '../../../core/models/orden.models';

@Component({
  selector: 'app-gestion-mesas',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './gestion-mesas.html',
  styles: [`
    .mesas-container {
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .page-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #1a237e;
    }
    .legend {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
    }
    .legend-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
    }
    .mesas-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 16px;
    }
    .mesa-card {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      border-radius: 12px !important;
      border: 3px solid transparent;
    }
    .mesa-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
    }
    .mesa-card.libre {
      border-color: #4caf50;
      background: #f1f8e9;
    }
    .mesa-card.ocupada {
      border-color: #f44336;
      background: #fce4ec;
    }
    .mesa-card.reservada {
      border-color: #ff9800;
      background: #fff8e1;
    }
    .mesa-icon {
      font-size: 2.5rem;
      text-align: center;
      padding: 8px 0;
    }
    .mesa-numero {
      font-size: 1.4rem;
      font-weight: 700;
      text-align: center;
    }
    .mesa-info {
      text-align: center;
      font-size: 0.8rem;
      color: #757575;
    }
    .mesa-estado {
      text-align: center;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 4px 0;
    }
    .estado-libre { color: #388e3c; }
    .estado-ocupada { color: #c62828; }
    .estado-reservada { color: #e65100; }
    .mesa-actions {
      display: flex;
      gap: 4px;
      justify-content: center;
      flex-wrap: wrap;
      padding: 8px 0;
    }
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }
    .stats-bar {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 20px;
      border-radius: 8px;
      min-width: 80px;
    }
    .stat.libre { background: #f1f8e9; }
    .stat.ocupada { background: #fce4ec; }
    .stat.reservada { background: #fff8e1; }
    .stat-number { font-size: 1.8rem; font-weight: 700; }
    .stat-label { font-size: 0.75rem; color: #757575; }
  `],
})
export class GestionMesasComponent implements OnInit {
  private readonly mesaService = inject(MesaService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(true);
  mesas = signal<Mesa[]>([]);

  readonly mesasLibres = computed(() => this.mesas().filter(m => m.estado === 'LIBRE').length);
  readonly mesasOcupadas = computed(() => this.mesas().filter(m => m.estado === 'OCUPADA').length);
  readonly mesasReservadas = computed(() => this.mesas().filter(m => m.estado === 'RESERVADA').length);

  ngOnInit(): void {
    this.cargarMesas();
  }

  cargarMesas(): void {
    this.loading.set(true);
    this.mesaService.getAll().subscribe({
      next: (mesas) => {
        this.mesas.set(mesas);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Error al cargar las mesas', 'OK', { duration: 3000 });
      },
    });
  }

  cambiarEstado(mesa: Mesa, nuevoEstado: MesaEstado): void {
    this.mesaService.actualizarEstado(mesa.id, nuevoEstado).subscribe({
      next: (updated) => {
        this.mesas.update(mesas => mesas.map(m => m.id === updated.id ? updated : m));
        this.snackBar.open(
          `Mesa ${mesa.numero} → ${this.labelEstado(nuevoEstado)}`,
          'OK',
          { duration: 2000 }
        );
      },
      error: () => {
        this.snackBar.open('Error al actualizar el estado de la mesa', 'OK', { duration: 3000 });
      },
    });
  }

  iniciarPedido(mesa: Mesa): void {
    this.router.navigate(['/pedido'], { state: { mesaId: mesa.id, mesaNumero: mesa.numero } });
  }

  iconMesa(estado: MesaEstado): string {
    const icons: Record<MesaEstado, string> = {
      LIBRE: '🟢',
      OCUPADA: '🔴',
      RESERVADA: '🟡',
    };
    return icons[estado];
  }

  labelEstado(estado: MesaEstado): string {
    const labels: Record<MesaEstado, string> = {
      LIBRE: 'Libre',
      OCUPADA: 'Ocupada',
      RESERVADA: 'Reservada',
    };
    return labels[estado];
  }

  claseEstado(estado: MesaEstado): string {
    return estado.toLowerCase();
  }
}
