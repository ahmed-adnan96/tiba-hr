# خطوات تشغيل المنظومة على Firebase (مجانًا)

## 1) إنشاء المشروع
1. ادخل https://console.firebase.google.com بحساب Google واعمل **Add project** (اقفل Google Analytics).
2. من **Build > Firestore Database** اضغط Create database، اختر **Production mode** (مش test mode) وأقرب منطقة.
3. من **Build > Authentication > Get started** فعّل **Email/Password**.
4. من تبويب **Users** اضغط Add user وأنشئ حساب لكل شخص هيدخل (المدير + أي حد تاني). **لا تفتح تسجيل ذاتي.**
   لو متاح في Settings > User actions، اقفل خيار "Enable create (sign-up)".

## 2) ربط الملف
1. **Project settings (⚙) > General > Your apps > Web (</>)** سجّل تطبيق واحصل على `firebaseConfig`.
2. افتح `index.html` وابحث عن `PASTE_API_KEY`، وبدّل القيم الأربعة بقيمك.
   (الـ apiKey هنا مش سر، الحماية الحقيقية في القواعد.)

## 3) قواعد الأمان
1. **Firestore > Rules**: الصق محتوى `firestore.rules` بعد ما تبدّل الإيميلات بإيميلات الحسابات اللي أنشأتها في الخطوة 1.4، واضغط Publish.
2. لازم كل إيميل في القائمة يكون له حساب منشأ مسبقًا من لوحة Authentication.

## 4) النشر
- **Hosting**: من Build > Hosting > Get started، أو بالأوامر:
  ```
  npm i -g firebase-tools
  firebase login
  firebase init hosting     # public directory = المجلد اللي فيه index.html ، single-page = No
  firebase deploy
  ```
- هتاخد رابط مثل `https://اسم-المشروع.web.app`.

## 5) تحميل بيانات الموظفين لأول مرة
بيانات الموظفين (الأرقام القومية والتليفونات) **مش موجودة** في الـ HTML عشان الرابط عام.
1. ادخل على الموقع بحساب المدير.
2. **المزيد > الإعدادات > استعادة نسخة** واختر `seed-backup.json`.
3. بعد ما تتأكد إن الموظفين ظهروا ودخلت من جهاز تاني وشفتهم، **امسح seed-backup.json من أي مكان عام** (واتساب/درايف مشترك).

## 6) النسخ الاحتياطي
من الإعدادات > "نسخة احتياطية" نزّل ملف JSON أسبوعيًا على الأقل، والخطة المجانية مفيهاش نسخ تلقائي.
