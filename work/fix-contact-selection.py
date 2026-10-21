from pathlib import Path
p=Path('outputs/ams-android/app/src/main/java/cn/local/ams/MainActivity.java');s=p.read_text(encoding='utf-8-sig')
s=s.replace('                if (!request.isForMainFrame()) return false;\n                Uri uri = request.getUrl();','''                Uri uri = request.getUrl();
                // Mail links inside the managed iframe must never load in WebView.
                if ("mailto".equalsIgnoreCase(uri.getScheme())) {
                    if (amsMobilePage() && "mailto:linlantc@gmail.com".equalsIgnoreCase(uri.toString())) openCreatorEmail();
                    return true;
                }
                if (!request.isForMainFrame()) return false;''')
s=s.replace('''                    return true;
                }
                if (schoolPage(uri))''','''                    if ("email".equals(uri.getHost()) && amsMobilePage()) openCreatorEmail();
                    return true;
                }
                if (schoolPage(uri))''',1)
s=s.replace('    private void openBrowser(String url) {','''    private void openCreatorEmail() {
        try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:linlantc@gmail.com"))); }
        catch (ActivityNotFoundException e) {
            new AlertDialog.Builder(this).setTitle("未找到邮件应用")
                .setMessage("可以复制邮箱地址，在邮件应用中联系作者。\\nlinlantc@gmail.com")
                .setNegativeButton("关闭", null)
                .setPositiveButton("复制邮箱", (dialog, which) -> {
                    android.content.ClipboardManager clipboard = (android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("作者邮箱", "linlantc@gmail.com"));
                    Toast.makeText(this, "邮箱已复制", Toast.LENGTH_SHORT).show();
                }).show();
        }
    }
    private void openBrowser(String url) {''')
p.write_text(s,encoding='utf-8')
p=Path('work/build-live-ui.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace('<a href="mailto:linlantc@gmail.com">','<a id="creatorEmail" href="mailto:linlantc@gmail.com">')
s=s.replace("document.getElementById('logoutBtn').onclick=", "document.getElementById('creatorEmail').onclick=e=>{e.preventDefault();send('contact');};document.getElementById('logoutBtn').onclick=")
s=s.replace("case 'theme':", "case 'contact':if(path==='/home'||owned.has(path))location.href='ams-local://email';break;case 'theme':")
s=s.replace('0.11.3','0.11.4');p.write_text(s,encoding='utf-8')
p=Path('work/managed-ui-polish.css');s=p.read_text(encoding='utf-8-sig');s+='''
/* Interface chrome is not selectable; useful data and editing stay selectable. */
html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
input,textarea,[contenteditable="true"],.account-name,.about-app a,#sheet dd,#sheet h2,.destination b,.session-date,.session-foot,.file-row{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
button,button *,nav,nav *,summary,.badge,.state,.hero-top,.attendance-ring,.attendance-stats,.eyebrow,h1{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
''';p.write_text(s,encoding='utf-8')
for name in ['outputs/ams-android/build-local.ps1','outputs/ams-android/app/build.gradle']:
 p=Path(name);s=p.read_text(encoding='utf-8-sig').replace('0.11.3','0.11.4').replace("'--version-code','22'","'--version-code','23'").replace('versionCode 22','versionCode 23');p.write_text(s,encoding='utf-8-sig' if name.endswith('.ps1') else 'utf-8')
