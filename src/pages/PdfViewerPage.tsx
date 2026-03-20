import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";
import { getFileCategory, getFileIcon } from "@/lib/fileTypes";

export default function PdfViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<{ file_name: string; cdn_url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchFile = async () => {
      if (!id) return;
      const { data, error: err } = await supabase
        .from("uploaded_pdfs")
        .select("file_name, cdn_url")
        .eq("id", id)
        .single();

      if (err || !data) setError(true);
      else setFile(data);
      setLoading(false);
    };
    fetchFile();
  }, [id]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !file) {
    const Icon = getFileIcon("unknown.pdf");
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <Icon className="w-16 h-16 mx-auto text-muted-foreground" />
          <p className="text-xl font-bold text-foreground">File Not Found</p>
          <p className="text-sm text-muted-foreground">
            This link may be expired or invalid.
          </p>
        </div>
      </div>
    );
  }

  const category = getFileCategory(file.file_name);
  const FileIcon = getFileIcon(file.file_name);

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {category === "pdf" && (
        <iframe
          src={`${file.cdn_url}#toolbar=0&navpanes=0&scrollbar=1`}
          className="w-full flex-1"
          title={file.file_name}
          style={{ border: "none" }}
        />
      )}

      {category === "image" && (
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <img
            src={file.cdn_url}
            alt={file.file_name}
            loading="lazy"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>
      )}

      {category !== "pdf" && category !== "image" && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm">
            <FileIcon className="w-20 h-20 mx-auto text-primary" />
            <p className="text-xl font-bold text-foreground">{file.file_name}</p>
            <p className="text-sm text-muted-foreground">
              This file type can't be previewed in the browser. Click below to download it.
            </p>
            <a
              href={file.cdn_url}
              download={file.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              <Download className="w-5 h-5" />
              Download File
            </a>
          </div>
        </div>
      )}

      {/* Floating download button (for previewable files) */}
      {(category === "pdf" || category === "image") && (
        <a
          href={file.cdn_url}
          download={file.file_name}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          title={`Download ${file.file_name}`}
        >
          <Download className="w-6 h-6" />
        </a>
      )}
    </div>
  );
}
