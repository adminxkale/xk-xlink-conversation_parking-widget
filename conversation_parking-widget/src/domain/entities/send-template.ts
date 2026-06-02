export interface SendTemplateRequest {
  destinationLine: string;
  conversationId: string;
}

export interface SendTemplateResponse {
  success: boolean;
  message?: string;
  error?: string;
}
