import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private keepAlive?: ReturnType<typeof setInterval>;

  constructor() {
    super({
      log: process.env.PRISMA_LOG === '1' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
    // Neon free tier suspends after ~5m idle — ping often to stay warm.
    this.keepAlive = setInterval(() => {
      void this.$queryRaw`SELECT 1`.catch((err: Error) => {
        this.logger.warn(`DB keep-alive failed: ${err.message}`);
      });
    }, 45_000);
    this.keepAlive.unref?.();
    // Warm a cheap query so the first user request isn't a cold RTT.
    void this.department.count().catch(() => undefined);
  }

  private async connectWithRetry(attempts = 6) {
    let last: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        if (i > 1) this.logger.log(`Database connected after ${i} attempts`);
        return;
      } catch (err) {
        last = err;
        this.logger.warn(
          `Database connect attempt ${i}/${attempts} failed; retrying…`,
        );
        await new Promise((r) => setTimeout(r, 1000 * i));
      }
    }
    throw last;
  }

  async onModuleDestroy() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    await this.$disconnect();
  }
}
