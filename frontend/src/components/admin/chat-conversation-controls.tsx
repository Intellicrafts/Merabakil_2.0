"use client";

import { Download, Pin, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  JURISDICTION_OPTIONS,
  MATTER_TYPES,
  type MatterType,
} from "@/lib/conversations";
import type { AdminConversationDetail } from "@/lib/types";

interface ChatConversationControlsProps {
  conversation: AdminConversationDetail;
  titleDraft: string;
  onTitleChange: (value: string) => void;
  jurisdiction: string;
  onJurisdictionChange: (value: string) => void;
  matterType: MatterType;
  onMatterTypeChange: (value: MatterType) => void;
  onSaveMetadata: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onExport: () => void;
  saving?: boolean;
  deleting?: boolean;
}

export function ChatConversationControls({
  conversation,
  titleDraft,
  onTitleChange,
  jurisdiction,
  onJurisdictionChange,
  matterType,
  onMatterTypeChange,
  onSaveMetadata,
  onTogglePin,
  onDelete,
  onExport,
  saving,
  deleting,
}: ChatConversationControlsProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="conv-title">
          Title
        </label>
        <Input
          id="conv-title"
          value={titleDraft}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Conversation title"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="conv-jurisdiction">
            Jurisdiction
          </label>
          <select
            id="conv-jurisdiction"
            value={jurisdiction}
            onChange={(e) => onJurisdictionChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <option value="">None</option>
            {JURISDICTION_OPTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="conv-matter">
            Matter type
          </label>
          <select
            id="conv-matter"
            value={matterType ?? ""}
            onChange={(e) => onMatterTypeChange((e.target.value || null) as MatterType)}
            className="h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <option value="">None</option>
            {MATTER_TYPES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={onSaveMetadata}>
          {saving ? "Saving…" : "Save metadata"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onTogglePin}>
          <Pin className="mr-1.5 h-3.5 w-3.5" />
          {conversation.pinned ? "Unpin" : "Pin"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export JSON
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {deleting ? "Deleting…" : "Delete conversation"}
        </Button>
      </div>
    </div>
  );
}
