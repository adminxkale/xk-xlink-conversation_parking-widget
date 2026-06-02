import { InteractionService } from '../../domain/ports/interaction-service.port';
import { NotificationService } from '../../domain/ports/notification-service.port';
import { TemplateService } from '../../domain/ports/template-service.port';
// import { MockInteractionService } from '../services/mock-interaction.service';
import { GenesysNotificationService } from '../services/genesys-notification.service';
import { RealInteractionService } from '../services/real-interaction.service';
import { TemplateServiceImpl } from '../services/template.service';

// --- Swap implementations here ---
// const interactionService: InteractionService = new MockInteractionService();
const interactionService: InteractionService = new RealInteractionService();

const templateService: TemplateService = new TemplateServiceImpl();

let notificationService: NotificationService | null = null;

export function getInteractionService(): InteractionService {
  return interactionService;
}

export function getTemplateService(): TemplateService {
  return templateService;
}

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new GenesysNotificationService();
  }
  return notificationService;
}