"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function GearButton() {
  const { role, login, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setPassword("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError(null);

    const result = await login(password.trim());
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    close();

    if (result.role === "admin") router.push("/admin");
    else if (result.role === "captain") router.push("/captain");
  }

  async function handleLogout() {
    await logout();
    close();
    router.refresh();
  }

  return (
    <>
      <button
        aria-label={role ? `Signed in as ${role}` : "Settings"}
        onClick={() => setOpen(true)}
        className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
          role
            ? "border-schloss bg-schloss-tint text-schloss-bright hover:border-schloss-bright"
            : "border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100"
        }`}
      >
