# Naveen Bharat — File Upload & CDN Guide

## How It Works

1. **Upload**: Files are pushed to your GitHub repository via the GitHub API.
2. **CDN**: The GitHub file URL is converted to a [jsDelivr](https://www.jsdelivr.com/) CDN URL for fast, global delivery.
3. **Share**: Use the Viewer Link (no login required) or the direct CDN link.

---

## File Size Limits

| Limit | Value | Notes |
|---|---|---|
| **GitHub API upload** | **100 MB** per file | Hard limit by GitHub Contents API |
| **GitHub repo size** | **< 1 GB recommended** | GitHub warns at 1 GB, hard limit ~5 GB |
| **jsDelivr CDN serving** | **50 MB** per file | Files > 50 MB will not be served by jsDelivr |
| **jsDelivr repo total** | **50 MB** recommended | Repos over 50 MB may have partial CDN coverage |
| **Recommended sweet spot** | **< 25 MB** per file | Best reliability for CDN caching and delivery |

### Best Practice

- Keep individual files **under 25 MB** for the most reliable CDN experience.
- For files between 25–50 MB, CDN delivery works but may be slower on first load.
- Files over 50 MB **will not work** with jsDelivr — use direct GitHub download links instead.

---

## Supported File Types

| Category | Extensions |
|---|---|
| **Documents** | `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.md` |
| **Spreadsheets** | `.xls`, `.xlsx`, `.csv` |
| **Images** | `.jpg`, `.jpeg`, `.png` |

---

## Folder Organization

- Use the **Folder** field when uploading to organize files into directories on GitHub.
- Examples: `maths-notes`, `physics/chapter1`, `assignments/2026`
- Folder names should use lowercase, hyphens or slashes. Avoid spaces and special characters.
- The dashboard groups files by folder for easy browsing.

---

## Renaming Files

When you rename a file in the dashboard:

1. The file is **renamed on GitHub** (old file deleted, new file created with same content).
2. The **CDN URL is automatically updated** to point to the new file name.
3. The **Viewer Link stays the same** (it uses the database ID, not the file name).

> **Note**: After renaming, the old CDN URL will stop working once jsDelivr cache expires (usually within 24 hours). The new URL works immediately.

---

## Deleting Files

When you delete a file from the dashboard:

1. The file is **deleted from GitHub** (if a GitHub token is configured).
2. The **database record is removed** from Supabase.
3. If the GitHub token is missing or the API call fails, only the database record is deleted and you'll see a warning.

> **Note**: After deletion, the CDN URL may still work briefly until jsDelivr cache expires.

---

## CDN URL Format

```
https://cdn.jsdelivr.net/gh/{username}/{repo}@{branch}/{folder}/{filename}
```

Example:
```
https://cdn.jsdelivr.net/gh/amit123/edu-files@main/maths-notes/algebra.pdf
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Upload fails with 401 | Your GitHub token is expired or invalid. Generate a new one with `repo` scope. |
| Upload fails with 404 | The repository doesn't exist or the token doesn't have access. Check username/repo. |
| CDN returns 404 | File may be too large (>50 MB) or branch name is wrong. |
| CDN shows old content | jsDelivr caches files. Purge cache at `https://purge.jsdelivr.net/gh/{user}/{repo}@{branch}/{path}` |
| Rename fails on GitHub | Ensure your GitHub token has write access (`repo` scope). The DB name will still update as a fallback. |
