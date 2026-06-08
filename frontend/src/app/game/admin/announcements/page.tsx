"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Announcement, AnnouncementCreateIn, AnnouncementUpdateIn } from "@/types";

const PAGE_SIZE = 10;

const CATEGORIES: Announcement["category"][] = ["update", "event", "maintenance", "general"];
const CATEGORY_LABELS: Record<string, string> = {
  update: "更新", event: "活动", maintenance: "维护", general: "综合",
};
const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  update: "default", event: "secondary", maintenance: "destructive", general: "outline",
};

const PRIORITIES: Announcement["priority"][] = ["low", "normal", "high", "urgent"];
const PRIORITY_LABELS: Record<string, string> = {
  low: "低", normal: "普通", high: "高", urgent: "紧急",
};
const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  low: "outline", normal: "secondary", high: "default", urgent: "destructive",
};

function emptyForm(): { title: string; content: string; category: Announcement["category"]; priority: Announcement["priority"]; is_pinned: boolean } {
  return { title: "", content: "", category: "general", priority: "normal", is_pinned: false };
}

export default function AdminAnnouncementsPage() {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const [form, setForm] = useState(emptyForm());

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listAnnouncements({ page, page_size: PAGE_SIZE });
      setAnnouncements(res.items);
      setTotal(res.total);
    } catch (e) {
      toast({
        title: "加载失败",
        description: e instanceof ApiError ? e.message : "无法获取公告列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const openCreate = () => {
    setForm(emptyForm());
    setCreateOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditTarget(a);
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      priority: a.priority,
      is_pinned: a.is_pinned ?? false,
    });
  };

  const handleCreate = async () => {
    try {
      const data: AnnouncementCreateIn = {
        title: form.title,
        content: form.content,
        category: form.category,
        priority: form.priority,
        is_pinned: form.is_pinned,
      };
      await adminApi.createAnnouncement(data);
      toast({ title: "创建成功" });
      setCreateOpen(false);
      fetchAnnouncements();
    } catch (e) {
      toast({
        title: "创建失败",
        description: e instanceof ApiError ? e.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    try {
      const data: AnnouncementUpdateIn = {
        title: form.title,
        content: form.content,
        category: form.category,
        priority: form.priority,
        is_pinned: form.is_pinned,
      };
      await adminApi.updateAnnouncement(editTarget.id, data);
      toast({ title: "更新成功" });
      setEditTarget(null);
      fetchAnnouncements();
    } catch (e) {
      toast({
        title: "更新失败",
        description: e instanceof ApiError ? e.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteAnnouncement(deleteTarget.id);
      toast({ title: "删除成功" });
      setDeleteTarget(null);
      fetchAnnouncements();
    } catch (e) {
      toast({
        title: "删除失败",
        description: e instanceof ApiError ? e.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  const handleTogglePin = async (a: Announcement) => {
    try {
      await adminApi.togglePinAnnouncement(a.id, !a.is_pinned);
      toast({ title: a.is_pinned ? "取消置顶" : "已置顶" });
      fetchAnnouncements();
    } catch (e) {
      toast({
        title: "操作失败",
        description: e instanceof ApiError ? e.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  const formDialog = (
    <div className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label>标题</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="bg-zinc-800 border-zinc-700 text-zinc-200"
        />
      </div>
      <div className="space-y-2">
        <Label>内容</Label>
        <Textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={5}
          className="bg-zinc-800 border-zinc-700 text-zinc-200"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>类别</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Announcement["category"] })}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>优先级</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Announcement["priority"] })}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={form.is_pinned} onCheckedChange={(v) => setForm({ ...form, is_pinned: v })} />
        <Label>置顶</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">公告管理</h1>
          <p className="text-sm text-zinc-500 mt-1">发布、编辑与置顶游戏公告</p>
        </div>
          <Button
            onClick={openCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            + 新建公告
          </Button>
        </div>

        {loading ? (
          <p className="text-zinc-400">加载中…</p>
        ) : (
          <>
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">标题</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">类别</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">优先级</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">置顶</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">作者</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">发布时间</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors ${
                        a.is_pinned ? "bg-purple-500/5" : ""
                      }`}
                    >
                      <td className={`px-4 py-3 font-medium ${
                        a.priority === "urgent" ? "text-red-400" : "text-zinc-200"
                      }`}>
                        {a.is_pinned && <span className="text-purple-400 mr-1">📌</span>}
                        {a.title}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={CATEGORY_VARIANTS[a.category] || "outline"}>
                          {CATEGORY_LABELS[a.category]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={PRIORITY_VARIANTS[a.priority] || "outline"}>
                          {PRIORITY_LABELS[a.priority]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {a.is_pinned ? "是" : "否"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {a.author?.username ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {a.created_at ? new Date(a.created_at).toLocaleDateString("zh-CN") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            onClick={() => openEdit(a)}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            onClick={() => handleTogglePin(a)}
                          >
                            {a.is_pinned ? "取消置顶" : "置顶"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-800/50 text-red-400 hover:bg-red-900/30"
                            onClick={() => setDeleteTarget(a)}
                          >
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">新建公告</DialogTitle>
              <DialogDescription className="text-zinc-400">填写公告信息</DialogDescription>
            </DialogHeader>
            {formDialog}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                取消
              </Button>
              <Button
                onClick={handleCreate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">编辑公告 - {editTarget?.title}</DialogTitle>
              <DialogDescription className="text-zinc-400">修改公告内容</DialogDescription>
            </DialogHeader>
            {formDialog}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditTarget(null)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                取消
              </Button>
              <Button
                onClick={handleEdit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">确认删除</DialogTitle>
              <DialogDescription className="text-zinc-400">
                确定要删除公告「{deleteTarget?.title}」吗？此操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                取消
              </Button>
              <Button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
