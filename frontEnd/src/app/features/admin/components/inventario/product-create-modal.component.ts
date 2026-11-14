import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../../core/models/product.model';

export interface ProductCreateValues {
  product: Omit<Product, 'id'>;
  imageFile: File | null;
}

/** Modal de alta de plato/combo. Presentacional: edita un borrador local y lo emite. */
@Component({
  selector: 'app-product-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">

            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Agregar Producto a la Carta</h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-400 mb-1">Nombre del Plato / Combo:</label>
                <input
                  type="text"
                  [(ngModel)]="draft.nombre"
                  placeholder="Ej. 1/2 Pollo Parrillero con Ensalada"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">Descripción detallada:</label>
                <textarea
                  [(ngModel)]="draft.descripcion"
                  rows="2"
                  placeholder="Incluye papas crujientes, ensalada y salsas de la casa..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Precio (S/.):</label>
                  <input
                    type="number"
                    [(ngModel)]="draft.precio"
                    placeholder="35.00"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>

                <div>
                  <label class="block font-bold text-slate-400 mb-1">Categoría:</label>
                  <select
                    [(ngModel)]="draft.categoria"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="POLLOS_A_LA_BRASA">Pollos a la Brasa</option>
                    <option value="COMBOS_FAMILIARES">Combos Familiares</option>
                    <option value="PIQUEOS_Y_BEBIDAS">Piqueos y Entradas</option>
                    <option value="BEBIDAS">Bebidas</option>
                  </select>
                </div>
              </div>

              <!-- Imagen: file upload + preview -->
              <div>
                <label class="block font-bold text-slate-400 mb-1">Imagen del Plato:</label>
                <div class="space-y-2">
                  <label class="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl bg-black/50 border border-dashed border-white/20 hover:border-polleria-gold/60 text-slate-400 hover:text-polleria-gold text-xs font-semibold cursor-pointer transition">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span class="truncate max-w-xs">{{ imageFile() ? imageFile()!.name : 'Seleccionar imagen (JPEG / PNG / WEBP)' }}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFileChange($event)" />
                  </label>
                  @if (fileError()) {
                    <p class="text-rose-400 text-[11px] font-semibold">{{ fileError() }}</p>
                  }
                  @if (previewUrl()) {
                    <div class="rounded-xl overflow-hidden bg-black/50 border border-white/10 h-28 flex items-center justify-center">
                      <img [src]="previewUrl()!" alt="Preview" class="h-full w-full object-contain" />
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                (click)="closed.emit()"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                (click)="guardar()"
                class="px-5 py-2 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold transition cursor-pointer shadow"
              >
                Guardar Plato
              </button>
            </div>

          </div>
        </div>
  `
})
export class ProductCreateModalComponent implements OnInit {
  readonly initial = input.required<Omit<Product, 'id'>>();

  readonly closed = output<void>();
  readonly saved = output<ProductCreateValues>();

  protected draft!: Omit<Product, 'id'>;
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly imageFile = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  ngOnInit(): void {
    this.draft = { ...this.initial() };
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.fileError.set('Solo se aceptan imágenes JPEG, PNG o WEBP.');
      return;
    }
    this.fileError.set(null);
    this.imageFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  protected guardar(): void {
    this.saved.emit({ product: { ...this.draft }, imageFile: this.imageFile() });
  }
}
