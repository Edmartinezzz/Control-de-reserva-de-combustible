import axios from 'axios';

type WhatsAppClientOptions = {
  baseUrl?: string;
  accessToken?: string;
  phoneNumberId?: string;
};

export class WhatsAppClient {
  private baseUrl: string;
  private accessToken: string;
  private phoneNumberId: string;

  constructor(opts: WhatsAppClientOptions = {}) {
    this.baseUrl = opts.baseUrl || process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com/v20.0';
    this.accessToken = opts.accessToken || process.env.WHATSAPP_TOKEN || '';
    this.phoneNumberId = opts.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  isConfigured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  async sendTextMessage(to: string, body: string) {
    if (!this.isConfigured()) {
      return { skipped: true } as const;
    }
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const headers = { Authorization: `Bearer ${this.accessToken}` };
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    };
    const res = await axios.post(url, payload, { headers });
    return res.data;
  }
}


