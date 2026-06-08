"use client";

import { useState, useEffect } from "react";
import type { Announcement } from "@/types";
import { announcementsApi, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, ScrollText, AlertTriangle, Info, Clock, Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; badgeClass: string }
> = {
  update: {
    label: "更新",
    icon: ScrollText,
    color: "text-blue-400",
    badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  event: {
    label: "活动",
    icon: Megaphone,
    color: "text-emerald-400",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  maintenance: {
    label: "维护",
    icon: AlertTriangle,
    color: "text-amber-400",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  general: {
    label: "通用",
    icon: Info,
    color: "text-zinc-400",
    badgeClass: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
};

const PRIORITY_STYLES: Record<string, { title: string; border: string }> = {
  urgent: { title: "text-red-400", border: "border-red-500/50" },
  high: { title: "text-amber-300", border: "border-amber-500/30" },
  normal: { title: "text-zinc-200", border: "" },
  low: { title: "text-zinc-400", border: "" },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

interface AnnouncementBoardProps {
  announcements?: Announcement[];
  loading?: boolean;
  /** If true, fetch announcements from /api/announcements automatically */
  autoFetch?: boolean;
  /** Increment to trigger a refresh */
  refreshTrigger?: number;
}

export function AnnouncementBoard({
  announcements: propAnnouncements,
  loading: propLoading,
  autoFetch = false,
  refreshTrigger,
}: AnnouncementBoardProps) {
  const [fetchedAnnouncements, setFetchedAnnouncements] = useState<Announcement[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Auto-fetch from API when enabled
  useEffect(() => {
    if (!autoFetch) return;
    let cancelled = false;
    async function load() {
      setFetchLoading(true);
      try {
        const res = await announcementsApi.list({ page_size: 50 });
        if (!cancelled) {
          setFetchedAnnouncements(Array.isArray(res) ? res : (res.items ?? []));
        }
      } catch {
        // silently fail - board is non-critical
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [autoFetch, refreshTrigger]);

  const announcements = autoFetch ? fetchedAnnouncements : (propAnnouncements ?? []);
  const loading = autoFetch ? fetchLoading : (propLoading ?? false);

  const filtered =
    activeTab === "all"
      ? announcements
      : announcements.filter((a) => a.category === activeTab);

  // Sort: pinned first, then by date
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });

  return (
    <div className="border border-zinc-700/50 rounded-lg bg-zinc-900/80 p-4">
      <div className="space-y-3">
        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-800/50">
          <TabsTrigger value="all" className="text-xs data-[state=active]:bg-zinc-700">
            全部
          </TabsTrigger>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="text-xs data-[state=active]:bg-zinc-700"
            >
              {cfg.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-zinc-800/40 h-20 border border-zinc-700/20" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm">
          暂无公告
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {sorted.map((announcement, index) => {
            const catConfig = CATEGORY_CONFIG[announcement.category] || CATEGORY_CONFIG.general;
            const priStyle = PRIORITY_STYLES[announcement.priority] || PRIORITY_STYLES.normal;
            const CatIcon = catConfig.icon;

            return (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => setSelectedAnnouncement(announcement)}
                className={`
                  group relative rounded-lg border bg-zinc-800/40 p-4 cursor-pointer
                  transition-colors hover:bg-zinc-800/70
                  ${announcement.is_pinned ? "border-purple-500/40 bg-purple-500/5" : "border-zinc-700/40"}
                  ${priStyle.border}
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`mt-0.5 ${catConfig.color}`}>
                    <CatIcon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {announcement.is_pinned && (
                        <Pin className="w-3 h-3 text-purple-400 shrink-0" />
                      )}
                      <h3 className={`font-medium text-sm truncate ${priStyle.title}`}>
                        {announcement.title}
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${catConfig.badgeClass}`}
                      >
                        {catConfig.label}
                      </Badge>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(announcement.created_at ?? new Date().toISOString())}
                      </span>
                      {announcement.author && (
                        <span className="text-[10px] text-zinc-500">
                          {announcement.author.username}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedAnnouncement}
        onOpenChange={(open) => !open && setSelectedAnnouncement(null)}
      >
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <DialogTitle className="text-zinc-100">
                  {selectedAnnouncement.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  公告详情
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      CATEGORY_CONFIG[selectedAnnouncement.category]?.badgeClass ||
                      CATEGORY_CONFIG.general.badgeClass
                    }
                  >
                    {CATEGORY_CONFIG[selectedAnnouncement.category]?.label || "通用"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      PRIORITY_STYLES[selectedAnnouncement.priority]
                        ? "border-zinc-700 text-zinc-300"
                        : "border-zinc-700 text-zinc-400"
                    }
                  >
                    {PRIORITY_STYLES[selectedAnnouncement.priority]?.title
                      ? `优先级: ${selectedAnnouncement.priority}`
                      : "普通"}
                  </Badge>
                  {selectedAnnouncement.is_pinned && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1">
                      <Pin className="w-3 h-3" /> 置顶
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {selectedAnnouncement.content}
                </p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedAnnouncement.created_at ? new Date(selectedAnnouncement.created_at).toLocaleString("zh-CN") : "未知时间"}
                  </span>
                  {selectedAnnouncement.author && (
                    <span>作者: {selectedAnnouncement.author.username}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
