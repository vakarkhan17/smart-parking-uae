SMART UAE PARKING - COMPLETE RUN GUIDE

FOLDER STRUCTURE
smart-parking-app       = Expo mobile app
smart-parking-backend   = Node.js backend API

IMPORTANT: This folder includes the latest email login/register app and backend. Map package is included. For real Google map pins, update App.js with your Google API key and continue Phase 3 map implementation.

1) BACKEND SETUP
Open PowerShell:

cd C:\Users\vakar\Documents\Vakar\SmartParking\smart-parking-backend
npm.cmd install
copy .env.example .env
notepad .env

Update .env:
DB_PASSWORD=your_postgres_password
JWT_SECRET=smartparking_long_secret_123456789
SMTP_USER=digitalmizzle@gmail.com
SMTP_PASS=your_google_app_password_without_spaces
SMTP_FROM="Smart UAE Parking <digitalmizzle@gmail.com>"

Create/update database tables:
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d smart_parking -f database\schema.sql

Start backend:
npm.cmd start

Test in browser:
http://localhost:5000

2) FRONTEND SETUP
Open another PowerShell:

cd C:\Users\vakar\Downloads\smart-parking-app
npm.cmd install
npx.cmd expo install react-native-maps expo-location @react-native-async-storage/async-storage react-native-safe-area-context
notepad App.js

Update these two lines in App.js:
const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY";
const API_BASE_URL = "http://YOUR_LAPTOP_WIFI_IP:5000";

Find laptop IP:
ipconfig

Start frontend:
npx.cmd expo start --clear

3) ANDROID APK BUILD
$env:EAS_NO_VCS="1"
eas.cmd build -p android --profile preview --clear-cache

4) NOTES
- Keep backend PowerShell running while testing frontend.
- Mobile phone and laptop must be on same Wi-Fi if using LAN.
- Google Places shows parking locations, not real live availability.
- Real availability needs RTA/Parkin/mall/operator API or your own sensor/backend data.
