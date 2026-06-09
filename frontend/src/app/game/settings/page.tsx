"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Lock, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import AvatarUploadDialog from "@/components/game/avatar-upload-dialog";
import { UserAvatar } from "@/components/game/user-avatar";
export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [avatarDialog, setAvatarDialog] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const handleUpdateEmail = async () => {
    if (!newEmail) { toast.error("请输入新邮箱"); return; }
    setEmailSubmitting(true);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ email: newEmail }),
      });
      toast.success("邮箱修改成功");
      setNewEmail("");
      await refreshUser();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "修改失败");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!curPwd || !newPwd) { toast.error("请填写所有字段"); return; }
    setPwdSubmitting(true);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ current_password: curPwd, new_password: newPwd }),
      });
      toast.success("密码修改成功");
      setCurPwd("");
      setNewPwd("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "修改失败");
    } finally {
      setPwdSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">账号设置</h1>

        {/* Profile info */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-purple-400" /> 个人信息
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className="cursor-pointer hover:ring-2 ring-purple-500 rounded-full transition-all"
                onClick={() => setAvatarDialog(true)}
              >
                {user ? (
                  <UserAvatar
                    username={user.username}
                    avatarUrl={user.avatar_url}
                    className="w-16 h-16 text-2xl"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-zinc-400" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium">{user?.username}</p>
                <p className="text-sm text-zinc-400">ELO {user?.elo}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAvatarDialog(true)}>
              更换头像
            </Button>
          </div>
        </motion.section>

        {/* Email change */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" /> 邮箱
          </h2>
          <p className="text-sm text-zinc-400">当前邮箱：{user?.email}</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="输入新邮箱地址"
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleUpdateEmail} disabled={emailSubmitting}>
              {emailSubmitting ? "提交中..." : "更新邮箱"}
            </Button>
          </div>
        </motion.section>

        {/* Password change */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" /> 修改密码
          </h2>
          <div className="space-y-3">
            <input
              type="password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              placeholder="当前密码"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="新密码"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Button onClick={handleUpdatePassword} disabled={pwdSubmitting}>
              {pwdSubmitting ? "提交中..." : "修改密码"}
            </Button>
          </div>
        </motion.section>
      </div>

      <AvatarUploadDialog open={avatarDialog} onOpenChange={setAvatarDialog} />
    </div>
  );
}
