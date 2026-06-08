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
import type { Card, CardUpdateIn } from "@/types";

const PAGE_SIZE = 15;

const FACTIONS = ["key_class", "arts_class", "normal_class", "intl_class", "competition_class"];
const FACTION_LABELS: Record<string, string> = {
  key_class: "重点班",
  arts_class: "艺体班",
  normal_class: "普通班",
  intl_class: "国际班",
  competition_class: "竞赛班",
};
const CARD_TYPES = ["unit", "command", "buff", "counter"];
const TYPE_LABELS: Record<string, string> = {
  unit: "生物",
  command: "指令",
  buff: "增益",
  counter: "反击",
};
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

function toCardUpdate(form: Partial<Card>): CardUpdateIn {
  return {
    name: form.name,
    name_en: form.name_en,
    faction_code: form.faction_code,
    card_type: form.card_type,
    unit_type: form.unit_type,
    cost: form.cost,
    power: form.power,
    grit: form.grit,
    spirit: form.spirit,
    effect_text: form.effect_text,
    effect_code: form.effect_code,
    rarity: form.rarity,
    flavor_text: form.flavor_text,
    artist: form.artist,
    image_url: form.image_url,
    is_token: form.is_token,
    set_code: form.set_code,
  };
}

export default function AdminCardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [factionFilter, setFactionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [editCard, setEditCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listCards({
        page,
        page_size: PAGE_SIZE,
        ...(factionFilter !== "all" ? { faction_code: factionFilter } : {}),
        ...(typeFilter !== "all" ? { card_type: typeFilter } : {}),
        ...(rarityFilter !== "all" ? { rarity: rarityFilter } : {}),
      });
      setCards(res.items);
      setTotal(res.total);
    } catch (e) {
      toast({
        title: "加载失败",
        description: e instanceof ApiError ? e.message : "无法获取卡牌列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, factionFilter, typeFilter, rarityFilter, toast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const openEdit = (card: Card) => {
    setEditCard(card);
    setEditForm({ ...card });
  };

  const handleSave = async () => {
    if (!editCard) return;
    try {
      await adminApi.updateCard(editCard.id, toCardUpdate(editForm));
      toast({ title: "更新成功" });
      setEditCard(null);
      fetchCards();
    } catch (e) {
      toast({
        title: "更新失败",
        description: e instanceof ApiError ? e.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  const numField = (
    label: string,
    key: keyof Pick<Card, "cost" | "power" | "grit" | "spirit">,
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={editForm[key] ?? ""}
        onChange={(e) =>
          setEditForm({
            ...editForm,
            [key]: e.target.value === "" ? null : Number(e.target.value),
          })
        }
        className="bg-zinc-800 border-zinc-700 text-zinc-200"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">卡牌管理</h1>
        <p className="text-sm text-zinc-500 mt-1">编辑卡牌属性、数值与效果文本</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-zinc-400 text-xs">势力</Label>
          <Select
            value={factionFilter}
            onValueChange={(v) => {
              setFactionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {FACTIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FACTION_LABELS[f] || f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-zinc-400 text-xs">类型</Label>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {CARD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t] || t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-zinc-400 text-xs">稀有度</Label>
          <Select
            value={rarityFilter}
            onValueChange={(v) => {
              setRarityFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {RARITIES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-zinc-500">共 {total} 张</span>
      </div>

      {loading ? (
        <p className="text-zinc-400">加载中…</p>
      ) : (
        <>
          <div className="rounded-lg border border-zinc-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">名称</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">势力</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">类型</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">费用</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">攻防精</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">稀有度</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {cards.map((card) => (
                  <tr key={card.id} className="hover:bg-zinc-900/40 text-zinc-200">
                    <td className="px-4 py-3 font-medium">{card.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {FACTION_LABELS[card.faction_code] || card.faction_code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                        {TYPE_LABELS[card.card_type] || card.card_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{card.cost}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {[card.power, card.grit, card.spirit]
                        .map((v) => v ?? "—")
                        .join(" / ")}
                    </td>
                    <td className="px-4 py-3">{card.rarity ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => openEdit(card)}
                      >
                        编辑
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              第 {page}/{totalPages} 页
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

      <Dialog open={!!editCard} onOpenChange={(open) => !open && setEditCard(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">编辑卡牌 - {editCard?.name}</DialogTitle>
            <DialogDescription className="text-zinc-400">修改卡牌属性（ID: {editCard?.id}）</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>中文名</Label>
                <Input
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <Label>英文名</Label>
                <Input
                  value={editForm.name_en || ""}
                  onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value || null })}
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>势力</Label>
                <Select
                  value={editForm.faction_code || ""}
                  onValueChange={(v) => setEditForm({ ...editForm, faction_code: v })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FACTION_LABELS[f] || f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select
                  value={editForm.card_type || ""}
                  onValueChange={(v) => setEditForm({ ...editForm, card_type: v })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>稀有度</Label>
                <Select
                  value={editForm.rarity || ""}
                  onValueChange={(v) => setEditForm({ ...editForm, rarity: v })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {numField("费用", "cost")}
              {numField("力量", "power")}
              {numField("坚韧", "grit")}
              {numField("精神", "spirit")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>单位子类型</Label>
                <Input
                  value={editForm.unit_type || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, unit_type: e.target.value || null })
                  }
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <Label>系列代码</Label>
                <Input
                  value={editForm.set_code || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, set_code: e.target.value || null })
                  }
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>效果文本</Label>
              <Textarea
                value={editForm.effect_text || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, effect_text: e.target.value || null })
                }
                rows={3}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
            <div className="space-y-2">
              <Label>效果代码</Label>
              <Input
                value={editForm.effect_code || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, effect_code: e.target.value || null })
                }
                className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>风味文本</Label>
              <Textarea
                value={editForm.flavor_text || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, flavor_text: e.target.value || null })
                }
                rows={2}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>画师</Label>
                <Input
                  value={editForm.artist || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, artist: e.target.value || null })
                  }
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <Label>图片 URL</Label>
                <Input
                  value={editForm.image_url || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, image_url: e.target.value || null })
                  }
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editForm.is_token ?? false}
                onCheckedChange={(v) => setEditForm({ ...editForm, is_token: v })}
              />
              <Label>衍生 token 卡</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCard(null)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              取消
            </Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
