"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { DeckListOut } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Briefcase, Trash2, Layers } from "lucide-react";

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckListOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDecks();
  }, []);

  async function fetchDecks() {
    try {
      setLoading(true);
      const data = await api.get<DeckListOut[]>("/api/decks");
      setDecks(data);
    } catch (err) {
      console.error("Failed to fetch decks:", err);
      setError("加载卡组列表失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDeck(deckId: string) {
    if (!confirm("确定要删除这个卡组吗？")) {
      return;
    }
    try {
      await api.delete(`/api/decks/${deckId}`);
      setDecks(decks.filter((d) => d.id !== deckId));
    } catch (err) {
      console.error("Failed to delete deck:", err);
      alert("删除卡组失败");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <Button onClick={fetchDecks} className="bg-emerald-600 hover:bg-emerald-700">重试</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
                <Briefcase className="w-7 h-7 text-blue-400" />
                我的卡组
              </CardTitle>
              <Link href="/game/deck-builder">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="mr-2 h-4 w-4" />
                  创建新卡组
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {decks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Briefcase className="h-16 w-16 text-zinc-600 mb-4" />
                <p className="text-xl text-zinc-400 mb-4">你还没有任何卡组</p>
                <Link href="/game/deck-builder">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" />
                    创建第一个卡组
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {decks.map((deck) => (
                  <Card key={deck.id} className="border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 hover:border-blue-500/40 transition-all">
                    <CardHeader>
                      <CardTitle className="text-zinc-100 text-lg flex items-start justify-between">
                        <span className="flex items-center gap-2">
                          <span className="text-2xl">🃏</span>
                          {deck.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDeck(deck.id)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                      <CardDescription className="text-zinc-400 flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span>{(deck.cards?.length ?? 0)} 张卡牌</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Link href={`/game/deck-builder?deckId=${deck.id}`}>
                        <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                          编辑卡组
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
