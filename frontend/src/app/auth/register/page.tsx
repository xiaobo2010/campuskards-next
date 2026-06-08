"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

function validateUsername(v: string): string | null {
  if (v.length < 3) return "用户名至少3个字符";
  if (v.length > 32) return "用户名最多32个字符";
  return null;
}

function validateEmail(v: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "请输入有效的邮箱地址";
  return null;
}

function validatePassword(v: string): string | null {
  if (v.length < 8) return "密码至少8个字符";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Frontend validation
    const usernameErr = validateUsername(username);
    if (usernameErr) {
      toast.error(usernameErr);
      return;
    }
    const emailErr = validateEmail(email);
    if (emailErr) {
      toast.error(emailErr);
      return;
    }
    const passwordErr = validatePassword(password);
    if (passwordErr) {
      toast.error(passwordErr);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      await register(username, email, password);
      toast.success("注册成功，正在登录...");
      router.push("/game");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "注册失败，请稍后再试";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{
        backgroundImage: "url(/images/login-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Blur + dark overlay (must not block clicks) */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/60 pointer-events-none" />
      <Card className="relative z-10 w-full max-w-md border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-zinc-100">
              注册 CampusKards
            </CardTitle>
            <CardDescription className="text-zinc-400">
              创建账号加入校园卡牌对战
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="3-32个字符"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少8个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={
                submitting ||
                !username ||
                !email ||
                !password ||
                !confirmPassword
              }
            >
              {submitting ? "注册中..." : "注 册"}
            </Button>
            <p className="text-sm text-zinc-500 text-center">
              已有账号？{" "}
              <Link
                href="/auth/login"
                className="text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                立即登录
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
