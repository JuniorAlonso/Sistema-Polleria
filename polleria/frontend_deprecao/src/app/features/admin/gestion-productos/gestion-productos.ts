import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { NgIf, NgFor, CurrencyPipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProductoService } from '../../../core/services/producto';
import { Producto, Categoria } from '../../../core/models/orden.models';

@Component({
  selector: 'app-gestion-productos',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    CurrencyPipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './gestion-productos.html',
  styles: [`
    .admin-container {
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
    .form-card {
      margin-bottom: 24px;
      padding: 16px;
    }
    .form-card h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .form-grid mat-form-field {
      width: 100%;
    }
    .form-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    table {
      width: 100%;
    }
    .mat-column-id { width: 60px; }
    .mat-column-disponible { width: 100px; text-align: center; }
    .mat-column-acciones { width: 130px; text-align: right; }
    .precio-cell { font-weight: 600; color: #e65100; }
    .no-disponible { color: #9e9e9e; font-style: italic; }
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }
    .categoria-badge {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 12px;
      background: #e3f2fd;
      color: #1565c0;
    }
  `],
})
export class GestionProductosComponent implements OnInit {
  private readonly productoService = inject(ProductoService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  loading = signal(true);
  saving = signal(false);
  productos = signal<Producto[]>([]);
  editandoId = signal<number | null>(null);
  mostrarFormulario = signal(false);

  readonly displayedColumns = ['id', 'nombre', 'categoria', 'precio', 'disponible', 'acciones'];

  readonly categorias: Categoria[] = [
    'POLLO_ENTERO', 'MEDIO_POLLO', 'CUARTO_POLLO',
    'COMBO', 'PARRILLA', 'GUARNICION',
    'BEBIDA', 'POSTRE', 'PROMOCION',
  ];

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(0.1)]],
    categoria: ['POLLO_ENTERO' as Categoria, [Validators.required]],
    imagenUrl: [''],
    disponible: [true],
  });

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.loading.set(true);
    this.productoService.getTodos().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Error al cargar productos', 'OK', { duration: 3000 });
      },
    });
  }

  abrirFormularioNuevo(): void {
    this.editandoId.set(null);
    this.form.reset({
      nombre: '',
      descripcion: '',
      precio: 0,
      categoria: 'POLLO_ENTERO',
      imagenUrl: '',
      disponible: true,
    });
    this.mostrarFormulario.set(true);
  }

  editarProducto(producto: Producto): void {
    this.editandoId.set(producto.id);
    this.form.patchValue({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio: producto.precio,
      categoria: producto.categoria,
      imagenUrl: producto.imagenUrl ?? '',
      disponible: producto.disponible,
    });
    this.mostrarFormulario.set(true);
  }

  cancelarFormulario(): void {
    this.mostrarFormulario.set(false);
    this.editandoId.set(null);
    this.form.reset();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const data: Partial<Producto> = {
      nombre: this.form.value.nombre!,
      descripcion: this.form.value.descripcion || undefined,
      precio: Number(this.form.value.precio),
      categoria: this.form.value.categoria as Categoria,
      imagenUrl: this.form.value.imagenUrl || undefined,
      disponible: this.form.value.disponible ?? true,
    };

    const id = this.editandoId();
    const request$ = id
      ? this.productoService.actualizar(id, data)
      : this.productoService.crear(data);

    request$.subscribe({
      next: (producto) => {
        this.saving.set(false);
        if (id) {
          this.productos.update(ps => ps.map(p => p.id === producto.id ? producto : p));
          this.snackBar.open('Producto actualizado', 'OK', { duration: 2000 });
        } else {
          this.productos.update(ps => [...ps, producto]);
          this.snackBar.open('Producto creado', 'OK', { duration: 2000 });
        }
        this.cancelarFormulario();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'Error al guardar el producto';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      },
    });
  }

  toggleDisponibilidad(producto: Producto): void {
    this.productoService.toggleDisponibilidad(producto.id).subscribe({
      next: (updated) => {
        this.productos.update(ps => ps.map(p => p.id === updated.id ? updated : p));
        const estado = updated.disponible ? 'disponible' : 'no disponible';
        this.snackBar.open(`${producto.nombre} marcado como ${estado}`, 'OK', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Error al cambiar disponibilidad', 'OK', { duration: 3000 });
      },
    });
  }

  eliminar(producto: Producto): void {
    if (!confirm(`¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.productoService.eliminar(producto.id).subscribe({
      next: () => {
        this.productos.update(ps => ps.filter(p => p.id !== producto.id));
        this.snackBar.open('Producto eliminado', 'OK', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Error al eliminar el producto', 'OK', { duration: 3000 });
      },
    });
  }

  labelCategoria(cat: string): string {
    const labels: Record<string, string> = {
      POLLO_ENTERO: 'Pollo Entero',
      MEDIO_POLLO: '1/2 Pollo',
      CUARTO_POLLO: '1/4 Pollo',
      COMBO: 'Combo',
      PARRILLA: 'Parrilla',
      GUARNICION: 'Guarnición',
      BEBIDA: 'Bebida',
      POSTRE: 'Postre',
      PROMOCION: 'Promoción',
    };
    return labels[cat] ?? cat;
  }
}
