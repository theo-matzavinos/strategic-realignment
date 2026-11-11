import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { finishLaunchRendering } from '@loozo/angular-launch/server';
import { App } from './app/app';
import { config } from './app/app.config.server';

export default async function bootstrap(context: BootstrapContext) {
  const app = await bootstrapApplication(App, config, context);

  return finishLaunchRendering(app);
}
