"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type { AdminUser } from "@/types";
import { Copy, KeyRound, RefreshCw } from "lucide-react";

const PAGE_SIZE = 10;

type EditType = "ink" | "elo" | "role" | "status" | "resetKey";

interface EditDialog {
  type: EditType;
  user: AdminUser;
}

function generateResetKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [editDialog, setEditDialog] = useState<EditDialog | null>(null);
  const [editValue, setEditValue] = useState("");
  const [resetKeyValue, setResetKeyValue] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (e) {
      toast({
        title: "加载失败",
        description: e instanceof ApiError ? e.message : "无法获取用户列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openEdit = (type: EditType, user: AdminUser) => {
    setEditDialog({ type, user });
    setGeneratedKey(null);
    if (type === "ink") setEditValue(String(user.ink));
    else if (type === "elo") setEditValue(String(user.elo));
    else if (type === "resetKey") {
      const key = generateResetKey();
      setResetKeyValue(key);
      setGeneratedKey(key);
    } else {
      setEditValue("");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "已复制到剪贴板" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!editDialog) return;
    setSaving(true);
    try {
      const { type, user } = editDialog;

      if (type === "role") {
        await adminApi.updateUser(user.id, {
          role: user.role === "admin" ? "player" : "admin",
        });
        toast({ title: "角色已更新" });
      } else if (type === "status") {
        await adminApi.updateUser(user.id, { is_active: !user.is_active });
        toast({ title: user.is_active ? "已封禁用户" : "已解除封禁" });
      } else if (type === "resetKey") {
        const key = resetKeyValue.trim();
        if (!key) {
          toast({ title: "请输入或生成 PassKey", variant: "destructive" });
          return;
        }
        if (key.length > 64) {
          toast({ title: "PassKey 最长 64 字符", variant: "destructive" });
          return;
        }
        await adminApi.setUserResetKey(user.id, key);
        setGeneratedKey(key);
        toast({
          title: "PassKey 已设置",
          description: "请将密钥线下告知用户，用于登录页重置密码",
        });
      } else {
        const val = Number(editValue);
        if (Number.isNaN(val) || val < 0) {
          toast({ title: "请输入有效非负数字", variant: "destructive" });
          return;
        }
        await adminApi.updateUser(user.id, {
          ...(type === "ink" ? { ink: val } : { elo: val }),
        });
        toast({ title: "更新成功" });
      }

      if (type !== "resetKey") {
        setEditDialog(null);
        fetchUsers();
      }
    } catch (e) {
      toast({
        title: "操作失败",
        description: e instanceof ApiError ? e.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">用户管理</h1>
          <p className="text-sm text-zinc-500 mt-1">管理玩家账号、经济与密码重置 PassKey</p>
        </div>
        <Input
          placeholder="搜索用户名 / 邮箱"
          className="w-full sm:w-64 bg-zinc-900 border-zinc-700 text-zinc-200"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <p className="text-zinc-400">加载中…</p>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-zinc-900/60 text-zinc-400">
                  <th className="px-4 py-3 text-left font-medium">用户名</th>
                  <th className="px-4 py-3 text-left font-medium">邮箱</th>
                  <th className="px-4 py-3 text-left font-medium">ELO</th>
                  <th className="px-4 py-3 text-left font-medium">墨水</th>
                  <th className="px-4 py-3 text-left font-medium">角色</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-left font-medium">注册时间</th>
                  <th className="px-4 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-900/40 text-zinc-200">
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                    <td className="px-4 py-3">{u.elo}</td>
                    <td className="px-4 py-3">{u.ink}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === "admin" ? "warning" : "secondary"}>
                        {u.role === "admin" ? "管理员" : "玩家"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "secondary" : "destructive"}>
                        {u.is_active ? "正常" : "已封禁"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("zh-CN")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          onClick={() => openEdit("ink", u)}
                        >
                          墨水
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          onClick={() => openEdit("elo", u)}
                        >
                          ELO
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          onClick={() => openEdit("role", u)}
                        >
                          {u.role === "admin" ? "取消管理员" : "设为管理员"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-7 text-xs ${
                            u.is_active
                              ? "border-red-800/50 text-red-400 hover:bg-red-900/30"
                              : "border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/30"
                          }`}
                          onClick={() => openEdit("status", u)}
                        >
                          {u.is_active ? "封禁" : "解封"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-800/50 text-amber-400 hover:bg-amber-900/30"
                          onClick={() => openEdit("resetKey", u)}
                        >
                          <KeyRound className="w-3 h-3 mr-1" />
                          PassKey
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              共 {total} 条，第 {page}/{totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editDialog?.type === "ink" && `修改墨水 - ${editDialog.user.username}`}
              {editDialog?.type === "elo" && `修改 ELO - ${editDialog.user.username}`}
              {editDialog?.type === "role" &&
                `${editDialog.user.role === "admin" ? "取消管理员" : "设为管理员"} - ${editDialog.user.username}`}
              {editDialog?.type === "status" &&
                `${editDialog.user.is_active ? "封禁" : "解封"}用户 - ${editDialog.user.username}`}
              {editDialog?.type === "resetKey" && `设置 PassKey - ${editDialog.user.username}`}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editDialog?.type === "role" &&
                `将 ${editDialog.user.username} 的角色改为 ${editDialog.user.role === "admin" ? "player" : "admin"}`}
              {editDialog?.type === "status" &&
                (editDialog.user.is_active
                  ? "封禁后用户将无法登录，但可通过 PassKey 重置密码后仍可能登录（建议配合封禁使用）"
                  : "解除封禁后用户可正常登录")}
              {editDialog?.type === "resetKey" &&
                "生成或输入一次性 PassKey，告知用户在登录页「忘记密码」中使用。使用后自动失效。"}
              {(editDialog?.type === "ink" || editDialog?.type === "elo") && "输入新的数值"}
            </DialogDescription>
          </DialogHeader>

          {editDialog?.type === "resetKey" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">PassKey（最长 64 字符）</Label>
                <div className="flex gap-2">
                  <Input
                    value={resetKeyValue}
                    onChange={(e) => setResetKeyValue(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-sm"
                    maxLength={64}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 border-zinc-700"
                    onClick={() => {
                      const key = generateResetKey();
                      setResetKeyValue(key);
                      setGeneratedKey(null);
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {generatedKey && (
                <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 space-y-2">
                  <p className="text-sm text-emerald-400 font-medium">PassKey 已保存</p>
                  <p className="text-xs text-zinc-400 break-all font-mono">{generatedKey}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-700 text-emerald-400"
                    onClick={() => void copyToClipboard(generatedKey)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    复制 PassKey
                  </Button>
                </div>
              )}
            </div>
          )}

          {(editDialog?.type === "ink" || editDialog?.type === "elo") && (
            <div className="space-y-2">
              <Label>{editDialog.type === "ink" ? "墨水数量" : "ELO 分数"}</Label>
              <Input
                type="number"
                min={0}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog(null)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              {editDialog?.type === "resetKey" && generatedKey ? "关闭" : "取消"}
            </Button>
            {!(editDialog?.type === "resetKey" && generatedKey) && (
              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? "处理中…" : "确认"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
