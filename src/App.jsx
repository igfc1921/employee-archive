import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, X, FileText, FileSpreadsheet, Upload, Trash2, Download,
  Users, Building2, Mail, Phone, Calendar, StickyNote, AlertCircle,
  Loader2, LogIn, LogOut, FolderOpen,
} from 'lucide-react';
import * as drive from './drive.js';
import { SHARED_FOLDER_ID } from './config.js';

const DEPARTMENTS = ['الموارد البشرية', 'المالية', 'تقنية المعلومات', 'المبيعات', 'التسويق', 'العمليات', 'الإدارة', 'أخرى'];
const FOLDER_KEY = 'archive_folder_id';
const FOLDER_NAME_KEY = 'archive_folder_name';

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}
function fileIcon(type) {
  if (type?.includes('pdf')) return <FileText size={16} className="shrink-0" />;
  return <FileSpreadsheet size={16} className="shrink-0" />;
}
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [folder, setFolder] = useState(() => {
    if (SHARED_FOLDER_ID) return { id: SHARED_FOLDER_ID, name: 'الأرشيف المشترك' };
    const id = localStorage.getItem(FOLDER_KEY);
    const name = localStorage.getItem(FOLDER_NAME_KEY);
    return id ? { id, name } : null;
  });
  const [dataFileId, setDataFileId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('الكل');
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    drive.initAuth((token) => {
      setSignedIn(true);
      setAuthReady(true);
    }).then(() => setAuthReady(true));
  }, []);

  const loadData = useCallback(async (folderId) => {
    setLoading(true);
    setError(null);
    try {
      const fileId = await drive.findOrCreateDataFile(folderId);
      setDataFileId(fileId);
      const data = await drive.readDataFile(fileId);
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('تعذر تحميل البيانات من Drive. تأكد إن المجلد صحيح وعندك صلاحية عليه.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn && folder) loadData(folder.id);
  }, [signedIn, folder, loadData]);

  const handleSignIn = () => drive.requestAccessToken();
  const handleSignOut = () => {
    drive.signOut();
    setSignedIn(false);
    setEmployees([]);
    setDataFileId(null);
  };

  const handlePickFolder = async () => {
    const picked = await drive.openFolderPicker();
    if (picked) {
      localStorage.setItem(FOLDER_KEY, picked.id);
      localStorage.setItem(FOLDER_NAME_KEY, picked.name);
      setFolder(picked);
    }
  };

  const handleChangeFolder = () => {
    localStorage.removeItem(FOLDER_KEY);
    localStorage.removeItem(FOLDER_NAME_KEY);
    setFolder(null);
    setEmployees([]);
    setDataFileId(null);
  };

  const persist = async (updated) => {
    try {
      await drive.writeDataFile(dataFileId, updated);
      setEmployees(updated);
      return true;
    } catch (e) {
      setError('تعذر حفظ البيانات على Drive، حاول مرة أخرى');
      return false;
    }
  };

  const handleAddOrEdit = async (formData) => {
    if (editTarget) {
      const updated = employees.map((e) => (e.id === editTarget.id ? { ...e, ...formData } : e));
      const ok = await persist(updated);
      if (ok) showToast('تم تحديث بيانات الموظف');
    } else {
      const newEmp = { id: 'emp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), attachments: [], ...formData };
      const ok = await persist([newEmp, ...employees]);
      if (ok) showToast('تمت إضافة الموظف');
    }
    setFormOpen(false);
    setEditTarget(null);
  };

  const handleDeleteEmployee = async (id) => {
    const target = employees.find((e) => e.id === id);
    const updated = employees.filter((e) => e.id !== id);
    const ok = await persist(updated);
    if (ok) {
      showToast('تم حذف الموظف');
      if (selectedId === id) setSelectedId(null);
      // نحذف مرفقاته من Drive بالخلفية (لا نوقف الواجهة بانتظارها)
      (target?.attachments || []).forEach((f) => drive.deleteAttachment(f.id).catch(() => {}));
    }
    setConfirmDelete(null);
  };

  const handleUpload = async (empId, fileList) => {
    setUploading(true);
    const newAttachments = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 20 * 1024 * 1024) {
        showToast(`"${file.name}" أكبر من 20 ميجا`);
        continue;
      }
      try {
        const meta = await drive.uploadAttachment(folder.id, file);
        newAttachments.push(meta);
      } catch (e) {
        showToast(`فشل رفع "${file.name}"`);
      }
    }
    if (newAttachments.length) {
      const updated = employees.map((e) =>
        e.id === empId ? { ...e, attachments: [...newAttachments, ...(e.attachments || [])] } : e
      );
      const ok = await persist(updated);
      if (ok) showToast('تم رفع الملفات');
    }
    setUploading(false);
  };

  const handleDeleteFile = async (empId, fileId) => {
    const updated = employees.map((e) =>
      e.id === empId ? { ...e, attachments: (e.attachments || []).filter((f) => f.id !== fileId) } : e
    );
    const ok = await persist(updated);
    if (ok) drive.deleteAttachment(fileId).catch(() => {});
  };

  const handleDownload = async (file) => {
    try {
      const blob = await drive.downloadAttachment(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast('تعذر تنزيل الملف');
    }
  };

  const filtered = employees.filter((e) => {
    const matchesQuery = !query || e.name.includes(query) || e.position?.includes(query) || e.email?.includes(query);
    const matchesDept = deptFilter === 'الكل' || e.department === deptFilter;
    return matchesQuery && matchesDept;
  });
  const selected = employees.find((e) => e.id === selectedId);

  // ---- شاشات الإعداد الأولي ----
  if (!authReady) {
    return <CenterScreen><Loader2 size={24} className="animate-spin" /></CenterScreen>;
  }
  if (!signedIn) {
    return (
      <CenterScreen>
        <div className="fade-in" style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: '#B8935A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Building2 size={28} color="#1C2B3A" />
          </div>
          <h1 style={{ fontWeight: 700, color: '#1C2B3A', marginBottom: 6 }}>أرشيف الموظفين</h1>
          <p style={{ color: '#8A7F6B', fontSize: 14, marginBottom: 20 }}>سجّل دخولك بحساب Google للوصول إلى الأرشيف المشترك</p>
          <button onClick={handleSignIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1C2B3A', color: '#F5F2EC', padding: '10px 20px', borderRadius: 8, fontWeight: 600, border: 'none' }}>
            <LogIn size={16} /> تسجيل الدخول بحساب Google
          </button>
        </div>
      </CenterScreen>
    );
  }
  if (!folder) {
    return (
      <CenterScreen>
        <div className="fade-in" style={{ textAlign: 'center', maxWidth: 380 }}>
          <FolderOpen size={40} style={{ color: '#B8935A', margin: '0 auto 12px' }} />
          <h2 style={{ fontWeight: 700, color: '#1C2B3A', marginBottom: 6 }}>اختر مجلد الأرشيف</h2>
          <p style={{ color: '#8A7F6B', fontSize: 14, marginBottom: 20 }}>
            اختر مجلد Google Drive موجود (شاركه مسبقاً مع فريقك)، أو أنشئ مجلد جديد من نفس النافذة.
            كل من يفتح هذا المجلد بصلاحية "محرر" راح يشوف نفس البيانات.
          </p>
          <button onClick={handlePickFolder} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#B8935A', color: '#1C2B3A', padding: '10px 20px', borderRadius: 8, fontWeight: 600, border: 'none' }}>
            <FolderOpen size={16} /> اختيار / إنشاء مجلد
          </button>
        </div>
      </CenterScreen>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#F5F2EC' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#1C2B3A', borderBottom: '1px solid #0F1A24' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#B8935A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} color="#1C2B3A" />
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: '#F5F2EC', margin: 0 }}>أرشيف الموظفين</h1>
              <p style={{ fontSize: 11, color: '#8FA0AE', margin: 0 }}>📁 {folder.name} · <button onClick={handleChangeFolder} style={{ background: 'none', border: 'none', color: '#B8935A', cursor: 'pointer', padding: 0, fontSize: 11 }}>تغيير المجلد</button></p>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#8FA0AE' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالاسم أو المنصب..."
                style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: 6, fontSize: 14, background: '#28394A', color: '#F5F2EC', border: '1px solid #34495E', outline: 'none' }}
              />
            </div>
            <button onClick={() => { setEditTarget(null); setFormOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 600, background: '#B8935A', color: '#1C2B3A', border: 'none', whiteSpace: 'nowrap' }}>
              <Plus size={16} /> موظف جديد
            </button>
            <button onClick={handleSignOut} title="تسجيل خروج" style={{ background: 'none', border: '1px solid #34495E', borderRadius: 6, padding: 8, color: '#B8C4CE' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 12px', display: 'flex', gap: 8, overflowX: 'auto' }} className="archive-scrollbar">
          {['الكل', ...DEPARTMENTS].map((d) => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12, whiteSpace: 'nowrap',
                background: deptFilter === d ? '#B8935A' : 'transparent',
                color: deptFilter === d ? '#1C2B3A' : '#B8C4CE',
                border: '1px solid ' + (deptFilter === d ? '#B8935A' : '#34495E'),
                fontWeight: deptFilter === d ? 700 : 400,
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        {error && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 6, fontSize: 14, background: '#FBEAEA', color: '#A33', border: '1px solid #E8B4B4' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0', gap: 8, color: '#8A7F6B' }}>
            <Loader2 size={20} className="animate-spin" /> جاري التحميل من Drive...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '96px 0' }}>
            <Users size={40} style={{ margin: '0 auto 12px', color: '#C9BFA8' }} />
            <p style={{ color: '#8A7F6B' }}>{employees.length === 0 ? 'لا يوجد موظفون بعد — ابدأ بإضافة أول موظف' : 'لا توجد نتائج مطابقة'}</p>
          </div>
        ) : (
          <div className="grid grid-2 grid-3">
            {filtered.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setSelectedId(emp.id)}
                className="fade-in"
                style={{ textAlign: 'right', padding: 16, borderRadius: 10, position: 'relative', overflow: 'hidden', background: '#FFFDF9', border: '1px solid #E4DDCB', cursor: 'pointer' }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: 56, height: 6, background: '#B8935A' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: '#1C2B3A', color: '#F5F2EC', flexShrink: 0 }}>
                    {initials(emp.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#1C2B3A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</p>
                    <p style={{ fontSize: 12, color: '#8A7F6B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.position || '—'}</p>
                  </div>
                </div>
                <span style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#F0EAD9', color: '#7A6A45' }}>
                  {emp.department || 'غير محدد'}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      {formOpen && (
        <EmployeeFormModal initial={editTarget} onClose={() => { setFormOpen(false); setEditTarget(null); }} onSave={handleAddOrEdit} />
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', justifyContent: 'flex-end', background: 'rgba(28,43,58,0.4)' }} onClick={() => setSelectedId(null)}>
          <div className="slide-in archive-scrollbar" style={{ width: '100%', maxWidth: 420, height: '100%', overflowY: 'auto', background: '#FFFDF9' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'sticky', top: 0, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1C2B3A', borderBottom: '1px solid #0F1A24' }}>
              <h2 style={{ fontWeight: 700, color: '#F5F2EC', margin: 0 }}>ملف الموظف</h2>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#B8C4CE' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, background: '#1C2B3A', color: '#F5F2EC' }}>
                  {initials(selected.name)}
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: '#1C2B3A', margin: 0 }}>{selected.name}</p>
                  <p style={{ fontSize: 14, color: '#8A7F6B', margin: 0 }}>{selected.position || '—'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, fontSize: 14 }}>
                <InfoRow icon={<Building2 size={15} />} label="القسم" value={selected.department} />
                <InfoRow icon={<Mail size={15} />} label="البريد الإلكتروني" value={selected.email} />
                <InfoRow icon={<Phone size={15} />} label="رقم الهاتف" value={selected.phone} />
                <InfoRow icon={<Calendar size={15} />} label="تاريخ الالتحاق" value={selected.joinDate} />
                {selected.notes && <InfoRow icon={<StickyNote size={15} />} label="ملاحظات" value={selected.notes} />}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <button onClick={() => { setEditTarget(selected); setFormOpen(true); }} style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 14, fontWeight: 600, background: '#F0EAD9', color: '#1C2B3A', border: 'none' }}>
                  تعديل البيانات
                </button>
                <button onClick={() => setConfirmDelete(selected.id)} style={{ padding: '8px 16px', borderRadius: 6, background: '#FBEAEA', color: '#A33', border: 'none' }}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div style={{ borderTop: '1px solid #E4DDCB', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1C2B3A', margin: 0 }}>الملفات المرفقة</h3>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, background: '#B8935A', color: '#1C2B3A' }}>
                    <Upload size={14} /> {uploading ? 'جاري الرفع...' : 'رفع ملف'}
                    <input type="file" multiple accept=".pdf,.xlsx,.xls,.csv" style={{ display: 'none' }} disabled={uploading}
                      onChange={(e) => { if (e.target.files.length) handleUpload(selected.id, e.target.files); e.target.value = ''; }} />
                  </label>
                </div>
                {(selected.attachments || []).length === 0 ? (
                  <p style={{ fontSize: 12, padding: '16px 0', textAlign: 'center', color: '#B0A688' }}>لا توجد ملفات مرفقة بعد</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.attachments.map((f) => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#F5F2EC' }}>
                        <span style={{ color: '#B8935A' }}>{fileIcon(f.mimeType)}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: '#1C2B3A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</p>
                          <p style={{ fontSize: 10, color: '#8A7F6B', margin: 0 }}>{formatSize(f.size)}</p>
                        </div>
                        <button onClick={() => handleDownload(f)} title="تنزيل" style={{ background: 'none', border: 'none', color: '#5B6B82' }}><Download size={15} /></button>
                        <button onClick={() => handleDeleteFile(selected.id, f.id)} title="حذف" style={{ background: 'none', border: 'none', color: '#C0392B' }}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(28,43,58,0.5)' }}>
          <div className="fade-in" style={{ width: '100%', maxWidth: 360, borderRadius: 10, padding: 20, background: '#FFFDF9' }}>
            <p style={{ fontWeight: 700, color: '#1C2B3A', marginBottom: 8 }}>تأكيد الحذف</p>
            <p style={{ fontSize: 14, color: '#8A7F6B', marginBottom: 16 }}>سيتم حذف بيانات الموظف وجميع ملفاته المرفقة نهائياً من Drive. هل أنت متأكد؟</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 14, fontWeight: 600, background: '#F0EAD9', color: '#1C2B3A', border: 'none' }}>إلغاء</button>
              <button onClick={() => handleDeleteEmployee(confirmDelete)} style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 14, fontWeight: 600, background: '#C0392B', color: '#fff', border: 'none' }}>حذف نهائياً</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fade-in" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', borderRadius: 999, fontSize: 14, background: '#1C2B3A', color: '#F5F2EC', zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function CenterScreen({ children }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F2EC', padding: 20 }}>{children}</div>;
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ marginTop: 2, color: '#B8935A' }}>{icon}</span>
      <div>
        <p style={{ fontSize: 11, color: '#B0A688', margin: 0 }}>{label}</p>
        <p style={{ color: '#1C2B3A', margin: 0 }}>{value || '—'}</p>
      </div>
    </div>
  );
}

function EmployeeFormModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    position: initial?.position || '',
    department: initial?.department || DEPARTMENTS[0],
    email: initial?.email || '',
    phone: initial?.phone || '',
    joinDate: initial?.joinDate || '',
    notes: initial?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14, outline: 'none', border: '1px solid #E4DDCB', background: '#F5F2EC', color: '#1C2B3A' };
  const labelStyle = { fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4, color: '#5B6B82' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(28,43,58,0.5)' }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="fade-in" style={{ width: '100%', maxWidth: 420, borderRadius: 10, overflow: 'hidden', background: '#FFFDF9' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1C2B3A' }}>
          <h3 style={{ fontWeight: 700, color: '#F5F2EC', margin: 0 }}>{initial ? 'تعديل بيانات الموظف' : 'موظف جديد'}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#B8C4CE' }}><X size={20} /></button>
        </div>
        <div className="archive-scrollbar" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto' }}>
          <div><label style={labelStyle}>الاسم الكامل *</label><input style={inputStyle} value={form.name} onChange={set('name')} required autoFocus /></div>
          <div><label style={labelStyle}>المنصب الوظيفي</label><input style={inputStyle} value={form.position} onChange={set('position')} /></div>
          <div>
            <label style={labelStyle}>القسم</label>
            <select style={inputStyle} value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>البريد الإلكتروني</label><input type="email" style={inputStyle} value={form.email} onChange={set('email')} /></div>
          <div><label style={labelStyle}>رقم الهاتف</label><input style={inputStyle} value={form.phone} onChange={set('phone')} /></div>
          <div><label style={labelStyle}>تاريخ الالتحاق</label><input type="date" style={inputStyle} value={form.joinDate} onChange={set('joinDate')} /></div>
          <div><label style={labelStyle}>ملاحظات</label><textarea rows={2} style={{ ...inputStyle, resize: 'none' }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 8, borderTop: '1px solid #E4DDCB' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 14, fontWeight: 600, background: '#F0EAD9', color: '#1C2B3A', border: 'none' }}>إلغاء</button>
          <button type="submit" disabled={saving || !form.name.trim()} style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 14, fontWeight: 600, background: '#B8935A', color: '#1C2B3A', border: 'none', opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </form>
    </div>
  );
}
