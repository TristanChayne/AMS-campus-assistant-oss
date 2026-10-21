"""Instrument a dedicated Mac copy only; the shipped app never trusts fixture URLs."""
from pathlib import Path
import sys

app = Path(sys.argv[1]).resolve()
if app.name != 'AMS-iOS-SPORTS-001':
    raise SystemExit('Use the dedicated AMS-iOS-SPORTS-001 app copy.')
source = app / 'Sources/SportsController.swift'
text = source.read_text(encoding='utf-8')
assert 'sportsFixtureTrusted' not in text, 'Restore normal source before instrumentation.'
text = text.replace('SportsNavigation.trusted(', 'sportsFixtureTrusted(')
anchor = '        config.websiteDataStore = .default()'
assert text.count(anchor) == 1
text = text.replace(anchor, '''        let fixture = SportsFixture()
        if ProcessInfo.processInfo.arguments.contains("--test-sports-regression") {
            config.setURLSchemeHandler(fixture,forURLScheme:"ams-sports-fixture")
            config.preferences.javaScriptCanOpenWindowsAutomatically = true
        }
''' + anchor)
anchor = '        loadSection(0)'
assert text.count(anchor) == 1
text = text.replace(anchor, '''        if ProcessInfo.processInfo.arguments.contains("--test-sports-regression") {
            beginLoading(); web.load(URLRequest(url:URL(string:"ams-sports-fixture://local/court")!))
            DispatchQueue.main.asyncAfter(deadline:.now()+2) { [weak self] in self?.runSportsChecks(fixture) }
            return
        }
''' + anchor)
source.write_text(text + Path(__file__).with_name('SportsChecks.swift').read_text(encoding='utf-8'),encoding='utf-8')
print('Disposable sports app copy instrumented; launch --test-sports --test-sports-regression')
