import { TemplateService } from '../../domain/ports/template-service.port';
import { SendTemplateRequest, SendTemplateResponse } from '../../domain/entities/send-template';

export class TemplateServiceImpl implements TemplateService {
  async sendTemplate(request: SendTemplateRequest): Promise<SendTemplateResponse> {
    try {
      const response = await fetch('/api/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationLine: request.destinationLine,
          conversationId: request.conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Request failed with status ${response.status}`,
        };
      }

      return { success: true, message: data.message };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}
