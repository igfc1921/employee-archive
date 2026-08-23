import { CLIENT_ID, API_KEY, SCOPES } from './config.js';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DATA_FILE_NAME = 'employees.json';

let tokenClient = null;
let accessToken = null;
let pickerLoaded = false;

/** يهيّئ عميل تسجيل الدخول بجوجل (يُستدعى مرة وحدة عند فتح الموقع) */
export function initAuth(onTokenReady) {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(check);
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error) return;
            accessToken = resp.access_token;
            onTokenReady?.(accessToken);
          },
        });
        resolve();
      }
    }, 100);
  });
}

/** يفتح نافذة تسجيل الدخول / طلب الصلاحيات من جوجل */
export function requestAccessToken() {
  tokenClient?.requestAccessToken({ prompt: '' });
}

export function getToken() {
  return accessToken;
}

export function signOut() {
  if (accessToken) {
    window.google?.accounts?.oauth2?.revoke(accessToken, () => {});
  }
  accessToken = null;
}

/** يحمّل مكتبة Google Picker (لاختيار/إنشاء المجلد المشترك) */
function loadPicker() {
  return new Promise((resolve) => {
    if (pickerLoaded) return resolve();
    window.gapi.load('picker', () => {
      pickerLoaded = true;
      resolve();
    });
  });
}

/** يفتح نافذة اختيار مجلد من Google Drive، أو إنشاء مجلد جديد */
export async function openFolderPicker() {
  await loadPicker();
  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setTitle('اختر أو أنشئ مجلد الأرشيف المشترك')
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const folder = data.docs[0];
          resolve({ id: folder.id, name: folder.name });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

async function authFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }
  return res;
}

/** يبحث عن ملف employees.json داخل المجلد، أو ينشئه فارغاً إذا ما كان موجود */
export async function findOrCreateDataFile(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and name='${DATA_FILE_NAME}' and trashed=false`);
  const res = await authFetch(`${DRIVE_FILES_URL}?q=${q}&fields=files(id,name)`);
  const json = await res.json();
  if (json.files?.length) return json.files[0].id;

  // ما موجود -> ننشئه
  const metadata = { name: DATA_FILE_NAME, parents: [folderId], mimeType: 'application/json' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify([])], { type: 'application/json' }));

  const createRes = await authFetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: 'POST',
    body: form,
  });
  const created = await createRes.json();
  return created.id;
}

/** يقرأ محتوى ملف بيانات الموظفين */
export async function readDataFile(fileId) {
  const res = await authFetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`);
  return res.json();
}

/** يحدّث محتوى ملف بيانات الموظفين بالكامل */
export async function writeDataFile(fileId, data) {
  await authFetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** يرفع ملف مرفق (PDF/Excel) داخل المجلد المشترك */
export async function uploadAttachment(folderId, file) {
  const metadata = { name: file.name, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await authFetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,size`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}

/** ينزّل ملف مرفق كـ Blob */
export async function downloadAttachment(fileId) {
  const res = await authFetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`);
  return res.blob();
}

/** يحذف ملف مرفق نهائياً من Drive */
export async function deleteAttachment(fileId) {
  await authFetch(`${DRIVE_FILES_URL}/${fileId}`, { method: 'DELETE' });
}
