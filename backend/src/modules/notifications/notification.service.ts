import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationAudit } from './entities/notification-audit.entity';

/**
 * NotificationService
 * - If FIREBASE_SERVICE_ACCOUNT is provided (base64-encoded JSON) or FIREBASE_CRED_PATH
 *   points to a service account JSON file, this will initialize firebase-admin and send
 *   real push notifications. Otherwise it will log and noop.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private admin: any | null = null;
  private initialized = false;
  private webPush: any | null = null;
  private webPushReady = false;

  constructor(@InjectRepository(NotificationAudit) private readonly auditRepo: Repository<NotificationAudit>) {
    // lazy init firebase-admin if available
    try {
       
      const firebaseAdmin = require('firebase-admin');
      const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT || '';
      const credPath = process.env.FIREBASE_CRED_PATH || '';

      let credential: any = null;
      if (serviceAccountBase64) {
        const json = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
        const obj = JSON.parse(json);
        credential = firebaseAdmin.credential.cert(obj);
      } else if (credPath) {
        credential = firebaseAdmin.credential.cert(require(credPath));
      }

      if (credential) {
        try {
          firebaseAdmin.initializeApp({ credential });
          this.admin = firebaseAdmin;
          this.initialized = true;
          this.logger.log('firebase-admin initialized for notifications');
        } catch (err: any) {
          this.logger.warn('firebase-admin init warning: ' + (err?.message || String(err)));
          this.admin = firebaseAdmin;
          this.initialized = true;
        }
      } else {
        this.logger.debug('NotificationService: no firebase credentials provided — running in noop mode');
      }
    } catch (err: any) {
      this.logger.debug('firebase-admin not available; notifications will be logged only: ' + (err?.message || String(err)));
    }

    // lazy init web-push if VAPID keys provided
    try {
       
      const webPush = require('web-push');
      const pub = process.env.VAPID_PUBLIC_KEY || '';
      const priv = process.env.VAPID_PRIVATE_KEY || '';
      const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
      if (pub && priv) {
        webPush.setVapidDetails(subject, pub, priv);
        this.webPush = webPush;
        this.webPushReady = true;
        this.logger.log('web-push initialized for PWA notifications');
      }
    } catch (e: any) {
      this.logger.debug('web-push not available; PWA notifications disabled: ' + (e?.message || String(e)));
    }
  }

  private async recordAudit(partial: Partial<NotificationAudit>) {
    try {
      const entry = this.auditRepo.create(partial as NotificationAudit);
      return await this.auditRepo.save(entry);
    } catch (err: any) {
      // do not crash the caller if DB isn't available
      this.logger.debug('Failed to write notification audit: ' + (err?.message || String(err)));
      return null;
    }
  }

  private async sendWithRetry(sendFn: () => Promise<any>, auditBase: Partial<NotificationAudit>) {
  const maxAttempts = parseInt(process.env.NOTIFICATION_MAX_ATTEMPTS || '3', 10) || 3;
  let attempt = 0;
  let lastErr: any = null;
  await this.recordAudit({ ...auditBase, status: 'pending', attempts: 0 });
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        if (!this.initialized || !this.admin) {
          const reason = 'noop';
          await this.recordAudit({ ...auditBase, status: 'failed', error: reason, attempts: attempt });
          return { success: false, reason };
        }
        const res = await sendFn();
        await this.recordAudit({ ...auditBase, status: 'success', attempts: attempt });
        return { success: true, id: res };
      } catch (err: any) {
        lastErr = err;
        // write an intermediate failed attempt
        await this.recordAudit({ ...auditBase, status: 'failed', error: err?.message || String(err), attempts: attempt });
        // simple exponential backoff
        const backoff = Math.pow(2, attempt) * 100;
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    return { success: false, error: lastErr?.message || String(lastErr) };
  }

  async sendToDevice(token: string, payload: any) {
    const message = { token, notification: { title: payload.title, body: payload.body }, data: payload.data || {} };
    return this.sendWithRetry(() => this.admin!.messaging().send(message), {
      recipient: token,
      payload: message,
    });
  }

  async sendToTopic(topic: string, payload: any) {
    const message = { topic, notification: { title: payload.title, body: payload.body }, data: payload.data || {} };
    return this.sendWithRetry(() => this.admin!.messaging().send(message), {
      topic,
      payload: message,
    });
  }

  async sendWebPush(subscription: any, payload: { title: string; body?: string; data?: any }) {
    const message = JSON.stringify({ title: payload.title, body: payload.body, data: payload.data || {} });
    return this.sendWithRetry(() => this.webPush!.sendNotification(subscription, message), {
      recipient: subscription?.endpoint || 'webpush',
      payload: message,
    });
  }
}
