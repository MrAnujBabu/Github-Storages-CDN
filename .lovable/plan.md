## Plan: Add Bulk Select & Delete to File Dashboard

Take Time to think and Verify it 

### Changes (single file: `src/components/FileDashboard.tsx`)

**New state:**

- `selectedIds: Set<string>` — tracks selected file IDs
- `bulkDeleting: boolean` — loading state during bulk delete
- `bulkConfirm: boolean` — confirmation step before bulk delete

**UI additions:**

1. **Select All checkbox** in the header area (next to file count) — toggles all visible/filtered files
2. **Per-file checkbox** on each file card (left side, before the file icon)
3. **Bulk action bar** — appears when `selectedIds.size > 0`, pinned at top of the list:
  - Shows count: "3 selected"
  - "Delete Selected" button (red) with confirm step
  - "Deselect All" button

**Bulk delete logic:**

- Iterates over selected IDs sequentially (to avoid GitHub rate limits)
- For each file: runs the same GitHub delete + Supabase delete logic as the existing `deleteFile` function
- Extracts the shared GitHub delete logic into a helper `deleteFileById(id)` to reuse for both single and bulk
- Shows progress toast: "Deleting 2/5..."
- On completion: "5 files deleted" summary toast
- Clears selection after completion

**No database changes needed** — existing RLS policies already cover DELETE for admins.

### Technical Details

- Checkbox uses native `<input type="checkbox">` styled with Tailwind
- "Select All" only selects currently filtered/visible files
- Bulk delete reuses the existing `deleteFile` logic (GitHub + DB) in a loop
- Sequential deletion to respect GitHub API rate limits (no Promise.all)

&nbsp;

**Must Do Open my Website in Browser** 

Dont worry about credentials issue it is test phase 

**[Email :- naveenbharatprism@gmail.com](mailto:naveenbharatprism@gmail.com)**

password:- Ceoanuj26 

Very all Implementation 