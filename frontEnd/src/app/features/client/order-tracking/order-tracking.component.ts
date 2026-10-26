import { Component, inject, signal, computed, effect, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrdersService } from '../../../core/services/orders.service';
import { FeedbackService } from '../../../core/services/feedback.service';
import { MotivoReclamo } from '../../../core/models/feedback.model';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { AuthService } from '../../../core/services/auth.service';
import { etiquetaPedido } from '../../../core/utils/pedido';
import { PaymentService } from '../../../core/services/payment.service';
import { Subscription, interval } from 'rxjs';

/** States in which the customer can no longer cancel or act on the order. */
const ESTADOS_TERMINALES: OrderStatus[] = ['COMPLETADO', 'ENTREGADO', 'CANCELADO', 'PEDIDO_FANTASMA'];
const TIPOS_COMPROBANTE = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0f1013] text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- Ambient Glow & Heat Vignette Background -->
      <div class="absolute inset-0 bg-radial-vignette pointer-events-none opacity-60"></div>
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="max-w-4xl mx-auto space-y-8 relative z-10 animate-slide-up">
        
        <!-- ================= LISTA DE PEDIDOS DISPONIBLES ================= -->
        @if (availableOrders().length > 0) {
          <div class="bg-[#181a1e]/90 p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md">
            <div class="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <span>Pedidos ({{ availableOrders().length }})</span>
              </div>
              <span class="text-[11px] text-slate-400 font-mono hidden sm:inline">
                Selecciona una orden para rastrearla en tiempo real
              </span>
            </div>

            <!-- Horizontal Scrollable Order Pills List -->
            <div class="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
              @for (order of availableOrders(); track order.id) {
                <button
                  type="button"
                  (click)="selectOrder(order)"
                  class="shrink-0 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center gap-3"
                  [ngClass]="currentOrder()?.id === order.id ? 
                    'bg-amber-500/15 border-polleria-gold ring-1 ring-polleria-gold shadow-lg shadow-amber-500/10' : 
                    'bg-black/30 border-white/10 hover:border-white/20 hover:bg-white/5'"
                >
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-black" [ngClass]="currentOrder()?.id === order.id ? 'text-polleria-gold' : 'text-white'">
                        {{ etiqueta(order) }}
                      </span>
                      <!-- Badge Estado -->
                      <span 
                        class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide"
                        [ngClass]="{
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30': order.estado === 'EN_PREPARACION' || order.estado === 'PAGADO' || order.estado === 'PREPARANDO' || order.estado === 'PENDIENTE_CONFIRMACION' || order.estado === 'PENDIENTE_PAGO',
                          'bg-purple-500/20 text-purple-300 border border-purple-500/30': order.estado === 'LISTO_COCINA' || order.estado === 'LISTO' || order.estado === 'LISTO_PARA_ENTREGAR',
                          'bg-sky-500/20 text-sky-300 border border-sky-500/30': order.estado === 'EN_REPARTO' || order.estado === 'EN_CAMINO',
                          'bg-sky-400 text-slate-950 font-black animate-bounce': order.estado === 'EN_PUERTA',
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30': order.estado === 'COMPLETADO' || order.estado === 'ENTREGADO',
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30': order.estado === 'CANCELADO' || order.estado === 'PEDIDO_FANTASMA'
                        }"
                      >
                        {{ getStatusLabel(order.estado) }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between gap-4 mt-1 text-[11px] text-slate-400">
                      <span>{{ order.total | currencyPEN }}</span>
                      <span class="text-[10px]">{{ order.tipo }}</span>
                    </div>
                  </div>
                </button>
              }
            </div>
          </div>
        }

        @if (currentOrder()) {
          <!-- ================= TOP HEADER EN VIVO ================= -->
          <div class="text-center space-y-3">
            
            <!-- Order Code Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest text-slate-300 shadow">
              <span class="w-2 h-2 rounded-full bg-polleria-gold"></span>
              <span class="uppercase">{{ etiqueta(currentOrder()) }}</span>
              <span class="text-white/40">|</span>
              <span class="text-polleria-gold font-bold uppercase">{{ currentOrder()?.tipo || 'DELIVERY' }}</span>
            </div>

            <!-- Dynamic Slogan Display -->
            <h1 class="font-display text-3xl sm:text-5xl lg:text-6xl font-black tracking-wide uppercase text-polleria-gold drop-shadow-[0_2px_15px_rgba(245,158,11,0.35)] leading-tight">
              {{ getMainTitle() }}
            </h1>

            <!-- Dynamic Subtitle -->
            <p class="text-slate-300 text-sm sm:text-base font-normal tracking-wide max-w-xl mx-auto">
              {{ getSubtitle() }}
            </p>

            @if (getCuentaRegresiva()) {
              <p class="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-mono font-bold">
                {{ getCuentaRegresiva() }}
              </p>
            }

            @if (puedeSubirComprobante()) {
              <div class="max-w-md mx-auto p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2 text-left">
                @if (comprobanteRecibido()) {
                  <p class="text-sm font-bold text-emerald-300">Comprobante recibido, en espera de verificación.</p>
                } @else {
                  <p class="text-xs text-slate-300">Envía la captura de tu pago (JPG, PNG o WEBP, máximo 5 MB).</p>
                }
                <label class="block">
                  <span class="sr-only">Enviar comprobante de pago</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    [disabled]="subiendoComprobante()"
                    (change)="onComprobanteSeleccionado($event)"
                    class="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-polleria-gold file:text-slate-950 file:font-bold disabled:opacity-50"
                  />
                </label>
                @if (subiendoComprobante()) {
                  <p class="text-xs text-amber-300">Enviando comprobante...</p>
                }
                @if (errorComprobante()) {
                  <p class="text-xs text-rose-300" role="alert">{{ errorComprobante() }}</p>
                }
              </div>
            }

          </div>

          <!-- ================= DYNAMIC STEPPER PROGRESS CARD ================= -->
          <div class="p-6 sm:p-10 rounded-3xl bg-[#181a1e]/90 border border-white/10 shadow-2xl backdrop-blur-md">
            
            <div class="relative">
              
              <!-- Progress Connecting Line Track -->
              <div class="hidden sm:block absolute top-7 left-12 right-12 h-1 bg-slate-800 rounded-full">
                <!-- Active Progress Golden Glow Bar -->
                <div 
                  class="h-full bg-polleria-gold shadow-[0_0_15px_rgba(245,158,11,0.8)] rounded-full transition-all duration-700 ease-out"
                  [style.width]="getProgressWidth()"
                ></div>
              </div>

              <!-- Steps Grid (4 Steps) -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 relative z-10">
                
                <!-- STEP 1: RECIBIDO -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(1)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(1)"
                    >
                      Recibido
                    </h3>
                    <p class="text-xs text-slate-400 font-mono mt-0.5">
                      {{ getStepSubtitle(1) }}
                    </p>
                  </div>
                </div>

                <!-- STEP 2: EN PREPARACIÓN -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(2)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(2)"
                    >
                      En preparación
                    </h3>
                    <p class="text-xs text-slate-400 font-mono mt-0.5">
                      {{ getStepSubtitle(2) }}
                    </p>
                  </div>
                </div>

                <!-- STEP 3: EN CAMINO (O LISTO SALÓN) -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(3)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(3)"
                    >
                      {{ getStep3Title() }}
                    </h3>
                    <p class="text-xs font-mono mt-0.5" [ngClass]="isStepActive(3) ? 'text-sky-300 font-bold' : 'text-slate-400'">
                      {{ getStepSubtitle(3) }}
                    </p>
                  </div>
                </div>

                <!-- STEP 4: ENTREGADO / COMPLETADO -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(4)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(4)"
                    >
                      Entregado
                    </h3>
                    <p class="text-xs font-mono mt-0.5" [ngClass]="isStepActive(4) || isStepCompleted(4) ? 'text-emerald-400 font-bold' : 'text-slate-500'">
                      {{ getStepSubtitle(4) }}
                    </p>
                  </div>
                </div>

              </div>

            </div>

          </div>

          <!-- ================= BOTTOM ACTION BUTTONS ================= -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            <!-- Button 1: CONTACTAR CON EL RIDER -->
            <button 
              type="button"
              (click)="contactRider()"
              class="w-full py-4 px-6 rounded-xl border-2 border-polleria-gold bg-[#141618] hover:bg-white/5 active:scale-98 text-polleria-gold font-display text-lg sm:text-xl tracking-wider uppercase font-bold transition duration-200 shadow-lg flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>CONTACTAR CON EL RIDER</span>
            </button>

            <!-- Button 2: VER DETALLES -->
            <button 
              type="button"
              (click)="toggleDetailsModal(true)"
              class="w-full py-4 px-6 rounded-xl bg-polleria-crimson hover:bg-[#a81125] active:scale-98 text-white font-display text-lg sm:text-xl tracking-wider uppercase font-bold transition duration-200 shadow-lg shadow-black/60 flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span>VER DETALLES</span>
            </button>

            <!-- Button 3: CANCELAR PEDIDO (S5, solo invitado sin sesión y pedido no terminal) -->
            @if (puedeCancelarPedido()) {
              <button
                type="button"
                (click)="cancelarPedido()"
                [disabled]="cancelandoPedido()"
                class="w-full sm:col-span-2 py-4 px-6 rounded-xl border-2 border-rose-500/60 bg-[#141618] hover:bg-rose-500/10 active:scale-98 text-rose-300 font-display text-lg sm:text-xl tracking-wider uppercase font-bold transition duration-200 shadow-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg class="w-5 h-5 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span>{{ cancelandoPedido() ? 'CANCELANDO...' : 'CANCELAR PEDIDO' }}</span>
              </button>
            }

          </div>

          <!-- ================= SECCIÓN DE CALIFICACIÓN Y FEEDBACK (FASE 4) ================= -->
          @if (currentOrder()?.estado === 'COMPLETADO') {
            <div class="bg-[#181a1e]/90 p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 class="font-display text-xl text-polleria-gold uppercase tracking-wider flex items-center gap-2">
                    <span class="flex items-center gap-1.5"><svg class="w-4 h-4 text-polleria-gold inline" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> Califica tu Experiencia</span>
                  </h3>
                  <p class="text-xs text-slate-400">¿Cómo estuvo tu pedido de San Pollo? Tu opinión nos ayuda a mejorar.</p>
                </div>

                @if (reclamoDeOrdenActual(); as reclamo) {
                  @if (reclamo.estado === 'RESUELTO') {
                    <button 
                      type="button"
                      (click)="abrirModalReclamo()"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition cursor-pointer"
                    >
                      <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>✓ Reclamo Atendido (RESUELTO)</span>
                    </button>
                  } @else if (reclamo.estado === 'RECHAZADO') {
                    <button 
                      type="button"
                      (click)="abrirModalReclamo()"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-500/15 border border-slate-500/30 text-slate-300 text-xs font-bold hover:bg-slate-500/25 transition cursor-pointer"
                    >
                      <span>Reclamo No Procedente (RECHAZADO)</span>
                    </button>
                  } @else {
                    <button 
                      type="button"
                      (click)="abrirModalReclamo()"
                      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition cursor-pointer"
                    >
                      <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      <span>Reclamo en curso ({{ reclamo.estado || 'ABIERTO' }})</span>
                    </button>
                  }
                } @else {
                  <button 
                    type="button"
                    (click)="abrirModalReclamo()"
                    class="text-xs text-rose-400 hover:text-rose-300 underline font-bold cursor-pointer"
                  >
                    ¿Tuviste un inconveniente? Reportar reclamo
                  </button>
                }
              </div>

              <!-- Banner si este pedido ya tiene reclamo -->
              @if (reclamoDeOrdenActual(); as reclamo) {
                @if (reclamo.estado === 'RESUELTO') {
                  <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2 font-bold text-emerald-300">
                        <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        <span>Reclamo Resuelto para el {{ etiqueta(currentOrder()) }}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                          RESUELTO
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-300">
                        Motivo: <strong class="text-white">{{ getMotivoLabel(reclamo.motivo) }}</strong>
                      </p>
                      @if (reclamo.respuestaAdmin || reclamo.resolucion) {
                        <p class="text-[11px] text-emerald-200 bg-black/40 p-2.5 rounded-xl border border-emerald-500/20 italic mt-1">
                          "{{ reclamo.respuestaAdmin || reclamo.resolucion }}"
                        </p>
                      }
                      @if (reclamo.reembolsoProcedente && reclamo.montoReembolso) {
                        <p class="text-[11px] text-polleria-gold font-bold">
                          ✓ Reembolso de S/ {{ reclamo.montoReembolso | number:'1.2-2' }} aprobado hacia tu método de pago original.
                        </p>
                      }
                    </div>
                    <button 
                      type="button" 
                      (click)="abrirModalReclamo()" 
                      class="text-xs font-bold text-emerald-300 underline hover:text-white cursor-pointer shrink-0"
                    >
                      Ver resolución completa
                    </button>
                  </div>
                } @else if (reclamo.estado === 'RECHAZADO') {
                  <div class="p-4 rounded-2xl bg-slate-800/80 border border-white/10 text-slate-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2 font-bold text-slate-200">
                        <svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        <span>Reclamo Atendido — No Procedente</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-rose-500/20 border border-rose-500/40 text-rose-300">
                          RECHAZADO
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-400">
                        Motivo: {{ getMotivoLabel(reclamo.motivo) }}
                      </p>
                      @if (reclamo.respuestaAdmin || reclamo.resolucion) {
                        <p class="text-[11px] text-slate-300 bg-black/40 p-2 rounded-xl italic mt-1">
                          "{{ reclamo.respuestaAdmin || reclamo.resolucion }}"
                        </p>
                      }
                    </div>
                    <button 
                      type="button" 
                      (click)="abrirModalReclamo()" 
                      class="text-xs font-bold text-slate-400 underline hover:text-white cursor-pointer shrink-0"
                    >
                      Ver detalles
                    </button>
                  </div>
                } @else {
                  <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div class="space-y-0.5">
                      <div class="flex items-center gap-2 font-bold text-rose-200">
                        <svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span>Reclamo registrado para el {{ etiqueta(currentOrder()) }}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-rose-500/20 border border-rose-500/40">
                          {{ reclamo.estado || 'ABIERTO' }}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-300">
                        Motivo: <strong class="text-white">{{ getMotivoLabel(reclamo.motivo) }}</strong> — "{{ reclamo.descripcion }}"
                      </p>
                    </div>
                    <button 
                      type="button" 
                      (click)="abrirModalReclamo()" 
                      class="text-xs font-bold text-rose-300 underline hover:text-white cursor-pointer shrink-0"
                    >
                      Ver detalles del reclamo
                    </button>
                  </div>
                }
              }

              <!-- Estado de la calificación específica de este pedido -->
              @if (reseniaDeOrdenActual(); as resenia) {
                <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 animate-fade-in">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 font-bold text-sm">
                      <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                      <span>¡Calificación enviada para el {{ etiqueta(currentOrder()) }}!</span>
                    </div>
                    <div class="flex items-center gap-1 text-amber-400 font-bold text-sm">
                      @for (star of [1, 2, 3, 4, 5]; track star) {
                        <span [ngClass]="(resenia.calificacion || 5) >= star ? 'text-amber-400' : 'text-slate-600'">★</span>
                      }
                      <span class="ml-1 text-xs text-slate-300 font-mono">({{ resenia.calificacion || 5 }}/5)</span>
                    </div>
                  </div>
                  @if (resenia.comentario) {
                    <p class="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/5 italic">
                      "{{ resenia.comentario }}"
                    </p>
                  }
                  <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-emerald-500/20">
                    <span>Tu reseña ya fue registrada para esta orden y no se puede duplicar.</span>
                    @if (resenia.fecha) {
                      <span class="font-mono text-[10px] text-emerald-400/80">{{ resenia.fecha }}</span>
                    }
                  </div>
                </div>
              } @else {
                <div class="space-y-3">
                  <!-- Star selector -->
                  <div class="flex items-center gap-2">
                    @for (star of [1, 2, 3, 4, 5]; track star) {
                      <button 
                        type="button"
                        (click)="selectedStars.set(star)"
                        class="text-2xl transition hover:scale-110 cursor-pointer"
                        [ngClass]="selectedStars() >= star ? 'text-amber-400' : 'text-slate-600'"
                      >
                        ★
                      </button>
                    }
                    <span class="text-xs font-bold text-slate-300 ml-2">
                      {{ selectedStars() }} / 5 estrellas
                    </span>
                  </div>

                  <!-- Comment text -->
                  <div class="space-y-1">
                    <div class="flex gap-2">
                      <input 
                        type="text" 
                        [(ngModel)]="reviewComment" 
                        placeholder="Escribe tu opinión sobre el pedido (mínimo 10 caracteres)..."
                        class="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                      />
                      <button 
                        type="button"
                        (click)="enviarCalificacion()"
                        [disabled]="reviewComment.trim().length < 10 || isSubmittingRating()"
                        class="px-5 py-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        @if (isSubmittingRating()) {
                          <svg class="animate-spin w-3.5 h-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          <span>Enviando...</span>
                        } @else {
                          <span>Enviar</span>
                        }
                      </button>
                    </div>
                    @if (reviewComment.trim().length < 10) {
                      <div class="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl mt-1.5">
                        <span class="text-amber-400">⚠️</span>
                        <span>
                          @if (reviewComment.length === 0) {
                            Escribe una opinión sobre tu pedido (mínimo 10 caracteres) para habilitar el envío.
                          } @else {
                            Opinión muy corta: faltan {{ 10 - reviewComment.trim().length }} caracteres para habilitar el envío.
                          }
                        </span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        } @else {
          <!-- ================= EMPTY STATE ================= -->
          <div class="bg-[#181a1e]/90 p-8 sm:p-12 rounded-3xl border border-white/10 shadow-2xl text-center space-y-4">
            <div class="w-20 h-20 rounded-full bg-polleria-gold/10 border border-polleria-gold/20 flex items-center justify-center mx-auto text-polleria-gold">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
            </div>
            <h2 class="font-display text-2xl sm:text-3xl text-white uppercase tracking-wider">Aún no has seleccionado un pedido</h2>
            <p class="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              @if (auth.token()) {
                Cuando hagas un pedido, aparecerá aquí para que lo sigas en tiempo real.
              } @else {
                Si ya hiciste un pedido, verifica tu celular más abajo para verlo. Si no, explora la carta.
              }
            </p>
            <div class="pt-2">
              <a 
                routerLink="/menu" 
                class="inline-block px-8 py-3.5 rounded-full bg-polleria-crimson hover:bg-[#a81125] text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition shadow-lg shadow-black/40 cursor-pointer"
              >
                Explorar Menú y Pedir
              </a>
            </div>
          </div>
        }

        <!-- ================= SEGUIMIENTO SIN CUENTA (código por WhatsApp) ================= -->
        @if (!auth.token()) {
          <div class="bg-[#181a1e]/90 p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl max-w-xl mx-auto">
            @if (ordersService.seguimientoTelefono(); as telefono) {
              <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span class="text-slate-300">
                  Mostrando los pedidos del celular <strong class="text-white font-mono">{{ formatearCelular(telefono) }}</strong>
                </span>
                <button type="button" (click)="cambiarCelular()"
                  class="px-4 py-1.5 rounded-full border border-white/15 text-slate-300 hover:text-white hover:border-white/30 font-bold uppercase transition cursor-pointer">
                  Usar otro celular
                </button>
              </div>
            } @else {
              <div class="space-y-3">
                <div>
                  <h3 class="text-sm font-bold text-white uppercase tracking-wider">Consulta tus pedidos</h3>
                  <p class="text-xs text-slate-400 mt-1">
                    @if (pasoSeguimiento() === 'CELULAR') {
                      Escribe el celular que usaste en tu pedido y te enviaremos un código por WhatsApp.
                    } @else {
                      Te enviamos un código de 4 dígitos por WhatsApp al {{ formatearCelular(celularSeguimiento) }}. Puede tardar unos segundos.
                    }
                  </p>
                </div>

                @if (pasoSeguimiento() === 'CELULAR') {
                  <form (ngSubmit)="enviarCodigo()" class="flex flex-col sm:flex-row gap-2">
                    <input type="tel" inputmode="numeric" maxlength="12" [(ngModel)]="celularSeguimiento" name="celularSeguimiento"
                      placeholder="Celular, ej. 912345678"
                      class="flex-1 px-4 py-2.5 rounded-xl bg-black/30 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-polleria-gold" />
                    <button type="submit" [disabled]="procesandoSeguimiento()"
                      class="px-5 py-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold uppercase transition cursor-pointer">
                      {{ procesandoSeguimiento() ? 'Enviando...' : 'Enviar código' }}
                    </button>
                  </form>
                } @else {
                  <form (ngSubmit)="verificarCodigo()" class="flex flex-col sm:flex-row gap-2">
                    <input type="text" inputmode="numeric" maxlength="4" [(ngModel)]="codigoSeguimiento" name="codigoSeguimiento"
                      placeholder="Código de 4 dígitos" autocomplete="one-time-code"
                      class="flex-1 px-4 py-2.5 rounded-xl bg-black/30 border border-white/15 text-sm text-white tracking-[0.4em] font-mono placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-polleria-gold" />
                    <button type="submit" [disabled]="procesandoSeguimiento()"
                      class="px-5 py-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold uppercase transition cursor-pointer">
                      {{ procesandoSeguimiento() ? 'Verificando...' : 'Ver mis pedidos' }}
                    </button>
                  </form>
                  <div class="flex gap-4 text-[11px]">
                    <button type="button" (click)="enviarCodigo()" class="text-slate-400 hover:text-white underline cursor-pointer">Reenviar código</button>
                    <button type="button" (click)="cambiarCelular()" class="text-slate-400 hover:text-white underline cursor-pointer">Cambiar celular</button>
                  </div>
                }
              </div>
            }
          </div>
        }

      </div>


      <!-- ================= DETAILS MODAL ================= -->
      @if (showDetailsModal()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div class="w-full max-w-lg bg-[#181a1e] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 animate-slide-up text-white">
            
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 class="font-display text-2xl uppercase tracking-wider text-polleria-gold">
                  Detalle del {{ etiqueta(currentOrder()) }}
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">
                  Cliente: <strong class="text-white">{{ currentOrder()?.cliente?.nombre || 'Cliente San Pollo' }}</strong>
                </p>
                <p class="text-xs text-slate-400">
                  Dirección: {{ currentOrder()?.cliente?.direccion || 'Entrega en local' }}
                </p>
              </div>
              <button 
                (click)="toggleDetailsModal(false)"
                class="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Items List -->
            <div class="space-y-3 max-h-60 overflow-y-auto pr-1">
              @for (item of currentOrder()?.items ?? []; track $index) {
                <div class="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                  <div class="flex items-center gap-3">
                    <span class="px-2 py-0.5 rounded bg-polleria-crimson text-white font-mono font-bold">{{ item.cantidad }}x</span>
                    <div class="flex flex-col">
                      <span class="font-bold text-slate-200">{{ item.product.nombre }}</span>
                      @if (item.notas) {
                        <span class="text-[10px] text-amber-400/80 italic">Nota: {{ item.notas }}</span>
                      }
                    </div>
                  </div>
                  <span class="font-bold text-polleria-gold">{{ item.subtotal | currencyPEN }}</span>
                </div>
              } @empty {
                <p class="py-6 text-center text-xs text-slate-400">No se encontraron los productos de este pedido.</p>
              }
            </div>

            <!-- Totals Breakdown -->
            <div class="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>{{ currentOrder()?.subtotal | currencyPEN }}</span>
              </div>
              <div class="flex justify-between">
                <span>Delivery:</span>
                <span>{{ currentOrder()?.costoEnvio | currencyPEN }}</span>
              </div>
              <div class="flex justify-between pt-2 border-t border-slate-700 text-sm font-bold text-white">
                <span>Total Facturado:</span>
                <span class="text-polleria-gold font-display text-xl">{{ currentOrder()?.total | currencyPEN }}</span>
              </div>
            </div>

            <button 
              type="button"
              (click)="toggleDetailsModal(false)"
              class="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase cursor-pointer transition"
            >
              Cerrar
            </button>

          </div>
        </div>
      }

      <!-- ================= COMPLAINT / RECLAMO MODAL (FASE 4) ================= -->
      @if (showReportModal()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div class="w-full max-w-lg bg-[#181a1e] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 animate-slide-up text-white">
            
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 class="font-display text-2xl uppercase tracking-wider text-rose-400 flex items-center gap-2">
                  <span class="flex items-center gap-1.5"><svg class="w-4 h-4 text-rose-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> Libro de Reclamaciones</span>
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">
                  Registra un reclamo para el <strong class="text-white">{{ etiqueta(currentOrder()) }}</strong>
                </p>
              </div>
              <button 
                (click)="showReportModal.set(false)"
                class="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            @if (reclamoDeOrdenActual(); as reclamoExistente) {
              <!-- Vista de Reclamo Ya Registrado para este Pedido -->
              <div class="space-y-4">
                <div 
                  class="p-5 rounded-2xl text-xs space-y-3"
                  [ngClass]="{
                    'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300': reclamoExistente.estado === 'RESUELTO',
                    'bg-slate-800/80 border border-white/10 text-slate-300': reclamoExistente.estado === 'RECHAZADO',
                    'bg-rose-500/10 border border-rose-500/30 text-rose-300': reclamoExistente.estado !== 'RESUELTO' && reclamoExistente.estado !== 'RECHAZADO'
                  }"
                >
                  <div class="flex items-center justify-between pb-2 border-b border-white/10">
                    <span class="font-bold text-sm text-white">
                      {{ reclamoExistente.estado === 'RESUELTO' ? 'Reclamo Resuelto' : (reclamoExistente.estado === 'RECHAZADO' ? 'Reclamo No Procedente' : 'Reclamo en Curso') }}
                    </span>
                    <span 
                      class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase"
                      [ngClass]="{
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40': reclamoExistente.estado === 'RESUELTO',
                        'bg-rose-500/20 text-rose-400 border border-rose-500/40': reclamoExistente.estado === 'RECHAZADO',
                        'bg-amber-500/20 text-amber-300 border border-amber-500/40': reclamoExistente.estado !== 'RESUELTO' && reclamoExistente.estado !== 'RECHAZADO'
                      }"
                    >
                      {{ reclamoExistente.estado || 'ABIERTO' }}
                    </span>
                  </div>

                  <div>
                    <span class="text-slate-400 block text-[11px]">Motivo registrado:</span>
                    <strong class="text-white text-xs">{{ getMotivoLabel(reclamoExistente.motivo) }}</strong>
                  </div>

                  <div>
                    <span class="text-slate-400 block text-[11px]">Tu descripción:</span>
                    <p class="text-xs text-slate-200 bg-black/40 p-3 rounded-xl border border-white/5 mt-1 italic">
                      "{{ reclamoExistente.descripcion }}"
                    </p>
                  </div>

                  <!-- Resolución de la Administración si ya está atendido -->
                  @if (reclamoExistente.respuestaAdmin || reclamoExistente.resolucion) {
                    <div class="pt-2 border-t border-white/10 space-y-1">
                      <span class="text-emerald-400 font-bold block text-[11px]">Respuesta de la Administración:</span>
                      <p class="text-xs text-white bg-black/50 p-3 rounded-xl border border-emerald-500/30">
                        {{ reclamoExistente.respuestaAdmin || reclamoExistente.resolucion }}
                      </p>
                    </div>
                  }

                  <!-- Detalle de Reembolso si aplica -->
                  @if (reclamoExistente.reembolsoProcedente && reclamoExistente.montoReembolso) {
                    <div class="p-3 rounded-xl bg-polleria-gold/10 border border-polleria-gold/30 text-polleria-gold flex items-center justify-between">
                      <span class="font-bold text-[11px]">Reembolso Aprobado:</span>
                      <span class="font-mono font-bold text-sm">S/ {{ reclamoExistente.montoReembolso | number:'1.2-2' }}</span>
                    </div>
                  }

                  @if (reclamoExistente.fecha) {
                    <p class="text-[10px] text-slate-400 font-mono text-right pt-1">
                      Registrado: {{ reclamoExistente.fecha }}
                      @if (reclamoExistente.resueltoEn) {
                        • Resuelto: {{ reclamoExistente.resueltoEn | date:'dd/MM/yyyy HH:mm' }}
                      }
                    </p>
                  }
                </div>

                @if (reclamoExistente.estado === 'RESUELTO') {
                  <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                    <span class="text-base">✓</span>
                    <span>Tu reclamo ha sido atendido satisfactoriamente por nuestro equipo de atención al cliente.</span>
                  </div>
                } @else if (reclamoExistente.estado === 'RECHAZADO') {
                  <div class="p-3.5 rounded-xl bg-slate-800 border border-white/10 text-slate-300 text-xs flex items-center gap-2">
                    <span class="text-base">ℹ️</span>
                    <span>El reclamo fue revisado y concluido como no procedente. Para mayores consultas puedes comunicarte con el local.</span>
                  </div>
                } @else {
                  <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                    <span class="text-base">ℹ️</span>
                    <span>Tu solicitud está en cola de revisión por administración. En breve verás la resolución aquí.</span>
                  </div>
                }

                <button 
                  type="button"
                  (click)="showReportModal.set(false)"
                  class="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase transition cursor-pointer"
                >
                  Entendido / Cerrar
                </button>
              </div>
            } @else {
              <!-- Form -->
              <div class="space-y-4 text-xs">
                <div>
                  <label class="block text-slate-300 font-bold mb-1">Motivo del Reclamo</label>
                  <select 
                    [(ngModel)]="reportMotivo"
                    class="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                  >
                    <option value="PEDIDO_INCOMPLETO">Pedido Incompleto o Faltan Items</option>
                    <option value="DEMORA_EXCESIVA">Demora Excesiva en la Entrega</option>
                    <option value="PRODUCTO_FRIO">Producto Frío o en Mal Estado</option>
                    <option value="COBRO_ERRONEO">Cobro Erróneo / Error de Pago</option>
                    <option value="MALA_ATENCION">Mala Atención del Repartidor / Personal</option>
                    <option value="OTRO">Otro Motivo</option>
                  </select>
                </div>

                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label class="block text-slate-300 font-bold">Descripción detallada</label>
                    <span 
                      class="text-[10px] font-mono transition-colors"
                      [ngClass]="{
                        'text-rose-500 font-bold': reportDescripcion.length > 2000,
                        'text-amber-400': reportDescripcion.trim().length < 10 && reportDescripcion.length > 0,
                        'text-slate-400': reportDescripcion.trim().length >= 10 && reportDescripcion.length <= 2000
                      }"
                    >
                      {{ reportDescripcion.length }} / 2000 caracteres
                    </span>
                  </div>
                  <textarea 
                    [(ngModel)]="reportDescripcion"
                    rows="3"
                    maxlength="2050"
                    placeholder="Detalla qué sucedió con tu pedido (mínimo 10 caracteres)..."
                    class="w-full px-4 py-2.5 rounded-xl bg-black/50 border text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 resize-none"
                    [ngClass]="reportDescripcion.length > 2000 ? 'border-rose-500 focus:ring-rose-500' : 'border-white/10 focus:ring-rose-400'"
                  ></textarea>
                  @if (reportDescripcion.length > 0 && reportDescripcion.trim().length < 10) {
                    <p class="text-[10px] text-amber-400 mt-0.5">La descripción debe tener al menos 10 caracteres.</p>
                  }
                </div>

                <!-- Evidencia Fotográfica con Previsualización (Obligatoria) -->
                <div>
                  <label class="block text-slate-300 font-bold mb-1">
                    Evidencia Fotográfica <span class="text-rose-400 font-bold">*</span>
                  </label>
                  @if (!evidenciaPreview()) {
                    <label class="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl p-4 cursor-pointer hover:bg-white/5 hover:border-rose-400/50 transition">
                      <span class="text-rose-400 text-xl mb-1">📸</span>
                      <span class="text-xs text-white font-medium">Adjuntar foto del pedido dañado/faltante</span>
                      <span class="text-[10px] text-slate-400">JPG, PNG o WEBP (Máx 5MB) — Requerido para reclamos</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onEvidenciaFileSelected($event)" class="hidden">
                    </label>
                  } @else {
                    <div class="relative rounded-2xl overflow-hidden border border-white/20 max-h-40 bg-black/40">
                      <img [src]="evidenciaPreview()" alt="Previsualización evidencia" class="w-full h-40 object-cover">
                      <button 
                        type="button" 
                        (click)="removerEvidencia()" 
                        title="Eliminar y cambiar foto"
                        class="absolute top-2 right-2 bg-slate-900/90 hover:bg-rose-600 text-white rounded-full p-1.5 shadow-xl transition cursor-pointer border border-white/20 flex items-center justify-center w-7 h-7"
                      >
                        ✕
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Aviso dinámico de requisitos faltantes para habilitar el envío -->
              @if (!isFormReclamoValido()) {
                <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs space-y-1.5 animate-fade-in">
                  <div class="font-bold flex items-center gap-1.5 text-amber-400">
                    <span class="text-sm">⚠️</span>
                    <span>Faltan requisitos para habilitar el envío:</span>
                  </div>
                  <ul class="list-disc list-inside space-y-1 text-[11px] text-slate-300 pl-1">
                    @if (reportDescripcion.trim().length < 10) {
                      <li class="text-amber-200">
                        Descripción: ingresa al menos 10 caracteres (actualmente llevas {{ reportDescripcion.trim().length }}).
                      </li>
                    }
                    @if (reportDescripcion.length > 2000) {
                      <li class="text-rose-400 font-bold">
                        Descripción: excede el límite máximo de 2000 caracteres (elimina {{ reportDescripcion.length - 2000 }} caracteres).
                      </li>
                    }
                    @if (!selectedEvidenciaFile) {
                      <li class="text-amber-200">
                        Foto de evidencia: debes adjuntar una foto del pedido dañado o faltante (obligatorio).
                      </li>
                    }
                  </ul>
                </div>
              }

              <div class="flex gap-3 pt-2">
                <button 
                  type="button"
                  (click)="showReportModal.set(false)"
                  [disabled]="isSubmittingReport()"
                  class="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase cursor-pointer transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  (click)="enviarReclamo()"
                  [disabled]="!isFormReclamoValido() || isSubmittingReport()"
                  class="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase transition shadow-lg shadow-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  @if (isSubmittingReport()) {
                    <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Enviando...</span>
                  } @else {
                    <span>Enviar Reclamo</span>
                  }
                </button>
              </div>
            }

          </div>
        </div>
      }

    </div>
  `
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly ordersService = inject(OrdersService);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  readonly feedbackService = inject(FeedbackService);
  private paymentService = inject(PaymentService);

  readonly currentOrder = signal<Order | null>(null);
  readonly showDetailsModal = signal<boolean>(false);
  readonly showReportModal = signal<boolean>(false);
  readonly selectedStars = signal<number>(5);

  readonly reseniaDeOrdenActual = computed(() => {
    const order = this.currentOrder();
    if (!order) return null;
    const orderId = Number(order.id);
    return this.feedbackService.obtenerReseniaDeOrden(orderId);
  });

  readonly reclamoDeOrdenActual = computed(() => {
    const order = this.currentOrder();
    if (!order) return null;
    const orderId = Number(order.id);
    return this.feedbackService.obtenerReporteDeOrden(orderId);
  });

  /**
   * S5: solo el invitado (sin sesión) puede cancelar desde el seguimiento, y solo mientras el
   * pedido no esté en un estado terminal. Con sesión la cancelación la gestiona el flujo del
   * cliente autenticado.
   */
  readonly puedeCancelarPedido = computed(() => {
    const order = this.currentOrder();
    if (!order || this.auth.token()) return false;
    return !ESTADOS_TERMINALES.includes(order.estado);
  });

  readonly cancelandoPedido = signal<boolean>(false);

  // Time windows enforced by the backend (minutes)
  readonly VENTANA_CONFIRMACION_MIN = 15;
  readonly VENTANA_PAGO_MIN = 15;
  readonly VENTANA_PUERTA_MIN = 30;
  readonly VENTANA_RECOJO_MIN = 60;

  /** Clock tick so the countdowns re-render without a backend call. */
  readonly ahora = signal<number>(Date.now());

  // Payment proof upload (PENDIENTE_PAGO)
  readonly subiendoComprobante = signal<boolean>(false);
  readonly errorComprobante = signal<string>('');
  readonly comprobantesEnviados = signal<ReadonlySet<string>>(new Set());

  /** The proof control is for the customer's own wallet/transfer order awaiting payment. */
  readonly puedeSubirComprobante = computed(() => {
    const order = this.currentOrder();
    if (!order || order.estado !== 'PENDIENTE_PAGO') return false;
    if (order.metodoPago === 'TARJETA' || order.metodoPago === 'YAPE_OTP' || order.metodoPago === 'EFECTIVO_CONTRAENTREGA') {
      return false;
    }
    return this.availableOrders().some(o => o.id === order.id);
  });

  readonly comprobanteRecibido = computed(() => {
    const order = this.currentOrder();
    return !!order && this.comprobantesEnviados().has(String(order.id));
  });

  reviewComment = '';
  reportMotivo: MotivoReclamo = 'PEDIDO_INCOMPLETO';
  reportDescripcion = '';
  reportMonto = 0;
  selectedEvidenciaFile: File | null = null;
  readonly evidenciaPreview = signal<string | null>(null);
  readonly isSubmittingRating = signal<boolean>(false);
  readonly isSubmittingReport = signal<boolean>(false);

  // Seguimiento sin cuenta
  readonly pasoSeguimiento = signal<'CELULAR' | 'CODIGO'>('CELULAR');
  readonly procesandoSeguimiento = signal<boolean>(false);
  celularSeguimiento = '';
  codigoSeguimiento = '';

  private refrescoSub?: Subscription;
  private relojSub?: Subscription;
  private platformId = inject(PLATFORM_ID);
  readonly etiqueta = etiquetaPedido;

  readonly availableOrders = computed<Order[]>(() => {
    return this.ordersService.myOrders();
  });

  constructor() {
    effect(() => {
      const list = this.availableOrders();
      const actual = this.currentOrder();
      if (list.length > 0 && !actual) {
        this.currentOrder.set(list[0]);
        return;
      }
      // Mantener actualizado el pedido seleccionado cuando cambia su estado
      const refrescado = actual ? list.find(o => o.id === actual.id) : undefined;
      if (refrescado && refrescado !== actual) {
        this.currentOrder.set(refrescado);
      }
      if (actual?.id) {
        this.feedbackService.consultarReporteDeOrden(Number(actual.id)).subscribe();
      }
    });
  }

  ngOnInit(): void {
    // 1. Cargar los pedidos del cliente y refrescarlos para ver los cambios de estado
    this.ordersService.loadMyOrders();
    if (isPlatformBrowser(this.platformId)) {
      this.relojSub = interval(30000).subscribe(() => this.ahora.set(Date.now()));
      this.refrescoSub = interval(15000).subscribe(() => {
        this.ordersService.loadMyOrders();
        const current = this.currentOrder();
        if (current?.id) {
          this.feedbackService.consultarReporteDeOrden(Number(current.id)).subscribe();
        }
      });
    }

    // 2. Comprobar parámetros de la URL (soporta códigos internos y retornos de Mercado Pago)
    this.route.queryParams.subscribe(params => {
      // Retorno de Mercado Pago (status / collection_status)
      if (params['collection_status'] || params['status']) {
        const mpStatus = params['collection_status'] || params['status'];
        const externalRef = params['external_reference'];
        if (mpStatus === 'approved') {
          this.notify.showSuccess('¡Tu pago en Mercado Pago ha sido aprobado con éxito!');
        } else if (mpStatus === 'pending' || mpStatus === 'in_process') {
          this.notify.showInfo('Pago en proceso', 'Tu pago en Mercado Pago se encuentra en revisión.');
        } else if (mpStatus === 'rejected') {
          this.notify.showError('El pago en Mercado Pago fue rechazado.');
        }
        if (externalRef) {
          this.loadOrder(externalRef);
        }
      }

      if (params['code']) {
        this.loadOrder(params['code']);
      }
    });
  }

  ngOnDestroy(): void {
    this.refrescoSub?.unsubscribe();
    this.relojSub?.unsubscribe();
    this.removerEvidencia();
  }

  /** Validates and uploads the payment proof; the state shown comes from the backend response. */
  onComprobanteSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const order = this.currentOrder();
    if (!file || !order || this.subiendoComprobante()) return;

    if (!TIPOS_COMPROBANTE.includes(file.type)) {
      this.errorComprobante.set('El comprobante debe ser una imagen JPG, PNG o WEBP.');
      return;
    }
    if (file.size > MAX_COMPROBANTE_BYTES) {
      this.errorComprobante.set('El comprobante supera el máximo de 5 MB.');
      return;
    }

    this.errorComprobante.set('');
    this.subiendoComprobante.set(true);
    this.paymentService.subirComprobante(order.id, file).subscribe({
      next: () => {
        this.subiendoComprobante.set(false);
        this.comprobantesEnviados.update(prev => new Set(prev).add(String(order.id)));
        this.notify.showSuccess('Comprobante recibido', 'Estamos verificando tu pago.');
        this.ordersService.loadMyOrders();
      },
      error: (err: Error) => {
        this.subiendoComprobante.set(false);
        this.errorComprobante.set(err?.message || 'No se pudo enviar el comprobante.');
      }
    });
  }

  selectOrder(order: Order): void {
    this.currentOrder.set(order);
    this.reviewComment = '';
    this.selectedStars.set(5);
    this.reportDescripcion = '';
    this.removerEvidencia();
    if (order?.id) {
      this.feedbackService.consultarReporteDeOrden(Number(order.id)).subscribe();
    }
  }

  abrirModalReclamo(): void {
    this.showReportModal.set(true);
  }

  getMotivoLabel(motivo?: string): string {
    switch (motivo) {
      case 'PEDIDO_INCOMPLETO': return 'Pedido Incompleto o Faltan Items';
      case 'DEMORA_EXCESIVA': return 'Demora Excesiva en la Entrega';
      case 'PRODUCTO_FRIO': return 'Producto Frío o en Mal Estado';
      case 'COBRO_ERRONEO': return 'Cobro Erróneo / Error de Pago';
      case 'MALA_ATENCION': return 'Mala Atención del Repartidor / Personal';
      default: return motivo || 'Otro Motivo';
    }
  }

  // ================= SEGUIMIENTO SIN CUENTA =================

  enviarCodigo(): void {
    const celular = this.celularSeguimiento.replace(/\D/g, '').replace(/^51(?=\d{9}$)/, '');
    if (!/^9\d{8}$/.test(celular)) {
      this.notify.showError('Ingresa un celular válido', 'Debe tener 9 dígitos y empezar con 9');
      return;
    }
    this.celularSeguimiento = celular;
    this.procesandoSeguimiento.set(true);
    this.ordersService.solicitarCodigoSeguimiento(celular).subscribe({
      next: mensaje => {
        this.procesandoSeguimiento.set(false);
        this.codigoSeguimiento = '';
        this.pasoSeguimiento.set('CODIGO');
        this.notify.showInfo('Revisa tu WhatsApp', mensaje);
      },
      error: err => {
        this.procesandoSeguimiento.set(false);
        this.notify.showError(err.message);
      }
    });
  }

  verificarCodigo(): void {
    if (!/^\d{4}$/.test(this.codigoSeguimiento)) {
      this.notify.showError('El código tiene 4 dígitos');
      return;
    }
    this.procesandoSeguimiento.set(true);
    this.ordersService.verificarCodigoSeguimiento(this.celularSeguimiento, this.codigoSeguimiento).subscribe({
      next: () => {
        this.procesandoSeguimiento.set(false);
        this.currentOrder.set(null);
        this.notify.showSuccess('Celular verificado');
      },
      error: err => {
        this.procesandoSeguimiento.set(false);
        this.notify.showError(err.message);
      }
    });
  }

  cambiarCelular(): void {
    this.ordersService.cerrarSeguimiento();
    this.currentOrder.set(null);
    this.codigoSeguimiento = '';
    this.pasoSeguimiento.set('CELULAR');
  }

  /**
   * S5: el invitado cancela su pedido con el acceso de seguimiento y recarga la lista para ver el
   * nuevo estado sin esperar al siguiente refresco automático.
   */
  cancelarPedido(): void {
    const order = this.currentOrder();
    if (!order || !this.puedeCancelarPedido() || this.cancelandoPedido()) return;
    if (!confirm(`¿Seguro que quieres cancelar el pedido ${this.etiqueta(order)}?`)) return;

    this.cancelandoPedido.set(true);
    this.ordersService.cancelarPedidoInvitado(order.id).subscribe({
      next: () => {
        this.cancelandoPedido.set(false);
        this.notify.showSuccess('Pedido cancelado');
        this.ordersService.loadMyOrders();
      },
      error: err => {
        this.cancelandoPedido.set(false);
        this.notify.showError('No se pudo cancelar el pedido', err.message);
      }
    });
  }

  formatearCelular(celular: string): string {
    return celular.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
  }

  loadOrder(code: string): void {
    if (!code) return;
    this.ordersService.getOrderByTrackingCode(code).subscribe({
      next: (found) => {
        if (found) {
          this.currentOrder.set(found);
          this.ordersService.registerClientOrder(found);
        } else {
          const matching = this.availableOrders().find(
            o => o.codigoSeguimiento.toUpperCase() === code.toUpperCase() || o.id === code.replace('POL-', '')
          );
          if (matching) {
            this.currentOrder.set(matching);
          }
        }
      },
      error: () => {
        const matching = this.availableOrders().find(
          o => o.codigoSeguimiento.toUpperCase() === code.toUpperCase() || o.id === code.replace('POL-', '')
        );
        if (matching) {
          this.currentOrder.set(matching);
        }
      }
    });
  }

  // ================= DYNAMIC STATUS HELPERS =================

  /**
   * Stepper stage of an order status: 0 = waiting for call/payment verification, 1 = received,
   * 2 = preparing, 3 = ready / on the way / at the door, 4 = delivered, -1 = closed without delivery.
   */
  etapaPedido(status?: OrderStatus): number {
    switch (status) {
      case 'PENDIENTE_CONFIRMACION':
      case 'PENDIENTE_PAGO':
        return 0;
      case 'RECIBIDO':
      case 'PAGADO':
        return 1;
      case 'PREPARANDO':
      case 'EN_PREPARACION':
        return 2;
      case 'LISTO':
      case 'LISTO_PARA_ENTREGAR':
      case 'LISTO_COCINA':
      case 'EN_CAMINO':
      case 'EN_REPARTO':
      case 'EN_PUERTA':
        return 3;
      case 'ENTREGADO':
      case 'COMPLETADO':
        return 4;
      case 'CANCELADO':
      case 'PEDIDO_FANTASMA':
        return -1;
      default:
        return 1;
    }
  }

  /** Whole minutes left of a window that started at `desde`; null when there is no start time. */
  minutosRestantes(desde: string | undefined, ventanaMin: number): number | null {
    if (!desde) return null;
    const inicio = Date.parse(desde);
    if (Number.isNaN(inicio)) return null;
    const restanteMs = inicio + ventanaMin * 60_000 - this.ahora();
    return Math.max(0, Math.ceil(restanteMs / 60_000));
  }

  private esRecojo(order: Order | null): boolean {
    return order?.tipo === 'RECOJO_EN_TIENDA';
  }

  /** Short countdown line shown under the subtitle; empty when the status has no running window. */
  getCuentaRegresiva(): string {
    const order = this.currentOrder();
    if (!order) return '';
    switch (order.estado) {
      case 'PENDIENTE_CONFIRMACION': {
        const min = this.minutosRestantes(order.createdAt, this.VENTANA_CONFIRMACION_MIN);
        return min === null ? '' : `Tiempo restante para confirmar: ${min} min`;
      }
      case 'PENDIENTE_PAGO': {
        const min = this.minutosRestantes(order.createdAt, this.VENTANA_PAGO_MIN);
        return min === null ? '' : `Tiempo restante para verificar el pago: ${min} min`;
      }
      case 'EN_PUERTA': {
        const min = this.minutosRestantes(order.enPuertaAt, this.VENTANA_PUERTA_MIN);
        return min === null ? '' : `Tu repartidor te espera: ${min} min`;
      }
      case 'LISTO':
      case 'LISTO_PARA_ENTREGAR': {
        if (!this.esRecojo(order)) return '';
        const min = this.minutosRestantes(order.listoAt, this.VENTANA_RECOJO_MIN);
        return min === null ? '' : `Tiempo para recoger: ${min} min`;
      }
      default:
        return '';
    }
  }

  getMainTitle(): string {
    const order = this.currentOrder();
    switch (order?.estado) {
      case 'COMPLETADO':
      case 'ENTREGADO':
        return '¡PEDIDO ENTREGADO CON ÉXITO!';
      case 'EN_PUERTA':
        return 'TU REPARTIDOR ESTÁ EN LA PUERTA';
      case 'EN_CAMINO':
      case 'EN_REPARTO':
        return 'EL FUEGO ESTÁ EN CAMINO';
      case 'LISTO':
      case 'LISTO_PARA_ENTREGAR':
      case 'LISTO_COCINA':
        return this.esRecojo(order) ? '¡LISTO PARA RECOGER!' : '¡PEDIDO LISTO EN SALIDA!';
      case 'EN_PREPARACION':
      case 'PREPARANDO':
        return 'EL FUEGO ESTÁ EN LA COCINA';
      case 'PENDIENTE_CONFIRMACION':
        return 'TE LLAMAREMOS PARA CONFIRMAR';
      case 'PENDIENTE_PAGO':
        return 'PAGO PENDIENTE DE VERIFICACIÓN';
      case 'PAGADO':
      case 'RECIBIDO':
        return 'PEDIDO RECIBIDO';
      case 'PEDIDO_FANTASMA':
        return 'PEDIDO NO ENTREGADO';
      case 'CANCELADO':
        return 'PEDIDO CANCELADO';
      default:
        return 'ESTADO DEL PEDIDO';
    }
  }

  getSubtitle(): string {
    const order = this.currentOrder();
    switch (order?.estado) {
      case 'COMPLETADO':
      case 'ENTREGADO':
        return 'Tu pedido ha sido entregado. ¡Buen provecho y gracias por elegir San Pollo!';
      case 'EN_PUERTA': {
        const min = this.minutosRestantes(order?.enPuertaAt, this.VENTANA_PUERTA_MIN);
        return min === 0
          ? 'Tu repartidor superó los 30 minutos de espera en tu puerta; el pedido puede darse por no entregado.'
          : 'Tu repartidor llegó a tu dirección. Sal a recibir tu pedido; te esperará hasta 30 minutos.';
      }
      case 'EN_CAMINO':
      case 'EN_REPARTO':
        return 'Tu repartidor va en ruta a tu dirección.';
      case 'LISTO':
      case 'LISTO_PARA_ENTREGAR':
        return this.esRecojo(order)
          ? 'Tu pedido está listo. Recógelo con tu ticket dentro de 1 hora.'
          : 'Tu pedido está listo y será despachado inmediatamente.';
      case 'LISTO_COCINA':
        return 'Tu pedido ha salido del horno y está listo para ser despachado inmediatamente.';
      case 'EN_PREPARACION':
      case 'PREPARANDO':
        return 'Nuestros maestros polleros están dorando tu pedido a la leña con papas crujientes.';
      case 'PENDIENTE_CONFIRMACION': {
        const min = this.minutosRestantes(order?.createdAt, this.VENTANA_CONFIRMACION_MIN);
        return min === 0
          ? 'Terminó el tiempo de confirmación. Si no recibiste la llamada, el pedido se cancelará automáticamente.'
          : 'Te llamaremos al celular que registraste para confirmar tu pedido antes de enviarlo a cocina.';
      }
      case 'PENDIENTE_PAGO':
        return 'Aún no confirmamos tu pago. Cuando lo verifiquemos, el pedido pasará a cocina; si pasan 15 minutos sin pago verificado, se cancela.';
      case 'PAGADO':
      case 'RECIBIDO':
        return 'Hemos registrado tu pedido.';
      case 'PEDIDO_FANTASMA':
        return 'Tu pedido fue marcado como no entregado porque no pudo ser recibido a tiempo.';
      case 'CANCELADO':
        return 'Este pedido ha sido cancelado.';
      default:
        return 'Monitoreo en tiempo real del estado de tu comanda.';
    }
  }

  getProgressWidth(): string {
    const status = this.currentOrder()?.estado;
    if (status === 'EN_PUERTA') return '90%';
    switch (this.etapaPedido(status)) {
      case 0: return '10%';
      case 1: return '25%';
      case 2: return '50%';
      case 3: return '75%';
      case 4: return '100%';
      default: return '0%';
    }
  }

  isStepCompleted(step: number): boolean {
    const status = this.currentOrder()?.estado;
    if (!status) return false;
    const etapa = this.etapaPedido(status);
    switch (step) {
      case 1: return etapa >= 1;
      case 2: return etapa >= 3;
      case 3: return etapa >= 4;
      case 4: return etapa === 4;
      default: return false;
    }
  }

  isStepActive(step: number): boolean {
    const status = this.currentOrder()?.estado;
    if (!status) return false;
    const etapa = this.etapaPedido(status);
    switch (step) {
      case 1: return etapa === 0 || etapa === 1;
      case 2: return etapa === 2;
      case 3: return etapa === 3;
      case 4: return etapa === 4;
      default: return false;
    }
  }

  getStepBadgeClass(step: number): string {
    if (this.isStepCompleted(step) && !this.isStepActive(step)) {
      return 'bg-polleria-gold text-slate-950 font-bold shadow-lg shadow-amber-500/30 ring-2 ring-polleria-gold/50';
    }
    if (this.isStepActive(step)) {
      if (step === 4) {
        return 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_20px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/50';
      }
      return 'bg-black border-2 border-polleria-gold text-polleria-gold shadow-[0_0_15px_rgba(245,158,11,0.4)]';
    }
    return 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60';
  }

  getStepTextClass(step: number): string {
    if (this.isStepActive(step)) {
      return step === 4 ? 'text-emerald-400 font-extrabold' : 'text-polleria-gold font-extrabold';
    }
    if (this.isStepCompleted(step)) {
      return 'text-white font-bold';
    }
    return 'text-slate-500';
  }

  getStep3Title(): string {
    const order = this.currentOrder();
    if (order?.tipo === 'SALON') return 'Listo en Mesa';
    return this.esRecojo(order) ? 'Listo para recoger' : 'En camino';
  }

  getStepSubtitle(step: number): string {
    const order = this.currentOrder();
    const status = order?.estado;
    switch (step) {
      case 1:
        if (status === 'PENDIENTE_CONFIRMACION') return 'Esperando llamada';
        if (status === 'PENDIENTE_PAGO') return 'Pago por verificar';
        if (status === 'RECIBIDO') return 'Recibido';
        return this.isStepCompleted(1) ? 'Confirmado' : 'Pendiente';
      case 2:
        return this.isStepActive(2) ? 'En el horno...' : (this.isStepCompleted(2) ? 'Listo' : 'Pendiente');
      case 3:
        if (status === 'EN_PUERTA') return 'En tu puerta';
        if (this.isStepActive(3)) return this.esRecojo(order) ? 'Listo' : 'En ruta';
        return this.isStepCompleted(3) ? 'Entregado' : 'Pendiente';
      case 4:
        return this.etapaPedido(status) === 4 ? '¡Entregado!' : '--:--';
      default:
        return '';
    }
  }

  getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case 'PENDIENTE_CONFIRMACION': return 'Llamada Pendiente';
      case 'PENDIENTE_PAGO': return 'Pendiente de Pago';
      case 'RECIBIDO': return 'Recibido';
      case 'PAGADO': return 'Pagado';
      case 'PREPARANDO':
      case 'EN_PREPARACION': return 'En Preparación';
      case 'LISTO':
      case 'LISTO_PARA_ENTREGAR':
      case 'LISTO_COCINA': return 'Listo';
      case 'EN_CAMINO':
      case 'EN_REPARTO': return 'En Camino';
      case 'EN_PUERTA': return '¡En tu Puerta!';
      case 'ENTREGADO':
      case 'COMPLETADO': return 'Completado';
      case 'CANCELADO': return 'Cancelado';
      case 'PEDIDO_FANTASMA': return 'No Entregado';
      default: return status;
    }
  }

  toggleDetailsModal(open: boolean): void {
    this.showDetailsModal.set(open);
  }

  contactRider(): void {
    // El backend solo guarda el id del repartidor, y su nombre vive en el roster de auth-service,
    // que exige rol ADMIN: un cliente no puede leerlo. Sin nombre real no se inventa uno.
    if (!this.currentOrder()?.repartidorId) {
      this.notify.showInfo(
        'Motorizado aún sin asignar',
        'Todavía no se asignó un motorizado a tu pedido. Aparecerá aquí cuando salga a reparto.'
      );
      return;
    }

    this.notify.showInfo(
      'Motorizado asignado',
      'Un motorizado está a cargo de tu entrega. Te contactará al llegar.'
    );
  }

  onEvidenciaFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      this.notify.showWarning('Formato no permitido', 'Solo puedes adjuntar fotos en formato JPG, PNG o WEBP.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.notify.showWarning('Archivo muy pesado', 'La imagen no debe superar los 5 MB.');
      input.value = '';
      return;
    }
    this.selectedEvidenciaFile = file;
    if (this.evidenciaPreview()) {
      URL.revokeObjectURL(this.evidenciaPreview()!);
    }
    this.evidenciaPreview.set(URL.createObjectURL(file));
  }

  removerEvidencia(): void {
    if (this.evidenciaPreview()) {
      URL.revokeObjectURL(this.evidenciaPreview()!);
    }
    this.selectedEvidenciaFile = null;
    this.evidenciaPreview.set(null);
  }

  isFormReclamoValido(): boolean {
    const desc = this.reportDescripcion.trim();
    return !!this.reportMotivo &&
      desc.length >= 10 &&
      desc.length <= 2000 &&
      this.selectedEvidenciaFile !== null;
  }

  enviarCalificacion(): void {
    const order = this.currentOrder();
    if (!order || this.reviewComment.trim().length < 10 || this.isSubmittingRating()) return;
    const orderIdNum = Number(order.id) || 1;
    const estrellas = this.selectedStars();
    const comentario = this.reviewComment.trim();

    this.isSubmittingRating.set(true);
    this.feedbackService.calificarPedido({
      ordenId: orderIdNum,
      estrellas,
      comentario
    }).subscribe({
      next: () => {
        this.isSubmittingRating.set(false);
        this.feedbackService.guardarReseniaLocal(orderIdNum, estrellas, comentario);
        this.reviewComment = '';
        this.notify.showSuccess('¡Muchas gracias por calificar tu pedido!');
      },
      error: (err) => {
        this.isSubmittingRating.set(false);
        if (err.status === 409) {
          this.feedbackService.guardarReseniaLocal(orderIdNum, estrellas, comentario);
          this.reviewComment = '';
          this.notify.showInfo('Calificación ya registrada', 'Ya habías enviado una calificación para esta orden.');
        } else {
          this.notify.showError('No se pudo registrar la calificación', err.error?.message || 'Intente nuevamente más tarde.');
        }
      }
    });
  }

  enviarReclamo(): void {
    const order = this.currentOrder();
    if (!order || !this.isFormReclamoValido() || this.isSubmittingReport()) return;

    this.isSubmittingReport.set(true);
    const orderIdNum = Number(order.id) || 1;
    const motivo = this.reportMotivo;
    const desc = this.reportDescripcion.trim();

    this.feedbackService.crearReporteMultipart(
      orderIdNum,
      motivo,
      desc,
      this.selectedEvidenciaFile || undefined
    ).subscribe({
      next: (nuevo) => {
        this.isSubmittingReport.set(false);
        this.feedbackService.guardarReporteLocal(orderIdNum, {
          id: nuevo.id,
          motivo,
          descripcion: desc,
          estado: nuevo.estado
        });
        this.showReportModal.set(false);
        this.reportDescripcion = '';
        this.removerEvidencia();
        this.notify.showSuccess('Tu reclamo fue registrado en el libro de reclamaciones.');
      },
      error: (err) => {
        this.isSubmittingReport.set(false);
        if (err.status === 409) {
          this.feedbackService.guardarReporteLocal(orderIdNum, {
            motivo,
            descripcion: desc,
            estado: 'ABIERTO'
          });
          this.showReportModal.set(false);
          this.removerEvidencia();
          this.notify.showInfo('Reclamo ya registrado', 'Ya existe un reclamo en proceso para esta orden.');
        } else {
          this.notify.showError('No se pudo registrar el reclamo', err.error?.message || 'Error al procesar el reclamo.');
        }
      }
    });
  }
}
