# الضبعاوي AI — Rebuild Video MVP

هذه النسخة لا تستخدم R2.

الفكرة: المشهد يرسل إلى Hugging Face Inference Providers عبر Secret باسم `HF_TOKEN`، وعند اكتمال الفيديو يعيده Worker كـ `video/mp4` إلى المتصفح، ثم يظهر زر تحميل مباشر على الموبايل.

## Secrets
في Cloudflare Worker > Settings > Variables and Secrets > Production أضف Secret:
- Name: HF_TOKEN
- Value: Hugging Face token بصلاحية Inference Providers

لا تضع قيمة التوكن داخل wrangler.jsonc أو GitHub.

## D1
نفّذ schema.sql على قاعدة `eldab3awy-db` في بيئة الاختبار. الملف يعيد إنشاء جداول المشروع ويزيل الجداول القديمة الخاصة بهذا المشروع.

## Deploy
npx wrangler deploy

## ملاحظة الفيديو
لا يوجد تخزين دائم للفيديو في هذه النسخة. الفيديو يُولد ويعود مباشرة للمتصفح، ومن هناك يمكن تحميله على الموبايل. التخزين الدائم يمكن إضافته لاحقاً عبر Object Storage.
