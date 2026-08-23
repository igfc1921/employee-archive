// ⚠️ عبّي هذا الملف بمعلوماتك من Google Cloud Console (راجع README.md للتفاصيل)

export const CLIENT_ID = '745242218621-53sd6hj1vpl3917av9523bua3kjq5p8i.apps.googleusercontent.com';
export const API_KEY = 'AIzaSyAArP2fembq72MOavyjcjptILti23i-rXU';

// أذونات الوصول المطلوبة من جوجل درايف
// drive.file: يعطي الموقع صلاحية فقط على الملفات/المجلدات اللي المستخدم يختارها بنفسه أو ينشئها الموقع
// (هذا آمن أكثر من إعطاء صلاحية كاملة على كل ملفات درايف المستخدم)
export const SCOPES = '1uomd-fJaDRJA0HUZCO8N2U2jkAeBSzpo';
