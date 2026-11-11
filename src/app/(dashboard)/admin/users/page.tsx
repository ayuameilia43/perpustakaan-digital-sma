"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users, Plus, Search, RefreshCw,
  Edit, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle
} from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "LIBRARIAN" | "STUDENT" | "TEACHER" | "STAFF";
  nisn_nip: string | null;
  class_or_dept: string | null;
  status: "ACTIVE" | "SUSPENDED";
  is_active: boolean;
  created_at: string;
  _count: { borrowings: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-900/60 text-purple-300 border border-purple-700/50",
  LIBRARIAN: "bg-blue-900/60 text-blue-300 border border-blue-700/50",
  STUDENT: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
  TEACHER: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  STAFF: "bg-indigo-900/60 text-indigo-300 border border-indigo-700/50",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin", LIBRARIAN: "Pustakawan", STUDENT: "Siswa",
  TEACHER: "Guru", STAFF: "Staff",
};

type ModalMode = "create" | "edit" | "delete" | null;

export default function UsersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 15, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "STUDENT",
    nisn_nip: "", class_or_dept: "",
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: "15",
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      setUsers(json.data ?? []);
      setMeta(json.meta ?? { page: 1, limit: 15, total: 0, totalPages: 0 });
    } catch {
      setError("Gagal memuat data user");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/dashboard");
      return;
    }
    if (session?.user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [session, sessionStatus, router, fetchUsers]);

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const openCreate = () => {
    setForm({ name: "", email: "", password: "", role: "STUDENT", nisn_nip: "", class_or_dept: "" });
    setSelectedUser(null);
    setError("");
    setModalMode("create");
  };

  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: "", role: u.role, nisn_nip: u.nisn_nip ?? "", class_or_dept: u.class_or_dept ?? "" });
    setSelectedUser(u);
    setError("");
    setModalMode("edit");
  };

  const openDelete = (u: User) => {
    setSelectedUser(u);
    setError("");
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setError("");
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          nisn_nip: form.nisn_nip || undefined,
          class_or_dept: form.class_or_dept || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal membuat user"); return; }
      closeModal();
      fetchUsers();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name, email: form.email, role: form.role,
        nisn_nip: form.nisn_nip || null, class_or_dept: form.class_or_dept || null,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal memperbarui user"); return; }
      closeModal();
      fetchUsers();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal menonaktifkan user"); return; }
      closeModal();
      fetchUsers();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    fetchUsers();
  };

  const roleCount = (r: string) => users.filter(u => u.role === r).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-purple-400" />
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Kelola akun dan hak akses seluruh pengguna sistem
          </p>
        </div>
        <button
          id="btn-create-user"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-purple-900/30"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengguna
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(ROLE_LABELS).map(([r, label]) => (
          <div key={r} className="px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-xl font-black text-white">{roleCount(r)}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="search-user"
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama, email, NISN/NIP..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
        <div className="flex gap-2">
          <select
            id="filter-role"
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="">Semua Role</option>
            {Object.entries(ROLE_LABELS).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
          </select>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <button onClick={() => { setSearch(""); setRoleFilter(""); setStatusFilter(""); setPage(1); }}
            className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-5 py-3.5">Nama</th>
                <th className="text-left px-5 py-3.5">Role</th>
                <th className="text-left px-5 py-3.5 hidden md:table-cell">NISN/NIP</th>
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">Kelas/Dept</th>
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">Pinjaman</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-right px-5 py-3.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Tidak ada pengguna ditemukan</p>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 uppercase">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-slate-400 text-xs font-mono">
                      {u.nisn_nip ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-400 text-xs">
                      {u.class_or_dept ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-400 text-xs">
                      {u._count.borrowings} kali
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition ${
                          u.is_active
                            ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900"
                            : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                        }`}
                      >
                        {u.is_active
                          ? <><CheckCircle2 className="w-3.5 h-3.5" />Aktif</>
                          : <><XCircle className="w-3.5 h-3.5" />Suspend</>
                        }
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`btn-edit-user-${u.id}`}
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg hover:bg-blue-900/40 text-slate-400 hover:text-blue-300 transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-delete-user-${u.id}`}
                          onClick={() => openDelete(u)}
                          className="p-1.5 rounded-lg hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition"
                          title="Nonaktifkan"
                          disabled={u.id === session?.user.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Menampilkan {users.length} dari {meta.total} pengguna</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-300">{page} / {meta.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-black text-lg text-white">
                {modalMode === "create" && "Tambah Pengguna Baru"}
                {modalMode === "edit" && `Edit: ${selectedUser?.name}`}
                {modalMode === "delete" && "Konfirmasi Nonaktifkan"}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200 transition text-xl leading-none">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {modalMode === "delete" ? (
                <div className="space-y-4">
                  <p className="text-slate-300 text-sm">
                    Yakin ingin menonaktifkan akun <span className="font-bold text-white">{selectedUser?.name}</span>?
                    Pengguna akan berstatus SUSPENDED dan tidak bisa login, namun data riwayat tetap tersimpan.
                  </p>
                  {error && <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/50 px-3 py-2 rounded-lg">{error}</p>}
                  <div className="flex gap-3 justify-end">
                    <button onClick={closeModal} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition">Batal</button>
                    <button
                      id="btn-confirm-delete-user"
                      onClick={handleDelete}
                      disabled={submitting}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-60"
                    >
                      {submitting ? "Memproses..." : "Nonaktifkan"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {error && <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/50 px-3 py-2 rounded-lg">{error}</p>}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-slate-400 font-semibold block mb-1">Nama Lengkap *</label>
                      <input
                        id="input-user-name"
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
                        placeholder="Nama Lengkap"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">Email *</label>
                      <input
                        id="input-user-email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
                        placeholder="email@sekolah.sch.id"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">
                        {modalMode === "create" ? "Password *" : "Password Baru (opsional)"}
                      </label>
                      <input
                        id="input-user-password"
                        type="password"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
                        placeholder="Min. 8 karakter"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">Role *</label>
                      <select
                        id="input-user-role"
                        value={form.role}
                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                      >
                        {Object.entries(ROLE_LABELS).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">NISN / NIP</label>
                      <input
                        id="input-user-nisn-nip"
                        type="text"
                        value={form.nisn_nip}
                        onChange={e => setForm(f => ({ ...f, nisn_nip: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
                        placeholder="Nomor Induk Siswa/Pegawai"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">Kelas / Departemen</label>
                      <input
                        id="input-user-class"
                        type="text"
                        value={form.class_or_dept}
                        onChange={e => setForm(f => ({ ...f, class_or_dept: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition"
                        placeholder="XII-IPA-1 atau TU"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={closeModal} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition">Batal</button>
                    <button
                      id={`btn-submit-user-${modalMode}`}
                      onClick={modalMode === "create" ? handleCreate : handleEdit}
                      disabled={submitting}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-60"
                    >
                      {submitting ? "Menyimpan..." : modalMode === "create" ? "Simpan Pengguna" : "Perbarui"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
