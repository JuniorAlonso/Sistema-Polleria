import { Injectable } from '@angular/core';
import { toast } from 'ngx-sonner';
import Swal, { SweetAlertOptions } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  /**
   * Toasts ligeros y modernos (estilo Sonner de React)
   */
  showSuccess(message: string, description?: string): void {
    toast.success(message, { description });
  }

  showError(message: string, description?: string): void {
    toast.error(message, { description });
  }

  showInfo(message: string, description?: string): void {
    toast.info(message, { description });
  }

  showWarning(message: string, description?: string): void {
    toast.warning(message, { description });
  }

  /**
   * Diálogo modal interactivo (SweetAlert2)
   */
  async confirmDialog(options: {
    title: string;
    text: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    icon?: 'warning' | 'question' | 'info';
  }): Promise<boolean> {
    const result = await Swal.fire({
      title: options.title,
      text: options.text,
      icon: options.icon ?? 'question',
      showCancelButton: true,
      confirmButtonColor: '#ea580c', // brand-600
      cancelButtonColor: '#64748b',
      confirmButtonText: options.confirmButtonText ?? 'Sí, confirmar',
      cancelButtonText: options.cancelButtonText ?? 'Cancelar',
      customClass: {
        popup: 'rounded-2xl shadow-2xl font-sans'
      }
    });

    return result.isConfirmed;
  }
}
