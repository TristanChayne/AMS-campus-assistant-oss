"""Regressions for source provenance and failure reporting; no production dependencies."""
import contextlib
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import manage


class SourceMapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'tools/repo').mkdir(parents=True)
        (self.root / 'src').mkdir()
        (self.root / 'src/main.js').write_text('')
        self.tracked = {'src/main.js'}
        self.data = {'schemaVersion': 1, 'components': [{
            'id': 'fixture', 'sources': ['src'], 'tools': [], 'generated': [],
            'inputs': [{'path': 'local-only.js', 'tracked': False}], 'notes': 'fixture'}]}

    def load(self, data=None):
        (self.root / manage.MAP).write_text(json.dumps(data or self.data), encoding='utf-8')
        return manage.load_map(self.root, self.tracked)

    def test_untracked_source_is_rejected_even_when_local_file_exists(self):
        self.tracked.clear()
        with self.assertRaisesRegex(ValueError, 'Missing/untracked'):
            self.load()

    def test_missing_tracked_source_is_rejected(self):
        self.data['components'][0]['sources'] = ['missing.js']
        self.tracked.add('missing.js')
        with self.assertRaisesRegex(ValueError, 'Missing/untracked'):
            self.load()

    def test_paths_cannot_escape_repository_on_either_os(self):
        for path in ['../private', '/etc/passwd', 'C:/private', 'src\\private']:
            with self.subTest(path=path):
                data = copy.deepcopy(self.data)
                data['components'][0]['inputs'][0]['path'] = path
                with self.assertRaisesRegex(ValueError, 'Unsafe'):
                    self.load(data)

    def test_local_input_never_counts_as_clean_checkout_readiness(self):
        data = self.load()
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertFalse(manage.report_inputs(self.root, data))
            (self.root / 'local-only.js').write_text('')
            self.assertFalse(manage.report_inputs(self.root, data))
        self.assertIn('BLOCKED regeneration', output.getvalue())
        self.assertIn('LOCAL ONLY', output.getvalue())

    def test_tracking_change_requires_map_review(self):
        self.tracked.add('local-only.js')
        with self.assertRaisesRegex(ValueError, 'Input tracking changed'):
            self.load()

    def test_old_branch_cannot_silently_reintroduce_local_only_material(self):
        for path in ['AGENTS.md', 'HANDOFF.md', 'AI-START-PROMPT.md',
                     '.claude/settings.local.json', '.codex-remote-attachments/capture.txt']:
            with self.subTest(path=path):
                self.tracked = {'src/main.js', path}
                with self.assertRaisesRegex(ValueError, 'Local-only material is tracked'):
                    self.load()

    def test_test_failure_stops_profile_and_preserves_exit_code(self):
        with patch('manage.shutil.which', return_value='node'), patch('manage.subprocess.run') as run:
            run.return_value.returncode = 7
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(manage.run_checks(self.root, 'smoke'), 7)
            self.assertEqual(run.call_count, 1)


if __name__ == '__main__':
    unittest.main()
