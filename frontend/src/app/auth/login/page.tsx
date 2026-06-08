"use client";

import { Suspense, useState, useEffect, useCallback, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useApiAction } from "@/hooks/useApiAction";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { authApi, DEMO_MODE_ENABLED, DEMO_USERNAME, DEMO_PASSWORD } from "@/lib/api";

/* ---------- Inner form (needs useSearchParams) ---------- */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [loginVal, setLoginVal] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  // reset-password dialog
  const [rpOpen, setRpOpen] = useState(false);
  const [rpUser, setRpUser] = useState("");
  const [rpNewPwd, setRpNewPwd] = useState("");
  const [rpKey, setRpKey] = useState("");
  const [rpSubmitting, setRpSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      toast.success("注册成功，请登录");
    }
  }, [searchParams]);

  const loginAction = useCallback(
    (u: string, p: string, r: boolean) => login(u, p, r),
    [login],
  );

  const { execute: submitLogin, loading: submitting } = useApiAction(loginAction, {
    onSuccess: () => {
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl ? decodeURIComponent(callbackUrl) : "/game");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitLogin(loginVal, password, remember);
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!rpUser || !rpNewPwd || !rpKey) {
      toast.error("请填写所有字段");
      return;
    }
    setRpSubmitting(true);
    try {
      await authApi.resetPassword({ username: rpUser, new_password: rpNewPwd, reset_key: rpKey });
      toast.success("密码重置成功，请使用新密码登录");
      setRpOpen(false);
      setRpUser("");
      setRpNewPwd("");
      setRpKey("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "重置失败，请检查重置Key";
      toast.error(message);
    } finally {
      setRpSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 py-8"
      style={{
        backgroundImage: "url(/images/login-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Blur + dark overlay (must not block clicks) */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/60 pointer-events-none" />

      {/* Hero text - stacked above card, no absolute */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-[0_2px_12px_rgba(168,85,247,0.6)]">
          欢迎来到 CampusKards!
        </h2>
        <p className="mt-1 text-sm sm:text-base text-purple-200 drop-shadow-md">
          即刻加入校园卡牌对战!
        </p>
      </motion.div>

      {/* Login card */}
      <Card className="relative z-20 w-full max-w-md border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-zinc-100">
              登录 CampusKards
            </CardTitle>
            <CardDescription className="text-zinc-400">
              输入你的账号信息开始校园卡牌对战
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login" className="text-zinc-300">
                用户名或邮箱
              </Label>
              <Input
                id="login"
                type="text"
                placeholder="请输入用户名或邮箱"
                value={loginVal}
                onChange={(e) => setLoginVal(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500"
                autoComplete="username"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500"
                autoComplete="current-password"
                required
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                  disabled={submitting}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm text-zinc-400 cursor-pointer"
                >
                  记住我（30天自动登录）
                </Label>
              </div>
              <Dialog open={rpOpen} onOpenChange={setRpOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="text-sm text-purple-400 hover:text-purple-300 hover:underline"
                  >
                    忘记密码?
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                  <DialogHeader>
                    <DialogTitle className="text-zinc-100">重置密码</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleResetPassword} className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label className="text-zinc-300">用户名</Label>
                      <Input
                        value={rpUser}
                        onChange={(e) => setRpUser(e.target.value)}
                        className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">新密码</Label>
                      <Input
                        type="password"
                        value={rpNewPwd}
                        onChange={(e) => setRpNewPwd(e.target.value)}
                        className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">重置Key（管理员提供）</Label>
                      <p className="text-xs text-zinc-500">
                        联系管理团队:13306673106@163.com , 我们会为您提供一次性重置密钥。
                      </p>
                      <Input
                        value={rpKey}
                        onChange={(e) => setRpKey(e.target.value)}
                        className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                      disabled={rpSubmitting}
                    >
                      {rpSubmitting ? "重置中..." : "重置密码"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={submitting || !loginVal || !password}
            >
              {submitting ? "登录中..." : "登 录"}
            </Button>
            {DEMO_MODE_ENABLED && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-center">
                <p className="text-xs text-amber-300 font-medium">演示模式已启用（无需后端）</p>
                <p className="text-[11px] text-amber-200/60 mt-1">
                  用户名 <code className="px-1 py-0.5 rounded bg-black/30 text-amber-200 font-mono">{DEMO_USERNAME}</code>
                  {" / "}
                  密码 <code className="px-1 py-0.5 rounded bg-black/30 text-amber-200 font-mono">{DEMO_PASSWORD}</code>
                </p>
              </div>
            )}
            <p className="text-sm text-zinc-500 text-center">
              还没有账号？{" "}
              <Link
                href="/auth/register"
                className="text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                立即注册
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
          <p className="text-zinc-500">加载中...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
