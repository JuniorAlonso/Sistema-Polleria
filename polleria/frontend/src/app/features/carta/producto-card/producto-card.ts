import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgIf, CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Producto } from '../../../core/models/orden.models';

@Component({
  selector: 'app-producto-card',
  standalone: true,
  imports: [
    NgIf,
    CurrencyPipe,
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './producto-card.html',
  styles: [`
    mat-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      transition: box-shadow 0.2s ease;
    }
    mat-card:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    }
    .product-image {
      width: 100%;
      height: 160px;
      object-fit: cover;
    }
    .product-image-placeholder {
      width: 100%;
      height: 160px;
      background: linear-gradient(135deg, #ff6d00 0%, #ffca28 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4rem;
    }
    .product-name {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .product-description {
      font-size: 0.8rem;
      color: #757575;
      margin-bottom: 8px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .product-price {
      font-size: 1.2rem;
      font-weight: 700;
      color: #e65100;
    }
    .product-footer {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 8px;
    }
    .categoria-chip {
      font-size: 0.7rem;
    }
    .not-available {
      color: #9e9e9e;
      font-size: 0.8rem;
      font-style: italic;
    }
  `],
})
export class ProductoCard {
  @Input() producto!: Producto;
  @Output() agregar = new EventEmitter<Producto>();

  onAgregar(): void {
    if (this.producto.disponible) {
      this.agregar.emit(this.producto);
    }
  }
}
