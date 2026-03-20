import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFileIcon } from "@/lib/fileTypes";
import {
  Search,
  Copy,
  Check,
  Trash2,
  Pencil,
  ExternalLink,
  FolderOpen,
  X,
  Loader2,
  Link2,
} from "lucide-react";

interface FileRecord {
  id: string;
  file_name: string;
  cdn_url: string;
  github_url: string;
  folder: string | null;
  created_at: string;
}

interface GitHubSettings {
  owner: string;
  repo: string;
  branch: string;
  folder: string | null;
}

interface FileDashboardProps {
  refreshKey: number;
}

export default function FileDashboard({ refreshKey }: FileDashboardProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ghSettings, setGhSettings] = useState<GitHubSettings | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("uploaded_pdfs")
      .select("id, file_name, cdn_url, github_url, folder, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      toast.error("Failed to load files");
      console.error(error);
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadGhSettings = async () => {
      const { data } = await supabase
        .from("github_settings")
        .select("owner, repo, branch, folder")
        .limit(1)
        .maybeSingle();
      if (data) {
        setGhSettings({
          owner: data.owner,
          repo: data.repo,
          branch: data.branch,
          folder: data.folder,
        });
      }
    };
    loadGhSettings();
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkConfirm(false);
  }, [search, folderFilter]);

  const folders = Array.from(
    new Set(files.map((f) => f.folder || "Ungrouped"))
  ).sort();

  const filtered = files.filter((f) => {
    const matchesSearch = f.file_name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFolder =
      folderFilter === null ||
      (folderFilter === "Ungrouped" ? !f.folder : f.folder === folderFilter);
    return matchesSearch && matchesFolder;
  });

  const copyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startRename = (file: FileRecord) => {
    setEditingId(file.id);
    setEditName(file.file_name);
  };

  const saveRename = async () => {
    if (!editingId || !editName.trim()) return;

    const file = files.find((f) => f.id === editingId);
    if (!file) return;

    const oldName = file.file_name;
    const newName = editName.trim();

    if (oldName === newName) {
      setEditingId(null);
      setEditName("");
      return;
    }

    setRenamingId(editingId);
    const token = localStorage.getItem("gh_pat");

    if (token && ghSettings) {
      try {
        const { owner, repo, branch } = ghSettings;
        const fileFolder = file.folder || ghSettings.folder || "";
        const oldPath = fileFolder
          ? `${fileFolder.replace(/^\/|\/$/g, "")}/${oldName}`
          : oldName;
        const newPath = fileFolder
          ? `${fileFolder.replace(/^\/|\/$/g, "")}/${newName}`
          : newName;

        const ghHeaders = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        };

        const getRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${oldPath}?ref=${branch}`,
          { headers: ghHeaders }
        );

        if (!getRes.ok) {
          throw new Error(`Failed to fetch file from GitHub (${getRes.status})`);
        }

        const oldFile = await getRes.json();
        const { sha, content } = oldFile;

        const putRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${newPath}`,
          {
            method: "PUT",
            headers: ghHeaders,
            body: JSON.stringify({
              message: `Rename ${oldName} → ${newName}`,
              content,
              branch,
            }),
          }
        );

        if (!putRes.ok) {
          const err = await putRes.json().catch(() => ({}));
          throw new Error(err.message || `GitHub PUT failed (${putRes.status})`);
        }

        const delRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${oldPath}`,
          {
            method: "DELETE",
            headers: ghHeaders,
            body: JSON.stringify({
              message: `Delete old file ${oldName} (renamed to ${newName})`,
              sha,
              branch,
            }),
          }
        );

        if (!delRes.ok) {
          console.warn("GitHub delete of old file failed, but new file was created");
        }

        const newCdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${newPath}`;
        const newGithubUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${newPath}`;

        const { error } = await supabase
          .from("uploaded_pdfs")
          .update({
            file_name: newName,
            cdn_url: newCdnUrl,
            github_url: newGithubUrl,
          })
          .eq("id", editingId);

        if (error) {
          toast.error("GitHub renamed but DB update failed: " + error.message);
        } else {
          toast.success("File renamed on GitHub & CDN updated!");
          setFiles((prev) =>
            prev.map((f) =>
              f.id === editingId
                ? { ...f, file_name: newName, cdn_url: newCdnUrl, github_url: newGithubUrl }
                : f
            )
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`GitHub rename failed: ${msg}. Updating name in DB only.`);
        const { error } = await supabase
          .from("uploaded_pdfs")
          .update({ file_name: newName })
          .eq("id", editingId);

        if (error) {
          toast.error("Rename failed: " + error.message);
        } else {
          toast.success("File name updated (DB only)");
          setFiles((prev) =>
            prev.map((f) =>
              f.id === editingId ? { ...f, file_name: newName } : f
            )
          );
        }
      }
    } else {
      const { error } = await supabase
        .from("uploaded_pdfs")
        .update({ file_name: newName })
        .eq("id", editingId);

      if (error) {
        toast.error("Rename failed: " + error.message);
      } else {
        toast.success("File renamed");
        setFiles((prev) =>
          prev.map((f) =>
            f.id === editingId ? { ...f, file_name: newName } : f
          )
        );
      }
    }

    setEditingId(null);
    setEditName("");
    setRenamingId(null);
  };

  // Shared helper for deleting a single file (GitHub + DB)
  const deleteFileById = async (id: string): Promise<boolean> => {
    const file = files.find((f) => f.id === id);
    if (!file) return false;

    const token = localStorage.getItem("gh_pat");

    if (token && ghSettings) {
      try {
        const { owner, repo, branch } = ghSettings;
        const fileFolder = file.folder || ghSettings.folder || "";
        const filePath = fileFolder
          ? `${fileFolder.replace(/^\/|\/$/g, "")}/${file.file_name}`
          : file.file_name;

        const ghHeaders = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        };

        const getRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
          { headers: ghHeaders }
        );

        if (getRes.ok) {
          const ghFile = await getRes.json();
          await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
              method: "DELETE",
              headers: ghHeaders,
              body: JSON.stringify({
                message: `Delete ${file.file_name}`,
                sha: ghFile.sha,
                branch,
              }),
            }
          );
        }
      } catch (err) {
        console.warn("GitHub delete error:", err);
      }
    }

    const { error } = await supabase
      .from("uploaded_pdfs")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(`Delete failed for ${file.file_name}: ${error.message}`);
      return false;
    }
    return true;
  };

  const deleteFile = async (id: string) => {
    setDeletingId(id);
    const success = await deleteFileById(id);
    if (success) {
      const token = localStorage.getItem("gh_pat");
      const msg = token && ghSettings
        ? "File deleted from GitHub & database"
        : "File record deleted (DB only)";
      toast.success(msg);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    setDeletingId(null);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkDeleting(true);
    setBulkConfirm(false);
    let deletedCount = 0;

    for (let i = 0; i < ids.length; i++) {
      toast.info(`Deleting ${i + 1}/${ids.length}...`, { id: "bulk-progress" });
      const success = await deleteFileById(ids[i]);
      if (success) {
        deletedCount++;
        setFiles((prev) => prev.filter((f) => f.id !== ids[i]));
      }
    }

    toast.dismiss("bulk-progress");
    toast.success(`${deletedCount} file${deletedCount !== 1 ? "s" : ""} deleted`);
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filteredIds = filtered.map((f) => f.id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Folder Filter */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {folders.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFolderFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                folderFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              All Files ({files.length})
            </button>
            {folders.map((folder) => {
              const count = files.filter((f) =>
                folder === "Ungrouped" ? !f.folder : f.folder === folder
              ).length;
              return (
                <button
                  key={folder}
                  onClick={() => setFolderFilter(folder)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                    folderFilter === folder
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <FolderOpen className="w-3 h-3" />
                  {folder} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* File count + Select All */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length} file{filtered.length !== 1 ? "s" : ""}
          {folderFilter ? ` in "${folderFilter}"` : ""}
          {search ? ` matching "${search}"` : ""}
        </p>
        {filtered.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every((f) => selectedIds.has(f.id))}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded border-input accent-primary"
            />
            Select All
          </label>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkConfirm ? (
              <>
                <button
                  onClick={bulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {bulkDeleting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Confirm Delete
                </button>
                <button
                  onClick={() => setBulkConfirm(false)}
                  disabled={bulkDeleting}
                  className="p-1.5 rounded text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setBulkConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive text-destructive-foreground hover:opacity-90"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </button>
            )}
            <button
              onClick={() => { setSelectedIds(new Set()); setBulkConfirm(false); }}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-accent"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {files.length === 0
            ? "No files uploaded yet. Upload your first file!"
            : "No files match your search."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((file) => {
            const Icon = getFileIcon(file.file_name);
            const viewerUrl = `${window.location.origin}/viewer/${file.id}`;
            const date = new Date(file.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const isRenaming = renamingId === file.id;

            return (
              <div
                key={file.id}
                className={`p-3 rounded-lg border space-y-2 ${
                  selectedIds.has(file.id)
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/50 border-border"
                }`}
              >
                {/* File name row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(file.id)}
                      onChange={() => toggleSelect(file.id)}
                      className="w-3.5 h-3.5 rounded border-input accent-primary shrink-0 cursor-pointer"
                    />
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    {editingId === file.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          disabled={isRenaming}
                          className="flex-1 min-w-0 px-2 py-1 rounded border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                        <button
                          onClick={saveRename}
                          disabled={isRenaming}
                          className="p-1 rounded text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {isRenaming ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={isRenaming}
                          className="p-1 rounded text-muted-foreground hover:bg-accent disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-foreground truncate">
                        {file.file_name}
                      </span>
                    )}
                  </div>

                  {editingId !== file.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startRename(file)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {deletingId === file.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteFile(file.id)}
                            className="px-2 py-1 rounded text-xs bg-destructive text-destructive-foreground"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1 rounded text-muted-foreground hover:bg-accent"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(file.id)}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{date}</span>
                  {file.folder && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        {file.folder}
                      </span>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copyLink(viewerUrl, `viewer-${file.id}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {copiedId === `viewer-${file.id}` ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Link2 className="w-3 h-3" />
                    )}
                    Viewer Link
                  </button>
                  <button
                    onClick={() => copyLink(file.cdn_url, `cdn-${file.id}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted text-foreground hover:bg-accent"
                  >
                    {copiedId === `cdn-${file.id}` ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    CDN Link
                  </button>
                  <a
                    href={viewerUrl}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted text-foreground hover:bg-accent"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
