# בצל הקודש — מערכת ניהול תלמידי ישיבות

מערכת לניהול תלמידי ישיבות בעלזא (בחורים, הורים, תשלומים, רישום אש"ל,
חדרים) עם סנכרונים לנדרים פלוס ולימות המשיח.

שני מצבי הרצה:
- **ענן (Dokploy)** — הפריסה הראשית. push ל-main = deploy אוטומטי.
- **מקומי (Windows)** — גיבוי/פיתוח, דרך קבצי ה-bat שלמטה.

## פריסה בענן (Dokploy)

1. יצירת Application מ-GitHub repo זה, branch `main`, build type: Dockerfile
2. **Volume**: mount בנתיב `/data` (שם חי קובץ ה-SQLite)
3. **משתני סביבה** (הערכים בקובץ `.env` המקומי):
   - `DATABASE_URL=file:/data/betzel.db`
   - `NEXTAUTH_URL=https://<הדומיין>`
   - `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`
   - `NEDARIM_MOSAD_ID`, `NEDARIM_API_PASSWORD`, `NEDARIM_FORMS_PASSWORD`
   - `YEMOT_TOKEN`
4. Domain + Deploy
5. העלאת `betzel.db` הקיים אל ה-volume (scp לשרת ואז docker cp,
   או Volume Restore מה-UI) והפעלה מחדש

ה-entrypoint מריץ בכל עלייה `prisma db push` + seeds (אידמפוטנטי —
לא דורס נתונים קיימים ולא משנה את השנה הפעילה).

## דרישות

- **Node.js 22** ומעלה — [להורדה](https://nodejs.org)
- **Windows 10/11**

## התקנה ראשונית

1. פתחו `cmd` בתיקיית האפליקציה
2. הריצו `Install.bat`
3. חכו לסיום (~5 דקות בפעם ראשונה)
4. העתיקו את `Start-Betzel.bat` לשולחן העבודה

## הפעלה יומית

לחצו כפולות על `Start-Betzel.bat` — Chrome נפתח אוטומטית ב-`http://localhost:3000`.
סגירת חלון ה-cmd = סגירת התוכנה.

## התחברות

הפרטים מוגדרים בקובץ `.env`:
- **Email**: `ADMIN_EMAIL`
- **סיסמה**: `ADMIN_PASSWORD`

## עדכון גרסה (אחרי שינויי קוד)

התוכנה רצה מ-build קבוע — שינויים בקוד לא נכנסים לתוקף עד בנייה מחדש:

1. סגרו את חלון ה-cmd של התוכנה
2. הריצו בתיקיית האפליקציה: `npm run build`
3. הפעילו מחדש `Start-Betzel.bat`

## סנכרונים חיצוניים

- **נדרים פלוס** — עסקאות וטפסים: `/settings/nedarim`
- **ימות המשיח** — הזמנות מיטות וסליקות אשראי: `/settings/yemot`

הסיסמאות והטוקנים נשמרים ב-`.env` (עדיפות) או דרך מסכי ההגדרות.

## גיבוי

- **מקומי**: הריצו `backup.bat` — יוצר עותק ב-`backups/betzel-YYYY-MM-DD_HHMM.db`
- **אוטומטי**: הוסיפו את `backup.bat` ל-Windows Task Scheduler להפעלה יומית

## מבנה הקבצים החשובים

- `betzel.db` — **כל הנתונים**. גיבוי = העתקה של הקובץ הזה
- `.env` — הגדרות (סיסמת אדמין, שנה פעילה, טוקנים של נדרים פלוס וימות המשיח)
- `scripts/migrate-from-pg-dump.ts` — ייבוא חד-פעמי מ-dump של הפרוד הישן

## שחזור מגיבוי

1. סגרו את `Start-Betzel.bat`
2. החליפו את `betzel.db` בגיבוי מתאים מ-`backups/`
3. הפעילו מחדש
