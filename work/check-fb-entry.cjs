const fs=require('fs'),assert=require('assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const java='outputs/ams-android/app/src/main/java/cn/local/ams/';
assert(read(java+'MainActivity.java').includes('"fb".equals(service)?FbReservationActivity.class'));
assert(read(java+'ReservationActivity.java').includes('else if("fb".equals(service))open("https://gsrb.xjtlu.edu.cn/");'));
assert(read('outputs/ams-android/app/src/main/AndroidManifest.xml').includes('android:name=".FbReservationActivity" android:exported="false"'));
assert(read('outputs/ams-ios/Sources/CampusController.swift').includes('"fb": "https://gsrb.xjtlu.edu.cn/"'));
for(const path of ['outputs/ams-android/app/src/main/assets/ams-modern-ui.js','outputs/ams-ios/Assets/ams-modern-ui.js']){
 assert(read(path).includes("['fb','FB 讨论室（SIP）','进入「静音仓」板块选择 FB 座位']"),path);
}
assert(!read('outputs/ams-ios/Assets/review-content.html').includes("['fb','FB 讨论室（SIP）'"));
assert(!read('work/ios/reservation-session.js').includes('gsrb'));
console.log('PASS: both native FB routes, distinct retained Android activity, official-site guidance, review isolation and no injected reservation session');
