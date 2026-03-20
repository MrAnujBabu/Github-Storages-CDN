import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Upload,
  Github,
  Link2,
  Copy,
  Check,
  Zap,
  Shield,
  Infinity,
  FolderPlus,
  LogOut,
  Loader2,
  X,
  Save,
} from "lucide-react";
import { isAllowedFile, getFileIcon, ACCEPT_STRING, ALLOWED_EXTENSIONS } from "@/lib/fileTypes";
import nbLogo from "@/assets/nb-logo.png";
import FileDashboard from "@/components/FileDashboard";

type ActiveTab = "upload" | "files";

interface UploadedFile {
  name: string;
  cdnUrl: string;
  githubUrl: string;
  viewerUrl: string;
}

type UploadStep = "idle" | "reading" | "uploading" | "saving" | "done";

export default function PdfUploadPage() {
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("upload");
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [folder, setFolder] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [currentFileName, setCurrentFileName] = useState("");
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    if (!user?.id) return;
    const savedToken = localStorage.getItem("gh_pat");
    if (savedToken) setToken(savedToken);

    const loadSettings = async () => {
      const { data } = await supabase
        .from("github_settings")
        .select("owner, repo, branch, folder")
        .limit(1)
        .maybeSingle();
      if (data) {
        setUsername(data.owner || "");
        setRepo(data.repo || "");
        setBranch(data.branch || "main");
        setFolder(data.folder || "");
      }
      setSettingsLoaded(true);
    };
    loadSettings();
  }, [user?.id]);

  const saveSettings = async () => {
    if (!user?.id) return;
    setSavingSettings(true);
    // Save token to localStorage
    if (token) localStorage.setItem("gh_pat", token);
    else localStorage.removeItem("gh_pat");

    // Upsert github_settings (single row)
    const { data: existing } = await supabase
      .from("github_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("github_settings")
        .update({
          owner: username,
          repo,
          branch,
          folder: folder || "",
          updated_by: user.id,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("github_settings").insert({
        owner: username,
        repo,
        branch,
        folder: folder || "",
        updated_by: user.id,
      });
    }

    setSavingSettings(false);
    setSettingsSaved(true);
    toast.success("Settings saved!");
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(isAllowedFile);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
    else toast.error(`Supported formats: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(isAllowedFile);
      if (selected.length) setFiles((prev) => [...prev, ...selected]);
      else toast.error(`Supported formats: ${ALLOWED_EXTENSIONS.join(", ")}`);
    }
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadFiles = async () => {
    if (!token || !username || !repo) {
      toast.error("Please fill GitHub Token, Username and Repo name");
      return;
    }
    if (!files.length) {
      toast.error("Select at least one file to upload");
      return;
    }
    if (!user?.id) {
      toast.error("Not authenticated. Please sign in again.");
      return;
    }

    setUploading(true);
    const results: UploadedFile[] = [];

    for (const file of files) {
      try {
        setCurrentFileName(file.name);
        setUploadStep("reading");
        const content = await toBase64(file);
        const path = folder
          ? `${folder.replace(/^\/|\/$/g, "")}/${file.name}`
          : file.name;

        setUploadStep("uploading");

        // Check if file already exists (to get SHA for overwrite)
        const ghHeaders = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        };
        const fileUrl = `https://api.github.com/repos/${username}/${repo}/contents/${path}?ref=${branch}`;
        let sha: string | undefined;
        try {
          const checkRes = await fetch(fileUrl, { headers: ghHeaders });
          if (checkRes.ok) {
            const existing = await checkRes.json();
            sha = existing.sha;
          } else if (checkRes.status === 404) {
            // File doesn't exist yet — that's fine
          } else if (checkRes.status === 401) {
            throw new Error("Invalid GitHub token. Check your Personal Access Token.");
          } else {
            const errData = await checkRes.json().catch(() => ({}));
            throw new Error(errData.message || `GitHub error (${checkRes.status}): Verify repo "${username}/${repo}" exists and token has 'repo' scope.`);
          }
        } catch (err) {
          if (err instanceof Error && (err.message.includes("Invalid GitHub") || err.message.includes("GitHub error"))) throw err;
          throw new Error(`Cannot reach GitHub. Check repo "${username}/${repo}" exists and token has 'repo' scope.`);
        }

        const putBody: Record<string, string> = {
          message: sha ? `Update ${file.name}` : `Upload ${file.name}`,
          content,
          branch,
        };
        if (sha) putBody.sha = sha;

        const res = await fetch(
          `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
          {
            method: "PUT",
            headers: ghHeaders,
            body: JSON.stringify(putBody),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 404) {
            throw new Error(`Repo "${username}/${repo}" not found. Check username, repo name, and token permissions.`);
          }
          throw new Error(err.message || `GitHub upload failed (${res.status})`);
        }

        const cdnUrl = `https://cdn.jsdelivr.net/gh/${username}/${repo}@${branch}/${path}`;
        const githubUrl = `https://github.com/${username}/${repo}/blob/${branch}/${path}`;

        setUploadStep("saving");
        const { data: inserted, error: dbError } = await supabase
          .from("uploaded_pdfs")
          .insert({
            uploaded_by: user.id,
            file_name: file.name,
            cdn_url: cdnUrl,
            github_url: githubUrl,
            folder: folder || null,
          })
          .select("id")
          .single();

        if (dbError) {
          console.error("Supabase insert error:", dbError);
          toast.error(`DB save failed: ${dbError.message}`);
          results.push({ name: file.name, cdnUrl, githubUrl, viewerUrl: cdnUrl });
        } else {
          const viewerUrl = `${window.location.origin}/viewer/${inserted.id}`;
          results.push({ name: file.name, cdnUrl, githubUrl, viewerUrl });
        }

        setUploadStep("done");
        toast.success(`✅ Uploaded: ${file.name}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`❌ Failed: ${file.name} — ${msg}`);
      }
    }

    setUploaded((prev) => [...prev, ...results]);
    setFiles([]);
    setUploading(false);
    setUploadStep("idle");
    setCurrentFileName("");

    // Auto-save settings and switch to dashboard after successful upload
    if (results.length > 0) {
      saveSettings();
      setDashboardRefreshKey((k) => k + 1);
      setActiveTab("files");
    }
  };

  const copyLink = (url: string, idx: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIdx(idx);
    toast.success("Link copied!");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const stepLabel: Record<UploadStep, string> = {
    idle: "",
    reading: "📄 Reading file...",
    uploading: "☁️ Uploading to GitHub...",
    saving: "💾 Saving to database...",
    done: "✅ Done!",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={nbLogo} alt="Naveen Bharat" className="w-10 h-10 rounded-lg object-contain" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                Naveen Bharat
              </h1>
              <p className="text-xs text-muted-foreground">
                File Upload Panel
              </p>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "upload"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => { setActiveTab("files"); setDashboardRefreshKey((k) => k + 1); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "files"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Files
          </button>
        </div>

        {activeTab === "files" ? (
          <FileDashboard refreshKey={dashboardRefreshKey} />
        ) : (
          <>
        {/* Benefits bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Zap, label: "Super Fast CDN" },
            { icon: Shield, label: "Account Safe" },
            { icon: Infinity, label: "100% Free" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 p-3 rounded-lg bg-accent text-accent-foreground text-sm font-medium"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>

        {/* GitHub Config */}
        <section className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Github className="w-5 h-5" />
            GitHub Configuration
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Personal Access Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Needs <code className="bg-muted px-1 rounded font-mono">repo</code> scope.{" "}
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener"
                  className="text-primary underline"
                >
                  Create token →
                </a>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="amit123"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Repository
                </label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="edu-files"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Branch
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1">
                  <FolderPlus className="w-3.5 h-3.5" /> Folder (optional)
                </label>
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="maths-files"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={savingSettings || !username || !repo}
            className="w-full py-2.5 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {savingSettings ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : settingsSaved ? (
              <>
                <Check className="w-4 h-4" /> Settings Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Settings
              </>
            )}
          </button>
        </section>

        {/* File Upload */}
        <section className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Upload className="w-5 h-5" />
            Upload Files
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-input rounded-xl p-8 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              Drop files here or tap to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOC, PPT, XLS, CSV, MD, JPG, PNG
            </p>
            <input
              id="file-input"
              type="file"
              accept={ACCEPT_STRING}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => {
                const Icon = getFileIcon(f.name);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground truncate">
                        {f.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(f.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="shrink-0 ml-2 p-1 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={uploadFiles}
            disabled={uploading || !files.length}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{currentFileName}</span>
                </div>
                <span className="text-xs opacity-80">{stepLabel[uploadStep]}</span>
              </div>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload to GitHub & Get CDN Links
              </>
            )}
          </button>
        </section>

        {/* Results */}
        {uploaded.length > 0 && (
          <section className="bg-card rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Link2 className="w-5 h-5 text-primary" />
              Uploaded Files — Share Links
            </div>
            <div className="space-y-3">
              {uploaded.map((f, i) => {
                const Icon = getFileIcon(f.name);
                return (
                  <div key={i} className="p-3 bg-accent/50 rounded-lg space-y-3">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Icon className="w-4 h-4 text-primary" />
                      {f.name}
                    </p>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        📎 Viewer Link (share this):
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 text-primary font-mono truncate block font-semibold">
                          {f.viewerUrl}
                        </code>
                        <button
                          onClick={() => copyLink(f.viewerUrl, i * 2)}
                          className="shrink-0 p-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                        >
                          {copiedIdx === i * 2 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        🔗 Direct CDN Link:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground font-mono truncate block">
                          {f.cdnUrl}
                        </code>
                        <button
                          onClick={() => copyLink(f.cdnUrl, i * 2 + 1)}
                          className="shrink-0 p-2 rounded-md bg-muted text-foreground hover:bg-accent"
                        >
                          {copiedIdx === i * 2 + 1 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="bg-card rounded-xl border border-border p-5 space-y-3">
          <h2 className="text-foreground font-semibold">How It Works</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><span className="font-semibold text-foreground">1.</span> Your file is uploaded to your GitHub repo via API.</p>
            <p><span className="font-semibold text-foreground">2.</span> We convert the GitHub link to a <span className="text-primary font-semibold">jsDelivr CDN</span> URL.</p>
            <p><span className="font-semibold text-foreground">3.</span> Share the Viewer Link — no login needed!</p>
          </div>
          <div className="mt-2 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Supported formats:</p>
            <p>PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, CSV, MD, JPG, JPEG, PNG</p>
          </div>
        </section>

        <footer className="text-center text-xs text-muted-foreground pb-6">
          Pro tip: Create multiple repos for organization. Free & unlimited!
        </footer>
        </>
        )}
      </main>
    </div>
  );
}
