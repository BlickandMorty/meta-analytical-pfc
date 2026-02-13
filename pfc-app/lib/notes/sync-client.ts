'use client';

import type {
  NotePage, NoteBlock, NoteBook, Vault, Concept, PageLink,
} from './types';

// ═══════════════════════════════════════════════════════════════════
// Notes Sync Client
//
// Client-side helper that calls /api/notes/sync to persist note data
// from Zustand (in-memory) to SQLite (server). Write-through cache
// pattern: Zustand stays fast for reads, every mutation async-writes.
// ═══════════════════════════════════════════════════════════════════

const SYNC_URL = '/api/notes/sync';

// ── Check if migration is needed ──

export async function checkMigrationStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${SYNC_URL}?check=migration`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.hasMigrated === true;
  } catch {
    console.warn('[sync-client] Failed to check migration status');
    return false;
  }
}

// ── Load all vaults from SQLite ──

export async function loadVaultsFromDb(): Promise<Vault[]> {
  try {
    const res = await fetch(SYNC_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return data.vaults ?? [];
  } catch {
    console.warn('[sync-client] Failed to load vaults');
    return [];
  }
}

// ── Load full vault data from SQLite ──

export async function loadVaultDataFromDb(vaultId: string): Promise<{
  pages: NotePage[];
  blocks: NoteBlock[];
  books: NoteBook[];
  concepts: Concept[];
  pageLinks: PageLink[];
} | null> {
  try {
    const res = await fetch(`${SYNC_URL}?vaultId=${encodeURIComponent(vaultId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    console.warn('[sync-client] Failed to load vault data:', vaultId);
    return null;
  }
}

// ── Full vault sync (write-through) ──

export async function syncVaultToServer(
  vaultId: string,
  vault: Vault,
  pages: NotePage[],
  blocks: NoteBlock[],
  books: NoteBook[],
  concepts: Concept[],
  pageLinks: PageLink[],
): Promise<boolean> {
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync',
        vaultId,
        vault,
        pages,
        blocks,
        books,
        concepts,
        pageLinks,
      }),
    });
    return res.ok;
  } catch {
    console.warn('[sync-client] Failed to sync vault:', vaultId);
    return false;
  }
}

// ── One-time migration: push all localStorage vaults to SQLite ──

export async function migrateToSqlite(
  vaults: Array<{
    vault: Vault;
    pages: NotePage[];
    blocks: NoteBlock[];
    books: NoteBook[];
    concepts: Concept[];
    pageLinks: PageLink[];
  }>,
): Promise<{ ok: boolean; skipped?: boolean }> {
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'migrate', vaults }),
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    console.warn('[sync-client] Migration failed');
    return { ok: false };
  }
}

// ── Upsert a single vault record ──

export async function upsertVaultOnServer(vault: Vault): Promise<boolean> {
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert-vault', vault }),
    });
    return res.ok;
  } catch {
    console.warn('[sync-client] Failed to upsert vault:', vault.id);
    return false;
  }
}

// ── Delete a vault ──

export async function deleteVaultOnServer(vaultId: string): Promise<boolean> {
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-vault', vaultId }),
    });
    return res.ok;
  } catch {
    console.warn('[sync-client] Failed to delete vault:', vaultId);
    return false;
  }
}
