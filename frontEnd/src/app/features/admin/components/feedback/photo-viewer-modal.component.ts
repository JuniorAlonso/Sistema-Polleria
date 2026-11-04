import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Lightbox de la foto de evidencia de un reclamo. Presentacional. */
@Component({
  selector: 'app-photo-viewer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
      @if (fotoUrl(); as fotoUrl) {
        <div 
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in cursor-zoom-out"
          (click)="closed.emit()"
        >
          <div 
            class="relative max-w-4xl max-h-[90vh] bg-[#14161a] border border-white/20 rounded-3xl p-3 shadow-2xl flex flex-col items-center cursor-default"
            (click)="$event.stopPropagation()"
          >
            <!-- Header Visor -->
            <div class="w-full flex justify-between items-center px-4 py-2 border-b border-white/10 mb-2">
              <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
                Evidencia Fotográfica del Reclamo
              </span>
              <button 
                type="button" 
                (click)="closed.emit()" 
                class="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Cerrar visor"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Imagen -->
            <div class="rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              <img 
                [src]="fotoUrl" 
                alt="Foto de evidencia ampliada" 
                class="max-w-full max-h-[75vh] object-contain select-none"
              />
            </div>

            <!-- Footer -->
            <div class="w-full flex justify-between items-center px-4 pt-2 text-[11px] text-slate-400">
              <span>Haz clic fuera de la imagen o en la cruz para cerrar</span>
              <a [href]="fotoUrl" target="_blank" class="text-polleria-gold hover:underline font-bold">
                Abrir en nueva pestaña ↗
              </a>
            </div>
          </div>
        </div>
      }
  `
})
export class PhotoViewerModalComponent {
  readonly fotoUrl = input.required<string>();

  readonly closed = output<void>();
}
