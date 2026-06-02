import { SendTemplateRequest, SendTemplateResponse } from '../entities/send-template';

export interface TemplateService {
  sendTemplate(request: SendTemplateRequest): Promise<SendTemplateResponse>;
}
