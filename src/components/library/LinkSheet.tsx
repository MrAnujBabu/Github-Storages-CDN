import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/useCopy";
import { useOrigin } from "@/hooks/useOrigin";
import { LINK_STYLES, buildLink, htmlEmbed, markdownLink, type LinkStyle } from "@/lib/links";
import { prettyName } from "@/lib/paths";
import type { RepoRef } from "@/lib/storage-config";
import { cn } from "@/lib/utils";

import { ResponsiveDialog } from "./ResponsiveDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  name: string;
  repo: RepoRef;
  commit?: string | null;
  defaultStyle: LinkStyle;
}

function LinkRow({ label, hint, value, isDefault }: { label: string; hint?: string; value: string; isDefault?: boolean }) {
  const { copy, copied } = useCopy();
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            {label}
            {isDefault ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">Default</span>
            ) : null}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={copied ? "secondary" : "outline"}
          className="pressable h-9 shrink-0 rounded-lg px-3"
          onClick={() => void copy(value)}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Ho gaya" : "Copy"}
        </Button>
      </div>
      <code
        className={cn(
          "mt-2 block select-all overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-muted px-2 py-1.5 font-mono text-[12px] text-foreground/80",
        )}
        title={value}
      >
        {value}
      </code>
    </div>
  );
}

/** Every link format for one file, each with its own copy button. */
export function LinkSheet({ open, onOpenChange, path, name, repo, commit, defaultStyle }: Props) {
  const origin = useOrigin();
  const [showEmbed, setShowEmbed] = useState(false);
  const ctx = { repo, commit, origin };
  const primary = buildLink(defaultStyle, path, ctx);
  const title = prettyName(name);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sabhi link formats"
      description={name}
      className="sm:max-w-xl"
    >
      <div className="space-y-2 pb-2">
        {LINK_STYLES.map((s) => (
          <LinkRow
            key={s.id}
            label={s.label}
            hint={s.hint}
            value={buildLink(s.id as LinkStyle, path, ctx)}
            isDefault={s.id === defaultStyle}
          />
        ))}

        <button
          type="button"
          onClick={() => setShowEmbed((v) => !v)}
          className="w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {showEmbed ? "Embed codes chhupao" : "Markdown / HTML embed dikhao"}
        </button>
        {showEmbed ? (
          <>
            <LinkRow label="Markdown" hint="Notes, README ya blog ke liye." value={markdownLink(title, primary)} />
            <LinkRow label="HTML embed" hint="Website mein PDF dikhane ke liye." value={htmlEmbed(primary, title)} />
          </>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
