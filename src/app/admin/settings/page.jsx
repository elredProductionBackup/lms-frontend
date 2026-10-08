"use client";

import { useRef } from "react";
import { UploadCloud, ImageIcon } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { uploadLogo } from "@/store/slices/settingsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/Shell";
import { Button } from "@/components/ui/Primitives";
import { mediaUrl } from "@/lib/api";

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const fileRef = useRef(null);
  const { name, logoUrl, saving } = useAppSelector((s) => s.settings);

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await dispatch(uploadLogo(file));
    if (uploadLogo.fulfilled.match(res)) dispatch(pushToast("Logo updated", "success"));
    else dispatch(pushToast(res.payload?.message || "Upload failed", "error"));
    e.target.value = "";
  };

  return (
    <div>
      <PageHeader title="Settings" description="Platform branding shown across the app." />

      <Card className="p-6">
        <h3 className="mb-1 font-serif text-lg text-ink">Platform</h3>
        <p className="mb-5 text-sm text-ink-muted">Display name: <span className="font-medium text-ink">{name}</span></p>

        <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">Logo</p>
        <div className="flex items-center gap-5">
          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border border-ink/12 bg-cream-100">
            {logoUrl ? (
              <img src={mediaUrl(logoUrl)} alt={name} className="max-h-full max-w-full object-contain p-3" />
            ) : (
              <ImageIcon size={26} className="text-ink-muted" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <Button variant="teal" onClick={() => fileRef.current?.click()} loading={saving}>
              <UploadCloud size={16} /> Upload logo
            </Button>
            <p className="mt-2 text-xs text-ink-muted">PNG, JPG, WEBP or GIF · max 5MB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
        </div>
      </Card>
    </div>
  );
}
