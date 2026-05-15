/**
 * recordAuditEvent — the single helper through which every write to the
 * audit_log table happens. Direct INSERTs to audit_log are forbidden by
 * Postgres role permissions (set in the migration that creates the table).
 *
 * Spec references:
 *   §9   — append-only, hash-chained audit log
 *   §9.5 — per-event provenance (actor_ip, actor_user_agent, actor_geo)
 *
 * Hash chain: each row's row_hash = SHA256(prev_hash || canonical_row_bytes).
 * Daily cron snapshots a verified chain to a GCS object-lock bucket with
 * 10-year retention. Tampering with provenance breaks the chain.
 */
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import type { Session } from "./auth";
import type { UserRole } from "@prisma/client";

export interface AuditEventInput {
  /** The acting user — typically the current session. */
  actor: Pick<Session, "userId" | "role" | "ip" | "userAgent">;

  /** What happened, as a verb-noun string. Examples: 'order.sign', 'order.draft.create',
   *  'auditor.read', 'user.invite', 'commission.batch.run'. Do not invent ad-hoc names —
   *  use existing ones or add to the canonical list in this file's comments below. */
  action: string;

  /** What the action was performed on. */
  subjectType: "order" | "patient" | "user" | "practice" | "audit_log" | "auditor_scope" | "commission" | "payout";
  subjectId: string;

  /**
   * Action-specific structured payload — REDACTED OF PHI.
   * Must NOT contain patient names, MBIs, DOBs, addresses, phones, or clinical
   * notes. The spec's Sentry scrubbing rules block these field names; the same
   * rule applies here.
   */
  data: Record<string, unknown>;

  /** Correlates to the inbound HTTP request. Generated upstream and passed in. */
  requestId?: string;
}

/**
 * The set of action verbs the system recognises. Add new verbs here when
 * adding new audit-emitting code paths — keeping the canonical list visible
 * makes it easier to write reports and alerts later.
 *
 * order.draft.create        order.draft.update        order.draft.delete
 * order.sent_to_signer      order.sign                order.signature.failed
 * order.pa.opened           order.pa.affirmed         order.pa.denied
 * order.fulfillment.start   order.fulfilled           order.cancel
 *
 * user.invite               user.activate             user.suspend
 * user.mfa.enrol            user.mfa.reset            user.password.reset
 *
 * practice.create           practice.update           practice.member.add
 * practice.member.remove
 *
 * roster.upload             roster.parse              roster.row.draft.create
 *
 * auditor.scope.create      auditor.scope.revoke      auditor.read
 *
 * commission.accrue         commission.earn           commission.void
 * commission.batch.run      payout.create             payout.paid
 *
 * audit_log.read            audit_log.export          audit_log.chain.verify
 */

/** Refuse to log obvious PHI; surface as error in dev, drop the field in prod. */
const PHI_FIELD_NAMES = new Set([
  "patient_name", "patientName",
  "first_name", "firstName",
  "last_name", "lastName",
  "dob", "DOB",
  "mbi", "MBI",
  "ssn", "SSN",
  "address", "address1", "address2",
  "phone",
]);

function stripPhiFields<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (PHI_FIELD_NAMES.has(k)) {
      if (process.env.NODE_ENV === "development") {
        throw new Error(`recordAuditEvent: refusing to log PHI field "${k}". ` +
          `Use a non-PHI projection (e.g. patient_id) instead.`);
      }
      // In prod: silently drop. Fail loud in dev so it's caught early.
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

function canonicaliseRow(row: Record<string, unknown>): string {
  // Deterministic key order = sortable by JSON.stringify with replacer
  const keys = Object.keys(row).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = row[k];
  return JSON.stringify(sorted);
}

const ZERO_HASH = Buffer.alloc(32, 0);

/**
 * Look up the latest row's row_hash, with an advisory lock to prevent two
 * concurrent inserts from racing the chain. Returns ZERO_HASH if the table
 * is empty (genesis row).
 *
 * In Postgres: pg_advisory_xact_lock(<some lock id>). The lock auto-releases
 * at transaction end.
 */
async function getPrevHashLocked(tx: typeof prisma): Promise<Buffer> {
  // Lock id is an arbitrary 64-bit int dedicated to the audit chain.
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(7919)");
  const last = await tx.auditLog.findFirst({
    select: { rowHash: true },
    orderBy: { id: "desc" },
  });
  return last?.rowHash ? Buffer.from(last.rowHash) : ZERO_HASH;
}

/**
 * Record an audit event. Always run inside a transaction so the chain stays
 * consistent. Returns the inserted row's id.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<bigint> {
  const safe = stripPhiFields(input.data);
  const requestId = input.requestId ?? randomUUID();

  return prisma.$transaction(async (tx) => {
    const prevHash = await getPrevHashLocked(tx as typeof prisma);

    // Build the canonical bytes that become the new row's row_hash input.
    // Includes everything we'll store — schema-driven order. If we add columns
    // to AuditLog, add them here too.
    const canonical = canonicaliseRow({
      occurred_at: new Date().toISOString(),
      actor_user_id: input.actor.userId,
      actor_role: input.actor.role,
      action: input.action,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      data: safe,
      request_id: requestId,
      actor_ip: input.actor.ip,
      actor_user_agent: input.actor.userAgent,
      // actor_geo is filled async by a background enrichment job (or here when
      // the GeoLite2 db is available). Left null for now — recomputing the
      // hash chain after enrichment requires a separate "annotation" table,
      // not mutating the original row.
    });

    const rowHash = createHash("sha256")
      .update(prevHash)
      .update(Buffer.from(canonical, "utf8"))
      .digest();

    const inserted = await tx.auditLog.create({
      data: {
        prevHash,
        rowHash,
        actorUserId: input.actor.userId,
        actorRole: input.actor.role as UserRole,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        data: safe as object,
        requestId,
        actorIp: input.actor.ip,
        actorUserAgent: input.actor.userAgent,
        actorGeo: undefined, // enriched async
      },
      select: { id: true },
    });

    return inserted.id;
  });
}

/**
 * Walk the chain from genesis to verify every row's row_hash matches
 * SHA256(prev_hash || canonical_row_bytes). Returns the id of the first
 * broken row, or null if the chain is clean. Used by the daily cron and
 * by the admin compliance dashboard's "verify chain" button.
 */
export async function verifyChain(): Promise<bigint | null> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, prevHash: true, rowHash: true, occurredAt: true,
      actorUserId: true, actorRole: true, action: true,
      subjectType: true, subjectId: true, data: true, requestId: true,
      actorIp: true, actorUserAgent: true,
    },
  });

  let expectedPrev = ZERO_HASH;
  for (const row of rows) {
    if (Buffer.compare(Buffer.from(row.prevHash), expectedPrev) !== 0) return row.id;

    const canonical = canonicaliseRow({
      occurred_at: row.occurredAt.toISOString(),
      actor_user_id: row.actorUserId,
      actor_role: row.actorRole,
      action: row.action,
      subject_type: row.subjectType,
      subject_id: row.subjectId,
      data: row.data,
      request_id: row.requestId,
      actor_ip: row.actorIp,
      actor_user_agent: row.actorUserAgent,
    });

    const expectedHash = createHash("sha256")
      .update(expectedPrev)
      .update(Buffer.from(canonical, "utf8"))
      .digest();

    if (Buffer.compare(Buffer.from(row.rowHash), expectedHash) !== 0) return row.id;
    expectedPrev = Buffer.from(row.rowHash);
  }

  return null;
}
