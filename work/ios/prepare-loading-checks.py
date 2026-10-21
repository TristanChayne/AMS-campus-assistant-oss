"""Instrument only a disposable Mac app copy for actual native loading-state checks."""
from pathlib import Path
import sys

app = Path(sys.argv[1]).resolve()
if not app.name.startswith('AMS-iOS-PARITY-001-'):
    raise SystemExit('Use a dedicated AMS-iOS-PARITY-001-* app copy, never the normal Mac checkout.')
source = app / 'Sources/CampusController.swift'
text = source.read_text(encoding='utf-8')
anchor = '        registerForTraitChanges([UITraitUserInterfaceStyle.self])'
assert text.count(anchor) == 1
text = text.replace(anchor, '''        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--test-loading-regression") {
            DispatchQueue.main.asyncAfter(deadline:.now()+1) { [weak self] in self?.runLoadingRegressionChecks() }
        }
        #endif
''' + anchor)
source.write_text(text + Path(__file__).with_name('LoadingChecks.swift').read_text(encoding='utf-8'), encoding='utf-8')
delegate = app / 'Sources/AppDelegate.swift'
text = delegate.read_text(encoding='utf-8')
anchor = '        if ProcessInfo.processInfo.arguments.contains("--test-room")'
assert text.count(anchor) == 1
text = text.replace(anchor, '        if ProcessInfo.processInfo.arguments.contains("--test-loading-regression") { root = CampusController(url:URL(string:"https://seatbookings.xjtlu.edu.cn/")!) }\n' + anchor)
delegate.write_text(text, encoding='utf-8')
print('Instrumented disposable app copy; launch with --test-design --test-loading-regression')
