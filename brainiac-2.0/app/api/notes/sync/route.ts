import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/debug-logger';
import { parseBodyWithLimit } from '@/lib/api-utils';
import {
  syncVaultToDb,
  loadVaultFromDb,
  hasNotesInDb,
  getVaults,
  upsertVault,
  deleteVault,
} from '@/lib/db/notes-queries';
import type {
  NotePage, NoteBlock, NoteBook, Vault, Concept, PageLink,
} from '@/lib/notes/types';
import { vaultId as toVaultId } from '@/lib/branded';

// ═══════════════════════════════════════════════════════════════════
// GET /api/notes/sync
//
// Query params:
//   ?check=migration   → { hasMigrated: boolean }
//   ?vaultId=xxx        → load full vault from SQLite
//   (no params)         → list all vaults
// ═══════════════════════════════════════════════════════════════════

async function _GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const check = searchParams.get('check');
    const vaultId = searchParams.get('vaultId');

    // Migration check
    if (check === 'migration') {
      const hasNotes = await hasNotesInDb();
      return NextResponse.json({ hasMigrated: hasNotes });
    }

    // Load specific vault
    if (vaultId) {
      const data = await loadVaultFromDb(toVaultId(vaultId));
      if (!data) {
        return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    // List all vaults
    const vaults = await getVaults();
    return NextResponse.json({ vaults });
  } catch (err) {
    logger.error('notes/sync', 'GET error:', err);
    return NextResponse.json(
      { error: 'Failed to read notes from database' },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/notes/sync
//
// Body: { action, ... }
//
// Actions:
//   "sync"     → Full vault write-through
//   "migrate"  → One-time localStorage→SQLite migration (multi-vault)
//   "upsert-vault" → Upsert a single vault record
//   "delete-vault" → Delete a vault and all its data
// ═══════════════════════════════════════════════════════════════════

interface SyncPayload {
  action: 'sync';
  vaultId: string;
  vault: Vault;
  pages: NotePage[];
  blocks: NoteBlock[];
  books: NoteBook[];
  concepts: Concept[];
  pageLinks: PageLink[];
}

interface MigratePayload {
  action: 'migrate';
  vaults: Array<{
    vault: Vault;
    pages: NotePage[];
    blocks: NoteBlock[];
    books: NoteBook[];
    concepts: Concept[];
    pageLinks: PageLink[];
  }>;
}

interface UpsertVaultPayload {
  action: 'upsert-vault';
  vault: Vault;
}

interface DeleteVaultPayload {
  action: 'delete-vault';
  vaultId: string;
}

type PostPayload = SyncPayload | MigratePayload | UpsertVaultPayload | DeleteVaultPayload;

// Limit body to ~10MB (notes shouldn't need more; prevents abuse)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

async function _POST(req: NextRequest) {
  try {
    // Use parseBodyWithLimit for actual stream-level size enforcement (not just header check)
    const parsedBody = await parseBodyWithLimit<PostPayload>(req, MAX_BODY_SIZE);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    switch (body.action) {
      // ── Full vault sync (write-through) ──
      case 'sync': {
        const { vaultId, vault, pages, blocks, books, concepts, pageLinks } = body;
        if (!vaultId) {
          return NextResponse.json({ error: 'vaultId is required' }, { status: 400 });
        }
        await syncVaultToDb(toVaultId(vaultId), vault, pages, blocks, books, concepts, pageLinks);
        return NextResponse.json({ ok: true, synced: pages.length });
      }

      // ── One-time migration: push all vaults from localStorage ──
      case 'migrate': {
        // Check if already migrated
        const alreadyMigrated = await hasNotesInDb();
        if (alreadyMigrated) {
          return NextResponse.json({ ok: true, skipped: true, reason: 'already migrated' });
        }

        const { vaults } = body;
        let totalPages = 0;

        for (const vaultData of vaults) {
          const { vault, pages, blocks, books, concepts, pageLinks } = vaultData;
          await syncVaultToDb(toVaultId(vault.id), vault, pages, blocks, books, concepts, pageLinks);
          totalPages += pages.length;
        }

        return NextResponse.json({
          ok: true,
          migrated: true,
          vaultCount: vaults.length,
          totalPages,
        });
      }

      // ── Upsert a single vault record ──
      case 'upsert-vault': {
        await upsertVault(body.vault);
        return NextResponse.json({ ok: true });
      }

      // ── Delete a vault ──
      case 'delete-vault': {
        if (!body.vaultId) {
          return NextResponse.json({ error: 'vaultId is required' }, { status: 400 });
        }
        await deleteVault(toVaultId(body.vaultId));
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 },
        );
    }
  } catch (err) {
    logger.error('notes/sync', 'POST error:', err);
    return NextResponse.json(
      { error: 'Failed to sync notes to database' },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(_GET, { maxRequests: 20, windowMs: 60_000 });
export const POST = withRateLimit(_POST, { maxRequests: 20, windowMs: 60_000 });
