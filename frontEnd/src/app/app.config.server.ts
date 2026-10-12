import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRouting } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

// `provideServerRouting` es lo que hace efectivos los modos de render de `app.routes.server.ts`.
// Sin él, el servidor renderiza todas las rutas (incluidas las protegidas) y sus servicios piden
// datos sin sesión.
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting(serverRoutes),
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
