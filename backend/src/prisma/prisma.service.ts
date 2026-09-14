import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private keepAlive?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connected = false;

  constructor() {
    super({
      log: process.env.PRISMA_LOG === '1' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    // Neon free tier can take a while to wake; do not crash the HTTP server if DB is briefly unreachable.
    const ok = await this.connectWithRetry(12);
    if (!ok) {
      this.logger.error(
        'Database unreachable at startup — API will stay up and keep retrying in the background.',
      );
      this.scheduleReconnect();
      return;
    }
    this.startKeepAlive();
  }

  private startKeepAlive() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    // Neon free tier suspends after ~5m idle — ping often to stay warm.
    this.keepAlive = setInterval(() => {
      void this.$queryRaw`SELECT 1`
        .then(() => {
          this.connected = true;
        })
        .catch((err: Error) => {
          this.connected = false;
          this.logger.warn(`DB keep-alive failed: ${err.message}`);
          this.scheduleReconnect();
        });
    }, 45_000);
    this.keepAlive.unref?.();
    void this.department.count().catch(() => undefined);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectWithRetry(8).then((ok) => {
        if (ok) this.startKeepAlive();
        else this.scheduleReconnect();
      });
    }, 8_000);
    this.reconnectTimer.unref?.();
  }

  private async connectWithRetry(attempts = 12): Promise<boolean> {
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        this.connected = true;
        if (i > 1) this.logger.log(`Database connected after ${i} attempts`);
        else this.logger.log('Database connected');
        return true;
      } catch (err) {
        this.connected = false;
        this.logger.warn(
          `Database connect attempt ${i}/${attempts} failed; retrying…`,
        );
        await new Promise((r) => setTimeout(r, Math.min(15_000, 1500 * i)));
      }
    }
    return false;
  }

  async onModuleDestroy() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.$disconnect();
  }
}
