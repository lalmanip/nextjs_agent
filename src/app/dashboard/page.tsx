"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, changePassword } from "@/lib/api";

type Profile = Record<string, string | number | null>;

const inputCls =
  "w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand";
const labelCls = "block text-xs font-medium text-brand-light mb-1";

const PROFILE_LABELS: { key: string; label: string }[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "companyName", label: "Company Name" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pinCode", label: "Pin Code" },
  { key: "officePhone", label: "Office Phone" },
  { key: "panNumber", label: "PAN Number" },
  { key: "gstNumber", label: "GST Number" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Profile>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ newPassword: "", confirmPassword: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  useEffect(() => {
    const userId = localStorage.getItem("userId") ?? "";
    if (!userId) { router.push("/"); return; }

    setProfile({
      firstName: localStorage.getItem("firstName") ?? "",
      lastName: localStorage.getItem("lastName") ?? "",
      email: localStorage.getItem("email") ?? "",
      userName: localStorage.getItem("userName") ?? "",
    });
    setEditForm({
      firstName: localStorage.getItem("firstName") ?? "",
      lastName: localStorage.getItem("lastName") ?? "",
      email: localStorage.getItem("email") ?? "",
      userName: localStorage.getItem("userName") ?? "",
    });
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(""); setEditSuccess("");
    setEditLoading(true);
    try {
      const token = localStorage.getItem("token") ?? "";
      const userId = localStorage.getItem("userId") ?? "";
      const updated = await updateProfile(userId, token, editForm);
      setProfile(updated);
      setEditSuccess("Profile updated successfully.");
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setEditLoading(false);
    }
  };

  const handlePwdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(""); setPwdSuccess("");
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError("New passwords do not match."); return;
    }
    setPwdLoading(true);
    try {
      const userName = localStorage.getItem("userName") ?? "";
      await changePassword(userName, pwdForm.newPassword);
      setPwdSuccess("Password changed successfully.");
      setPwdForm({ newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <h1 className="text-xl font-bold text-white">Vivance Travel</h1>
            <p className="text-xs text-brand-light">Agent Dashboard</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setShowEdit(true); setShowPwd(false); setEditError(""); setEditSuccess(""); }}
            className="rounded-lg bg-brand hover:bg-brand-light transition-colors px-4 py-2 text-sm font-medium text-white">
            Edit Profile
          </button>
          <button onClick={() => { setShowPwd(true); setShowEdit(false); setPwdError(""); setPwdSuccess(""); }}
            className="rounded-lg border border-brand text-brand-light hover:bg-white/10 transition-colors px-4 py-2 text-sm font-medium">
            Change Password
          </button>
          <button onClick={handleLogout}
            className="rounded-lg border border-white/20 text-white/60 hover:bg-white/10 transition-colors px-4 py-2 text-sm font-medium">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {loading && <p className="text-brand-light text-center">Loading profile…</p>}
        {error && <p className="text-red-400 text-center">{error}</p>}

        {/* Profile Card */}
        {profile && !showEdit && !showPwd && (
          <div className="rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl p-8 text-white">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-2xl font-bold">
                {String(profile.firstName ?? "?")[0]}{String(profile.lastName ?? "")[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.firstName} {profile.lastName}</h2>
                <p className="text-sm text-brand-light">{profile.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {PROFILE_LABELS.map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs text-brand-light mb-0.5">{label}</p>
                  <p className="text-sm text-white font-medium">{profile[key] ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Profile */}
        {showEdit && (
          <div className="rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl p-8 text-white">
            <h2 className="text-lg font-bold mb-6">Edit Profile</h2>
            {editError && <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/40 px-4 py-2 text-sm text-red-300">{editError}</div>}
            {editSuccess && <div className="mb-4 rounded-lg bg-green-500/20 border border-green-400/40 px-4 py-2 text-sm text-green-300">{editSuccess}</div>}
            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PROFILE_LABELS.map(({ key, label }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input
                    value={String(editForm[key] ?? "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
              <div className="sm:col-span-2 flex gap-3 mt-2">
                <button type="button" onClick={() => setShowEdit(false)}
                  className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-medium text-brand-light hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editLoading}
                  className="flex-1 rounded-lg bg-brand hover:bg-brand-light disabled:opacity-60 transition-colors py-2.5 font-semibold text-white">
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Change Password */}
        {showPwd && (
          <div className="rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl p-8 text-white max-w-md mx-auto">
            <h2 className="text-lg font-bold mb-6">Change Password</h2>
            {pwdError && <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/40 px-4 py-2 text-sm text-red-300">{pwdError}</div>}
            {pwdSuccess && <div className="mb-4 rounded-lg bg-green-500/20 border border-green-400/40 px-4 py-2 text-sm text-green-300">{pwdSuccess}</div>}
            <form onSubmit={handlePwdSubmit} className="space-y-4">
              {[
                { name: "newPassword", label: "New Password" },
                { name: "confirmPassword", label: "Confirm New Password" },
              ].map(({ name, label }) => (
                <div key={name}>
                  <label className={labelCls}>{label}</label>
                  <input type="password"
                    value={pwdForm[name as keyof typeof pwdForm]}
                    onChange={(e) => setPwdForm((p) => ({ ...p, [name]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setShowPwd(false)}
                  className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-medium text-brand-light hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={pwdLoading}
                  className="flex-1 rounded-lg bg-brand hover:bg-brand-light disabled:opacity-60 transition-colors py-2.5 font-semibold text-white">
                  {pwdLoading ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
