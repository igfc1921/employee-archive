// ⚠️ عبّي هذا الملف بمعلوماتك من Google Cloud Console (راجع README.md للتفاصيل)

export const CLIENT_ID = 'ضع_OAuth_Client_ID_هنا.apps.googleusercontent.com';
export const API_KEY = 'ضع_API_Key_هنا';

// أذونات الوصول المطلوبة من جوجل درايف
// drive.file: يعطي الموقع صلاحية فقط على الملفات/المجلدات اللي المستخدم يختارها بنفسه أو ينشئها الموقع
// (هذا آمن أكثر من إعطاء صلاحية كاملة على كل ملفات درايف المستخدم)
export const SCOPES = 'https://www.googleapis.com/auth/drive.file';
