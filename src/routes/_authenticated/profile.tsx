import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText, Loader2, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — AI Interview Practice" },
      { name: "description", content: "Manage your name, contact details, education, skills, resume and profile photo." },
      { property: "og:title", content: "Your profile" },
      { property: "og:description", content: "Keep your details and resume up to date so interviews stay relevant." },
    ],
  }),
  component: ProfilePage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().max(20).regex(/^[0-9+\-()\s]*$/, "Digits and + - ( ) only"),
  education: z.string().trim().max(500),
  skills: z.string().trim().max(500),
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "resume" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ full_name: "", phone: "", education: "", skills: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      education: profile.education ?? "",
      skills: (profile.skills ?? []).join(", "),
    });
    if (profile.avatar_url) {
      void supabase.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_url, 3600)
        .then(({ data }) => setAvatarPreview(data?.signedUrl ?? null));
    }
  }, [profile]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      education: parsed.data.education,
      skills: parsed.data.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 30),
    }).eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile saved");
  }

  async function upload(kind: "avatar" | "resume", file: File) {
    const limits = { avatar: 3, resume: 8 };
    if (file.size > limits[kind] * 1024 * 1024) {
      toast.error(`File must be under ${limits[kind]}MB`);
      return;
    }
    setUploading(kind);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const bucket = kind === "avatar" ? "avatars" : "resumes";
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      setUploading(null);
      toast.error(error.message);
      return;
    }
    const patch =
      kind === "avatar" ? { avatar_url: path } : { resume_url: path, resume_name: file.name.slice(0, 120) };
    await supabase.from("profiles").update(patch).eq("id", userId);
    if (kind === "avatar") {
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      setAvatarPreview(data?.signedUrl ?? null);
    }
    setUploading(null);
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success(kind === "avatar" ? "Photo updated" : "Resume uploaded");
  }

  async function openResume() {
    if (!profile?.resume_url) return;
    const { data } = await supabase.storage.from("resumes").createSignedUrl(profile.resume_url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your details shape the questions the AI interviewer asks.</p>

        {isLoading ? (
          <Loader2 className="mt-10 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <form onSubmit={save} className="mt-6 space-y-6">
            <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-accent">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Your profile photo" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Profile photo</p>
                <p className="text-xs text-muted-foreground">JPG or PNG, up to 3MB.</p>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
                  {uploading === "avatar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload("avatar", f);
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                {errors["full_name"] ? <p className="text-sm text-destructive">{errors["full_name"]}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                {errors["phone"] ? <p className="text-sm text-destructive">{errors["phone"]}</p> : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="education">Education</Label>
                <Textarea
                  id="education"
                  value={form.education}
                  onChange={(e) => setForm({ ...form, education: e.target.value })}
                  placeholder="B.Tech Computer Science, 2024 — VIT Vellore"
                  className="min-h-20"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="skills">Skills (comma separated)</Label>
                <Textarea
                  id="skills"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="React, Node.js, PostgreSQL, System design"
                  className="min-h-20"
                />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
              <p className="text-sm font-medium">Resume</p>
              <p className="text-xs text-muted-foreground">PDF, DOC or TXT, up to 8MB. Only you can access it.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
                  {uploading === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload resume
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload("resume", f);
                    }}
                  />
                </label>
                {profile?.resume_url ? (
                  <button type="button" onClick={() => void openResume()} className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
                    <FileText className="h-4 w-4" />
                    {profile.resume_name ?? "View resume"}
                  </button>
                ) : null}
              </div>
            </section>

            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
