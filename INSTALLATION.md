# 🛠️ הוראות התקנה מפורטות - Timer 24H Card

## 📥 התקנה ידנית (מומלצת לפתרון בעיות)

### שלב 1: הורדת הקבצים
הורד את הקבצים הבאים:
- `timer-24h-card.js`
- `timer-24h-card-editor.js`

### שלב 2: העלאת הקבצים ל-Home Assistant
1. צור תיקייה: `config/www/timer-24h-card/`
2. העלה את שני הקבצים לתיקייה זו

### שלב 3: הוספת משאב ל-Lovelace
1. עבור ל: **הגדרות → לוחות בקרה → משאבים**
2. לחץ על **הוסף משאב**
3. הוסף:
   - URL: `/local/timer-24h-card/timer-24h-card.js`
   - סוג: JavaScript Module

### שלב 4: אתחול Home Assistant
אתחל את Home Assistant

### שלב 5: בדיקה
1. בדוק שהקבצים נגישים בכתובות:
   - `http://YOUR-HA-IP:8123/local/timer-24h-card/timer-24h-card.js`
   - `http://YOUR-HA-IP:8123/local/timer-24h-card/timer-24h-card-editor.js`

2. אם אתה מקבל שגיאת 404, בדוק:
   - שהקבצים נמצאים ב-`config/www/timer-24h-card/`
   - שיש לך הרשאות קריאה לקבצים
   - שה-URL נכון (שים לב ל-`/local/` ולא `/www/`)

## 🔧 פתרון בעיות נפוצות

### שגיאה: "Failed to load resource: 404"
**פתרון:**
1. בדוק שהקבצים נמצאים ב-`config/www/timer-24h-card/`
2. וודא שה-URL הוא: `/local/timer-24h-card/timer-24h-card.js`
3. אתחל את Home Assistant
4. נקה cache של הדפדפן (Ctrl+F5)

### שגיאה: "this.timeSlots.find is not a function"
**פתרון:**
הקובץ החדש כבר מכיל תיקון לבעיה זו. וודא שאתה משתמש בגרסה החדשה.

### שגיאה: "Custom element doesn't exist"
**פתרון:**
1. וודא שהמשאב נוסף נכון ל-Lovelace
2. אתחל את Home Assistant
3. נקה cache של הדפדפן

## 📋 הוספת כרטיס לוח הבקרה

### דרך הממשק הגרפי (מומלצת)
1. עבור למצב עריכה בלוח הבקרה
2. לחץ **הוסף כרטיס**
3. חפש **Timer 24H Card**
4. השתמש בעורך הגרפי להגדרה

### דרך YAML
```yaml
type: custom:timer-24h-card
title: "טיימר תאורה"
home_sensors:
  - person.john_doe
  - binary_sensor.home_occupied
home_logic: OR
entities:
  - light.living_room
  - switch.garden_lights
save_state: true
```

## ✨ תכונות חדשות

### 💾 שמירה ברמת השרת
- הנתונים נשמרים ב-Home Assistant (לא בדפדפן)
- סינכרון אוטומטי בין כל המכשירים
- ללא צורך ביצירת helpers נוספים

### 🔄 מיגרציה אוטומטית
- אם יש נתונים ישנים ב-localStorage
- הם יועברו אוטומטית ל-Home Assistant
- ללא איבוד מידע

## 🆘 קבלת עזרה
אם אתה נתקל בבעיות:
1. בדוק את הקונסול (F12) לשגיאות
2. פתח issue ב-GitHub עם פרטי השגיאה
3. כלול את גרסת Home Assistant שלך
