"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { ProfileAvatar } from "@/components/auth/profile-avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useResolvedAvatarSrc } from "@/hooks/use-resolved-avatar-src";
import {
  deleteProfileAvatar,
  updateStoredUser,
  uploadProfileAvatar,
} from "@/lib/api";
import { pickAvatarCandidate } from "@/lib/avatar";
import {
  prepareProfileImage,
  revokePreparedProfileImage,
  type PreparedProfileImage,
} from "@/lib/image-profile";
import { cn } from "@/lib/utils";

export function ProfilePhotoEditor({
  avatarUrl,
  fullName,
  email,
  onAvatarChange,
  className,
}: {
  avatarUrl?: string | null;
  fullName: string;
  email?: string | null;
  onAvatarChange?: (url: string | null) => void;
  className?: string;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const candidate = pickAvatarCandidate(avatarUrl, null);
  const resolved = useResolvedAvatarSrc(candidate);
  const displaySrc = localPreview ?? resolved;

  async function handleFile(file: File) {
    let prepared: PreparedProfileImage | null = null;
    try {
      prepared = await prepareProfileImage(file);
      setLocalPreview(prepared.previewUrl);
      setUploading(true);
      const url = await uploadProfileAvatar(prepared.blob);
      updateStoredUser({ avatar_url: url });
      onAvatarChange?.(url);
      toast({ title: "Profile photo updated", variant: "success" });
    } catch (err) {
      setLocalPreview(null);
      toast({
        title: err instanceof Error ? err.message : "Could not upload photo",
        variant: "destructive",
      });
    } finally {
      revokePreparedProfileImage(prepared);
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm("Remove your profile photo?")) return;
    try {
      setRemoving(true);
      await deleteProfileAvatar();
      setLocalPreview(null);
      onAvatarChange?.(null);
      toast({ title: "Profile photo removed", variant: "success" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Could not remove photo",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div
      className={cn(
        "mp-surface-card flex flex-col items-center rounded-[1.35rem] px-4 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-6",
        className,
      )}
    >
      <ProfileAvatar
        src={displaySrc}
        name={fullName}
        className="mp-avatar-ring h-24 w-24 sm:h-28 sm:w-28"
      />

      <div className="mt-4 min-w-0 flex-1 text-center sm:mt-0 sm:text-left">
        <p className="text-[15px] font-semibold tracking-tight">{fullName}</p>
        {email ? (
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{email}</p>
        ) : null}
        <p className="mt-1 hidden text-[12px] text-muted-foreground sm:block">
          Square photos work best. We auto-crop and optimize for you.
        </p>
        <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-start">
          <Button
            type="button"
            className="mp-btn-accent h-11 w-full rounded-xl px-4 text-[12px] font-semibold sm:h-10 sm:w-auto sm:min-w-[9rem]"
            disabled={uploading || removing}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Uploading…" : "Change photo"}
          </Button>
          {(displaySrc || candidate) && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-xl px-3 text-[12px] text-muted-foreground sm:h-10 sm:w-auto"
              disabled={uploading || removing}
              onClick={() => void handleRemove()}
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
