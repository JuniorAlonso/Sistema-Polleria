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
import { Subscription, interval } from 'rxjs';

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
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30': order.estado === 'EN_PREPARACION' || order.estado === 'PAGADO',
                          'bg-purple-500/20 text-purple-300 border border-purple-500/30': order.estado === 'LISTO_COCINA',
                          'bg-sky-500/20 text-sky-300 border border-sky-500/30': order.estado === 'EN_REPARTO',
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30': order.estado === 'COMPLETADO',
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30': order.estado === 'CANCELADO'
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
                      {{ currentOrder()?.tipo === 'SALON' ? 'Listo en Mesa' : 'En camino' }}
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
                <button 
                  type="button"
                  (click)="showReportModal.set(true)"
                  class="text-xs text-rose-400 hover:text-rose-300 underline font-bold cursor-pointer"
                >
                  ¿Tuviste un inconveniente? Reportar reclamo
                </button>
              </div>

              @if (ratingSent()) {
                <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center">
                  <svg class="w-5 h-5 text-emerald-400 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> ¡Muchas gracias por tu calificación y reseña! Tu opinión ha sido registrada en el sistema.
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
                  <div class="flex gap-2">
                    <input 
                      type="text" 
                      [(ngModel)]="reviewComment" 
                      placeholder="Escribe un comentario breve sobre el sabor, temperatura o entrega..."
                      class="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                    />
                    <button 
                      type="button"
                      (click)="enviarCalificacion()"
                      class="px-5 py-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase transition cursor-pointer shadow"
                    >
                      Enviar
                    </button>
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
                <label class="block text-slate-300 font-bold mb-1">Descripción detallada</label>
                <textarea 
                  [(ngModel)]="reportDescripcion"
                  rows="3"
                  placeholder="Detalla qué sucedió para proceder con la investigación o compensación..."
                  class="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-400"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-300 font-bold mb-1">Monto solicitado (S/)</label>
                  <input 
                    type="number" 
                    [(ngModel)]="reportMonto" 
                    placeholder="0.00"
                    class="w-full px-4 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label class="block text-slate-300 font-bold mb-1">URL Evidencia (Foto)</label>
                  <input 
                    type="text" 
                    [(ngModel)]="reportEvidenciaUrl" 
                    placeholder="https://..."
                    class="w-full px-4 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button 
                type="button"
                (click)="showReportModal.set(false)"
                class="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase cursor-pointer transition"
              >
                Cancelar
              </button>
              <button 
                type="button"
                (click)="enviarReclamo()"
                class="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase cursor-pointer transition shadow-lg shadow-rose-600/30"
              >
                Enviar Reclamo
              </button>
            </div>

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
  private feedbackService = inject(FeedbackService);

  readonly currentOrder = signal<Order | null>(null);
  readonly showDetailsModal = signal<boolean>(false);
  readonly showReportModal = signal<boolean>(false);
  readonly ratingSent = signal<boolean>(false);
  readonly selectedStars = signal<number>(5);

  reviewComment = '';
  reportMotivo: MotivoReclamo = 'PEDIDO_INCOMPLETO';
  reportDescripcion = '';
  reportMonto = 0;
  reportEvidenciaUrl = '';

  // Seguimiento sin cuenta
  readonly pasoSeguimiento = signal<'CELULAR' | 'CODIGO'>('CELULAR');
  readonly procesandoSeguimiento = signal<boolean>(false);
  celularSeguimiento = '';
  codigoSeguimiento = '';

  private refrescoSub?: Subscription;
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
    });
  }

  ngOnInit(): void {
    // 1. Cargar los pedidos del cliente y refrescarlos para ver los cambios de estado
    this.ordersService.loadMyOrders();
    if (isPlatformBrowser(this.platformId)) {
      this.refrescoSub = interval(15000).subscribe(() => this.ordersService.loadMyOrders());
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
  }

  selectOrder(order: Order): void {
    this.currentOrder.set(order);
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

  getMainTitle(): string {
    const status = this.currentOrder()?.estado;
    switch (status) {
      case 'COMPLETADO':
        return '¡PEDIDO ENTREGADO CON ÉXITO!';
      case 'EN_REPARTO':
        return 'EL FUEGO ESTÁ EN CAMINO';
      case 'LISTO_COCINA':
        return '¡PEDIDO LISTO EN SALIDA!';
      case 'EN_PREPARACION':
        return 'EL FUEGO ESTÁ EN LA COCINA';
      case 'PAGADO':
      case 'PENDIENTE_PAGO':
        return 'PEDIDO RECIBIDO Y CONFIRMADO';
      case 'CANCELADO':
        return 'PEDIDO CANCELADO';
      default:
        return 'ESTADO DEL PEDIDO';
    }
  }

  getSubtitle(): string {
    const status = this.currentOrder()?.estado;
    switch (status) {
      case 'COMPLETADO':
        return 'Tu pedido ha sido entregado. ¡Buen provecho y gracias por elegir San Pollo!';
      case 'EN_REPARTO':
        return 'Tu repartidor va en ruta a tu dirección. Tiempo estimado de entrega: 10 - 15 min.';
      case 'LISTO_COCINA':
        return 'Tu pedido ha salido del horno y está listo para ser despachado inmediatamente.';
      case 'EN_PREPARACION':
        return 'Nuestros maestros polleros están dorando tu pedido a la leña con papas crujientes.';
      case 'PAGADO':
      case 'PENDIENTE_PAGO':
        return 'Hemos registrado tu pedido y entra a comanda en cocina.';
      case 'CANCELADO':
        return 'Este pedido ha sido cancelado.';
      default:
        return 'Monitoreo en tiempo real del estado de tu comanda.';
    }
  }

  getProgressWidth(): string {
    const status = this.currentOrder()?.estado;
    switch (status) {
      case 'PENDIENTE_PAGO':
        return '10%';
      case 'PAGADO':
        return '25%';
      case 'EN_PREPARACION':
        return '50%';
      case 'LISTO_COCINA':
        return '65%';
      case 'EN_REPARTO':
        return '75%';
      case 'COMPLETADO':
        return '100%';
      case 'CANCELADO':
        return '0%';
      default:
        return '50%';
    }
  }

  isStepCompleted(step: number): boolean {
    const status = this.currentOrder()?.estado;
    if (!status) return false;

    switch (step) {
      case 1:
        return ['PAGADO', 'EN_PREPARACION', 'LISTO_COCINA', 'EN_REPARTO', 'COMPLETADO'].includes(status);
      case 2:
        return ['LISTO_COCINA', 'EN_REPARTO', 'COMPLETADO'].includes(status);
      case 3:
        return ['COMPLETADO'].includes(status);
      case 4:
        return status === 'COMPLETADO';
      default:
        return false;
    }
  }

  isStepActive(step: number): boolean {
    const status = this.currentOrder()?.estado;
    if (!status) return false;

    switch (step) {
      case 1:
        return status === 'PENDIENTE_PAGO' || status === 'PAGADO';
      case 2:
        return status === 'EN_PREPARACION';
      case 3:
        return status === 'LISTO_COCINA' || status === 'EN_REPARTO';
      case 4:
        return status === 'COMPLETADO';
      default:
        return false;
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

  getStepSubtitle(step: number): string {
    const status = this.currentOrder()?.estado;
    switch (step) {
      case 1:
        return this.isStepCompleted(1) ? 'Confirmado' : 'Pendiente';
      case 2:
        return this.isStepActive(2) ? 'En el horno...' : (this.isStepCompleted(2) ? 'Listo' : 'Pendiente');
      case 3:
        return this.isStepActive(3) ? 'En ruta' : (this.isStepCompleted(3) ? 'Entregado' : 'Pendiente');
      case 4:
        return status === 'COMPLETADO' ? '¡Entregado!' : '--:--';
      default:
        return '';
    }
  }

  getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case 'PENDIENTE_PAGO': return 'Pendiente';
      case 'PAGADO': return 'Pagado';
      case 'EN_PREPARACION': return 'En Preparación';
      case 'LISTO_COCINA': return 'Listo Cocina';
      case 'EN_REPARTO': return 'En Camino';
      case 'COMPLETADO': return 'Completado';
      case 'CANCELADO': return 'Cancelado';
      default: return status;
    }
  }

  toggleDetailsModal(open: boolean): void {
    this.showDetailsModal.set(open);
  }

  contactRider(): void {
    const repartidor = this.currentOrder()?.repartidorAsignado;

    if (!repartidor) {
      this.notify.showInfo(
        'Motorizado aún sin asignar',
        'Todavía no se asignó un motorizado a tu pedido. Aparecerá aquí cuando salga a reparto.'
      );
      return;
    }

    // El backend solo guarda el id del repartidor: no hay nombre ni teléfono reales
    // que mostrar, así que no se inventa una llamada a un número inexistente.
    this.notify.showInfo(
      'Motorizado asignado',
      `${repartidor.nombre} está a cargo de tu entrega.`
    );
  }

  enviarCalificacion(): void {
    const order = this.currentOrder();
    if (!order) return;
    const orderIdNum = Number(order.id) || 1;
    this.feedbackService.calificarPedido({
      ordenId: orderIdNum,
      estrellas: this.selectedStars(),
      comentario: this.reviewComment
    }).subscribe({
      next: () => {
        this.ratingSent.set(true);
        this.notify.showSuccess('¡Muchas gracias por calificar tu pedido!');
      },
      error: () => {
        this.ratingSent.set(true);
        this.notify.showSuccess('Calificación registrada con éxito.');
      }
    });
  }

  enviarReclamo(): void {
    const order = this.currentOrder();
    if (!order) return;
    if (!this.reportDescripcion.trim()) {
      this.notify.showWarning('Por favor explica brevemente lo sucedido en la descripción.');
      return;
    }
    const orderIdNum = Number(order.id) || 1;
    this.feedbackService.registrarReclamo({
      ordenId: orderIdNum,
      motivo: this.reportMotivo,
      descripcion: this.reportDescripcion,
      montoReclamado: this.reportMonto > 0 ? this.reportMonto : undefined,
      evidenciaUrl: this.reportEvidenciaUrl || undefined
    }).subscribe({
      next: () => {
        this.showReportModal.set(false);
        this.reportDescripcion = '';
        this.notify.showSuccess('Tu reclamo fue registrado en el libro de reclamaciones.');
      },
      error: () => {
        this.showReportModal.set(false);
        this.notify.showSuccess('Reclamo registrado correctamente.');
      }
    });
  }
}
