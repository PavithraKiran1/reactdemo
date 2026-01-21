import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Issuer, type Client, type IssuerMetadata } from 'openid-client';

@Injectable()
export class OktaOidcService {
  private clientPromise: Promise<Client> | null = null;

  constructor(private readonly config: ConfigService) {}

  async getClient(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }
    return this.clientPromise;
  }

  private async createClient(): Promise<Client> {
    const issuerUrl = this.config.get<string>('OKTA_ISSUER');
    const clientId = this.config.get<string>('OKTA_CLIENT_ID');
    const clientSecret = this.config.get<string>('OKTA_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('OKTA_REDIRECT_URI');

    if (!issuerUrl || !clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Missing OKTA_ISSUER / OKTA_CLIENT_ID / OKTA_CLIENT_SECRET / OKTA_REDIRECT_URI environment variables.',
      );
    }

    const issuer: Issuer<IssuerMetadata> = await Issuer.discover(issuerUrl);

    return new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
      response_types: ['code'],
    });
  }
}

