"""Exercise real Git backup tags/pushes only against a disposable local bare remote."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'work/git/Backup-Version.ps1'
SHELL = shutil.which('pwsh') or shutil.which('powershell')


@unittest.skipUnless(SHELL, 'PowerShell unavailable; backup integration not run')
class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'checkout'
        self.repo.mkdir()
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Backup Test')
        self.git('config', 'user.email', 'backup@example.invalid')
        self.git('config', 'commit.gpgsign', 'false')
        self.git('config', 'tag.gpgsign', 'false')
        self.git('init', '--bare', str(self.root / 'remote.git'))
        self.git('remote', 'add', 'origin', str(self.root / 'remote.git'))
        target = self.repo / 'work/git/Backup-Version.ps1'
        target.parent.mkdir(parents=True)
        shutil.copyfile(SCRIPT, target)
        self.git('add', '.')
        self.git('commit', '-m', 'fixture')
        (self.repo / 'change.txt').write_text('stage one')
        self.git('add', 'change.txt')

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo, stderr=subprocess.STDOUT).decode('utf-8').strip()

    def backup(self, *args):
        return subprocess.run([SHELL, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                               str(self.repo / 'work/git/Backup-Version.ps1'), *args],
                              cwd=self.repo, capture_output=True, text=True,
                              encoding='utf-8', errors='replace')

    def test_repository_tag_retry_and_no_overwrite(self):
        args = ['-Platform', 'repository', '-Stage', '1', '-Summary', 'fixture stage']
        first = self.backup(*args)
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        tag = self.git('rev-parse', 'refs/tags/repo-stage-1')
        self.assertEqual(self.git('cat-file', '-t', tag), 'tag')
        self.assertIn(tag, self.git('ls-remote', 'origin', 'refs/tags/repo-stage-1'))
        self.assertEqual(self.backup(*args).returncode, 0)
        (self.repo / 'change.txt').write_text('stage two')
        self.git('add', 'change.txt')
        self.assertNotEqual(self.backup(*args).returncode, 0)
        self.assertEqual(self.git('rev-parse', 'refs/tags/repo-stage-1'), tag)

    def test_existing_android_tag_format_is_unchanged(self):
        result = self.backup('-Platform', 'android', '-Version', '1.2.3', '-Build', '4',
                             '-Stage', '2', '-Summary', 'fixture android')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git('cat-file', '-t', 'refs/tags/android-v1.2.3-build4-stage-2'), 'tag')

    def test_invalid_modes_do_not_commit_staged_files(self):
        head = self.git('rev-parse', 'HEAD')
        for args in [('-Platform', 'repository'),
                     ('-Platform', 'repository', '-Stage', '1', '-Version', '1.2.3'),
                     ('-Platform', 'ios', '-Build', '6')]:
            result = self.backup(*args, '-Summary', 'invalid')
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(self.git('rev-parse', 'HEAD'), head)


if __name__ == '__main__':
    unittest.main()
