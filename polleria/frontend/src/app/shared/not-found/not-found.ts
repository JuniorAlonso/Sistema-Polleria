import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './not-found.html',
  styles: [`
    .not-found-container {
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px;
    }
    .emoji {
      font-size: 6rem;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 6rem;
      font-weight: 900;
      color: #e65100;
      line-height: 1;
      margin: 0;
    }
    h2 {
      font-size: 1.5rem;
      color: #424242;
      margin: 8px 0 24px;
    }
    p {
      color: #757575;
      margin-bottom: 32px;
      max-width: 400px;
    }
  `],
})
export class NotFoundComponent {}

