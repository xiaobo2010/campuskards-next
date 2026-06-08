"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { userApi } from "@/lib/api";
import { API_BASE } from "@/lib/config";

interface AvatarUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar?: string | null;
  username?: string;
}

function resolveAvatarUrl(url: string): string {
  if (url.startsWith("http") || url.startsWith("/")) {
    return url.startsWith("/") && API_BASE ? `${API_BASE}${url}` : url;
  }
  return url;
}

export default function AvatarUploadDialog({
  open,
  onOpenChange,
  currentAvatar,
  username,
}: AvatarUploadDialogProps) {
  const { refreshUser } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 2 * 1024 * 1024;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      toast.error("文件过大", { description: "头像图片不能超过 2MB" });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("格式错误", { description: "请选择图片文件" });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await userApi.uploadAvatar(selectedFile);
      await refreshUser();
      toast.success("头像更新成功！");
      handleClose();
    } catch (error) {
      toast.error("上传失败", {
        description: error instanceof Error ? error.message : "未知错误",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onOpenChange(false);
  };

  const displayAvatar = previewUrl ?? (currentAvatar ? resolveAvatarUrl(currentAvatar) : null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">更换头像</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {username ? `为 ${username} 上传新头像` : "支持 JPG / PNG / WebP，最大 2MB"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-zinc-600 bg-zinc-800 flex items-center justify-center cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayAvatar} alt="头像预览" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-10 h-10 text-zinc-500" />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          <Button
            variant="outline"
            size="sm"
            className="border-zinc-600 text-zinc-300"
            onClick={() => fileInputRef.current?.click()}
          >
            选择图片
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="text-zinc-400">
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              "确认上传"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
