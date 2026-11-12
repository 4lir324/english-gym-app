"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";

// --- کامپوننت Toast ---
const Toast = ({ msg, type }: { msg: string, type: 'success' | 'error' }) => (
  <div style={{
      position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:10000,
      background: type==='success'?'#10b981':'#ef4444', color:'white', padding:'10px 20px',
      borderRadius:'50px', fontWeight:'bold', boxShadow:'0 10px 30px rgba(0,0,0,0.3)',
      display:'flex', alignItems:'center', gap:'10px', animation: 'fadeIn 0.3s ease-out'
  }}>
    <i className={`fas ${type === 'success' ? 'fa-check' : 'fa-times'}`}></i> {msg}
  </div>
);

// --- کامپوننت Modal با Portal (برای حل مشکل CSS) ---
const ConfirmModal = ({ name, onConfirm, onCancel }: { name: string, onConfirm: () => void, onCancel: () => void }) => {
  // اگر در سرور رندر می‌شود چیزی برنگردان
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
      {/* لایه تاریک پشت */}
      <div className="modal-backdrop" onClick={onCancel}></div>

      {/* خود پنجره مودال */}
      <div className="confirm-modal">
        <div className="modal-icon">
          <i className="fas fa-trash-alt"></i>
        </div>
        <div>
          <h3 style={{color:'white', fontSize:'1.2rem', marginBottom:'5px'}}>Delete User?</h3>
          <p style={{color:'#94a3b8', fontSize:'0.9rem', lineHeight:'1.5'}}>
            Are you sure you want to delete <b style={{color:'white'}}>"{name}"</b>?
            <br/> This action cannot be undone.
          </p>
        </div>
        <div className="modal-actions">
          <button onClick={onCancel} className="btn-cancel">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-delete">
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body // رندر مستقیم در body
  );
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [loading, setLoading] = useState(false);

  // وضعیت‌ها
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [deleteModal, setDeleteModal] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      // @ts-ignore
      if (session?.user?.role !== "admin") router.push("/");
      else fetchUsers();
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, session, router]);

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      showToast("User created successfully!", "success");
      setNewUser({ username: "", password: "", role: "user" });
      fetchUsers();
    } else {
      showToast(data.error, "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const res = await fetch(`/api/admin/users?id=${deleteModal.id}`, { method: "DELETE" });
    if (res.ok) {
        showToast("User deleted successfully", "success");
        fetchUsers();
    } else {
        showToast("Error deleting user", "error");
    }
    setDeleteModal(null);
  };

  if (status === "loading") return <div className="text-white text-center mt-20">Loading...</div>;

  return (
    <div className="app-container" style={{maxWidth: '500px'}}>

      {/* Toast */}
      {toast && createPortal(<Toast msg={toast.msg} type={toast.type} />, document.body)}

      {/* Modal (با Portal) */}
      {deleteModal && (
        <ConfirmModal
          name={deleteModal.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      {/* Header */}
      <div className="header-row">
        <h2 className="brand-title" style={{color:'#facc15'}}>Admin Panel</h2>
        <Link href="/" className="profile-chip" style={{background:'rgba(255,255,255,0.1)'}}>
           <i className="fas fa-arrow-left"></i> Back
        </Link>
      </div>

      {/* Add User Form */}
      <form onSubmit={handleCreate} className="flex flex-col gap-3 p-4 rounded-3xl" style={{background:'rgba(0,0,0,0.2)', border:'1px dashed rgba(255,255,255,0.1)'}}>
        <h3 className="text-white font-bold text-sm mb-1">Add New User</h3>
        <div className="flex gap-2">
            <input className="input-field" placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
            <select className="input-field" style={{width:'100px'}} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
        </div>
        <input className="input-field" placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
        <button disabled={loading} className="btn btn-primary cursor-pointer" style={{height:'45px', fontSize:'1rem'}}>
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>

      {/* Users List */}
      <div className="flex flex-col gap-2 overflow-y-auto" style={{maxHeight:'300px'}}>
        <h3 className="text-white font-bold text-sm ml-2">All Users ({users.length})</h3>
        {users.map((u) => (
          <div key={u._id} className="flex justify-between items-center p-3 rounded-2xl" style={{background:'rgba(255,255,255,0.05)'}}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${u.role==='admin' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white'}`}>
                <i className={`fas ${u.role==='admin' ? 'fa-crown' : 'fa-user'}`}></i>
              </div>
              <div className="flex flex-col">
                <span className="text-white text-sm font-bold">{u.username}</span>
                <span className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-lg bg-black/30 text-gray-300 border border-white/5">{u.role}</span>
                {/* @ts-ignore */}
                {session?.user?.name !== u.username && (
                    <button onClick={() => setDeleteModal({ id: u._id, name: u.username })} className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer">
                        <i className="fas fa-trash text-xs"></i>
                    </button>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}