import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface TOTPSetupResult {
  secret: string;
  otpAuthUrl: string;
  qrCodeDataUrl: string;
}

export class Authenticator {
  private static readonly APP_NAME = 'Starfish';

  /**
   * Generate a new TOTP secret for a user
   */
  static generateSecret(username: string): { secret: string; otpAuthUrl: string } {
    const generated = speakeasy.generateSecret({
      name: `${this.APP_NAME}:${username}`,
      issuer: this.APP_NAME,
      length: 20
    });

    return {
      secret: generated.base32,
      otpAuthUrl: generated.otpauth_url!
    };
  }

  /**
   * Generate QR code data URL for authenticator app scanning
   */
  static async generateQRCode(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  /**
   * Full setup: generate secret + QR code
   */
  static async setup(username: string): Promise<TOTPSetupResult> {
    const { secret, otpAuthUrl } = this.generateSecret(username);
    const qrCodeDataUrl = await this.generateQRCode(otpAuthUrl);
    return { secret, otpAuthUrl, qrCodeDataUrl };
  }

  /**
   * Verify a TOTP token against a secret
   */
  static verify(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step tolerance (30 seconds each direction)
    });
  }
}
