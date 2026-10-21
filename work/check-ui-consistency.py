"""Static guards for the approved navigation / consistency / visual-detail batch (B and C)."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = root/'outputs/ams-android/app/src/main/java/cn/local/ams'
sports = (src/'SportsReservationActivity.java').read_text(encoding='utf-8')
main = (src/'MainActivity.java').read_text(encoding='utf-8')
reservation = (src/'ReservationActivity.java').read_text(encoding='utf-8')
ui = (root/'outputs/ams-android/app/src/main/assets/ams-modern-ui.js').read_text(encoding='utf-8')
nav = (root/'outputs/ams-android/app/src/main/assets/navigation.html').read_text(encoding='utf-8')
css = (root/'work/managed-ui-polish.css').read_text(encoding='utf-8')
child = (root/'work/managed-leave-child.js').read_text(encoding='utf-8')
html = (root/'work/live-ui.html').read_text(encoding='utf-8')

# 7A: web back only when there is history; × always leaves sports, labelled for screen readers.
assert 'backButton.setVisibility(View.GONE)' in sports and 'web.canGoBack() || !previousWindows.isEmpty()' in sports
assert 'button("×", "plain")' in sports and 'setContentDescription("关闭体育馆")' in sports and 'LayoutParams(dp(48), dp(48))' in sports
# 8: distinct reservation icons.
for symbol in ('id="seat"', 'id="room"', 'id="sports"', 'id="bus"', 'id="bookings"'):
    assert symbol in html, symbol
assert "icon({seat:'seat',room:'room',sports:'sports',bus:'bus',records:'bookings'}[key]||'calendar')" in html
# 9: same row indicator as other settings rows, rotated when open.
assert 'appearance-chevron" aria-hidden="true">›' in html
assert '.appearance-dropdown[open] .appearance-chevron{transform:rotate(90deg)}' in css
# 6: today button without an external-link arrow and hidden on today.
assert '回到今天 ↗' not in html and '回到今天' in html and '#today[hidden]{display:none!important}' in css
# 11: Latin course names in every title template.
assert html.count('latin(') >= 4 and "typeof latin==='function'?latin(c.moudleTitle||c.moduleTitle)" in child
# 12 (option B) and 13.
assert 'html.ams-dark .day.selected{box-shadow:inset 0 0 0 2px' in css and '.about-app a{display:inline-flex;align-items:center;justify-content:center;min-height:48px' in css
# Gesture-bar band: shadow fits inside a taller navigation layer; reservation bar follows the page colour.
assert 'dpForInsets(92)' in main and 'bottom:12px' in nav and 'box-shadow:0 2px 8px var(--nav-shadow)' in nav
assert 'private void matchNavigationBar()' in reservation and 'android.view.PixelCopy.request(getWindow()' in reservation and 'bottomBarColor=color;paintBottomInset();' in reservation and 'layers.setLayerInset(1,0,root.getHeight()-bottom,0,0)' in reservation
assert 'hideLoading();uiHandler.postDelayed(this::matchNavigationBar,350);' in reservation
print('PASS UI consistency guards: sports header back/close, distinct reservation icons, settings chevron, today button, Latin course titles, dark selected-day outline, 48px footer links, unclipped navigation shadow and page-matched gesture bar.')
