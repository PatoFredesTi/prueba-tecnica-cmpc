import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContext } from '../common/http';
@Injectable()
export class AuditService {
  record(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    action: string,
    id: string,
    before?: unknown,
    after?: unknown,
  ) {
    const snapshot = (data: unknown): Prisma.InputJsonValue | undefined =>
      data === undefined ? undefined : JSON.parse(JSON.stringify(data));
    return tx.auditLog.create({
      data: {
        actorId: ctx.actorId,
        requestId: ctx.requestId,
        action,
        entityType: 'Book',
        entityId: id,
        before: snapshot(before),
        after: snapshot(after),
      },
    });
  }
}
