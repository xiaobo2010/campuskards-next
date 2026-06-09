"use client";

import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authApi } from "@/lib/api";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUsername?: string;
}

export default function ResetPasswordDialog({
  open,
  onOpenChange,
  defaultUsername = "",
}: ResetPasswordDialogProps) {
  const [username, setUsername] = useState(defaultUsername);
  const [resetKey, setResetKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setResetKey("");
      setNewPassword("");
      setConfirmPassword("");
    } else if (defaultUsername) {
      setUsername(defaultUsername);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !resetKey || !newPassword) {
      toast.error("请填写所有字段");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({
        username,
        new_password: newPassword,
        reset_key: resetKey,
      });
      toast.success("密码重置成功，请使用新密码登录");
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "重置失败，请检查重置密钥");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">重置密码</DialogTitle>
          <DialogDescription className="text-zinc-400">
            使用管理员提供的重置密钥找回密码。重置成功后密钥将失效。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-zinc-300">用户名</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">重置密钥</Label>
            <Input
              value={resetKey}
              onChange={(e) => setResetKey(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
              placeholder="向管理员索取"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">新密码</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">确认新密码</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
              autoComplete="new-password"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {submitting ? "重置中..." : "确认重置"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
