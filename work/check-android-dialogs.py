"""Every Android dialog goes through the themed AppDialog card; the platform AlertDialog look is not used directly."""
from pathlib import Path
import re

src = Path(__file__).resolve().parents[1]/'outputs/ams-android/app/src/main/java/cn/local/ams'
for java in sorted(src.glob('*.java')):
    text = java.read_text(encoding='utf-8')
    if java.name != 'AppDialog.java':
        assert 'AlertDialog.Builder' not in text and 'ProgressDialog' not in text, f'{java.name} builds a platform dialog'
dialog = (src/'AppDialog.java').read_text(encoding='utf-8')
assert dialog.count('new AlertDialog.Builder(') == 1 and 'setView(card)' in dialog
assert 'background.setColor(theme.surface)' in dialog and 'setCornerRadius(24 * density)' in dialog and 'theme.apply(card)' in dialog
assert 'setIndeterminateTintList(ColorStateList.valueOf(theme.accent))' in dialog
update = (src/'UpdateNotice.java').read_text(encoding='utf-8')
assert 'AppDialog.present(activity, card, true)' in update and 'AppDialog.card(activity)' in update
sports = (src/'SportsReservationActivity.java').read_text(encoding='utf-8')
assert 'AppDialog.show(this, "离开支付页面？", "支付结果可在“我的订单”中查看。", "继续支付", null, "离开", leave, null)' in sports
main = (src/'MainActivity.java').read_text(encoding='utf-8')
assert 'AppDialog.progress(this, "正在检查更新…")' in main and len(re.findall(r'AppDialog\.show\(', main)) >= 7
# Toast is retired: transient messages use the themed AppNotice, actionable ones AppDialog, page failures an in-page state.
for java in sorted(src.glob('*.java')):
    assert 'Toast.makeText' not in java.read_text(encoding='utf-8'), f'{java.name} still uses a platform Toast'
notice = (src/'AppNotice.java').read_text(encoding='utf-8')
assert 'ACCESSIBILITY_LIVE_REGION_POLITE' in notice and 'setMinHeight(Math.round(48 * density))' in notice and 'postDelayed' in notice
reservation = (src/'ReservationActivity.java').read_text(encoding='utf-8')
assert 'uiHandler.postDelayed(loadingTimeout,15000)' in reservation and 'showLoadProblem("学校页面证书验证失败' in reservation and 'button("重试"' in reservation and 'button("返回"' in reservation
print('PASS Android dialogs and notices: no platform Toast left; reservation loading times out to retry/back after 15s and SSL failure is an in-page state; one themed AppDialog card (surface, 24dp radius, theme roles, accent spinner) for payment leave, external link, camera, update check/progress/failure/latest, load failure, email, scan and HHT unbind.')
