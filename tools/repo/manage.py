"""Portable, credential-free repository checks. Never builds, deploys or generates assets."""
import argparse
import ast
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
MAP = Path('tools/repo/source-map.json')
LOCAL_ONLY = {
    'AGENTS.md', 'CLAUDE.md', 'HANDOFF.md', 'AI-HANDOVER.md',
    'AI-PROJECT-MEMORY.md', 'AI-START-PROMPT.md', 'GPT项目技术资料.md',
    '安卓网页适配代码说明-供GPT学习.md', 'work/git/Build-AiHandover.py',
}
PROFILES = {
    'smoke': [
        ('node', '.', ['work/check-class-times.cjs']),
        ('node', '.', ['work/check-timetable-clock.cjs']),
        ('node', '.', ['work/ios/check-scan-payload.cjs']),
        ('node', 'outputs/ams-admin', ['--test', 'test/model.test.mjs']),
    ],
    'service': [
        ('node', 'outputs/ams-notify', ['--test', 'test/schedule.test.mjs',
         'test/server.test.mjs', 'test/host.test.mjs', 'test/review-reminder.test.mjs']),
    ],
}


def git_files(root):
    result = subprocess.run(['git', 'ls-files', '-z'], cwd=root, check=True,
                            capture_output=True)
    return set(result.stdout.decode('utf-8').rstrip('\0').split('\0'))


def tracked_path(path, tracked):
    return path in tracked or any(p.startswith(path.rstrip('/') + '/') for p in tracked)


def load_map(root, tracked):
    private = LOCAL_ONLY.intersection(tracked)
    private.update(p for p in tracked if p.startswith(('.claude/', '.codex/', '.codex-remote-attachments/')))
    if private:
        raise ValueError('Local-only material is tracked; remove from Git: ' + ', '.join(sorted(private)))
    data = json.loads((root / MAP).read_text(encoding='utf-8'))
    if data['schemaVersion'] != 1 or not data['components']:
        raise ValueError('Unsupported or empty source map')
    ids = set()
    for component in data['components']:
        if component['id'] in ids:
            raise ValueError('Duplicate component id')
        ids.add(component['id'])
        paths = component['sources'] + component['tools'] + component['generated']
        paths += [i['path'] for i in component['inputs']]
        for path in paths:
            parsed = PurePosixPath(path)
            if not path or parsed.is_absolute() or '..' in parsed.parts or ':' in path or '\\' in path:
                raise ValueError(f'Unsafe source map path: {path}')
        for path in component['sources'] + component['tools'] + component['generated']:
            if not (root / path).exists() or not tracked_path(path, tracked):
                raise ValueError(f'Missing/untracked mapped entry: {path}')
        for item in component['inputs']:
            if tracked_path(item['path'], tracked) != item['tracked']:
                raise ValueError(f'Input tracking changed; review source map: {item["path"]}')
    return data


def prerequisites():
    ok = True
    if sys.version_info < (3, 11):
        print('FAIL: Python 3.11+ required')
        ok = False
    else:
        print(f'PASS: Python {sys.version.split()[0]}')
    if not shutil.which('git'):
        print('FAIL: Git required on PATH')
        ok = False
    node = shutil.which('node')
    if not node:
        print('FAIL: Node.js 24+ required on PATH')
        return False
    result = subprocess.run([node, '--version'], capture_output=True, text=True, check=True)
    major = int(result.stdout.strip().lstrip('v').split('.')[0])
    print(f'{"PASS" if major >= 24 else "FAIL"}: Node.js {result.stdout.strip()} (24+ required)')
    return ok and major >= 24


def report_inputs(root, data):
    blocked = False
    for component in data['components']:
        for item in component['inputs']:
            path = item['path']
            if not (root / path).exists():
                print(f'BLOCKED regeneration [{component["id"]}]: missing {path}')
                blocked = True
            elif not item['tracked']:
                print(f'LOCAL ONLY [{component["id"]}]: {path}; absent from clean checkout')
                blocked = True
    print('INFO: input map covers known critical dependencies, not full generator/build validation.')
    return not blocked


def run_checks(root, profile):
    # Parse our Python without importing application code or producing __pycache__.
    for path in (root / 'tools/repo').glob('*.py'):
        ast.parse(path.read_text(encoding='utf-8'), filename=path.name)
    for executable, directory, args in PROFILES[profile]:
        print(f'RUN [{profile}] {directory}: {executable} {" ".join(args)}', flush=True)
        result = subprocess.run([shutil.which(executable), *args], cwd=root / directory)
        if result.returncode:
            return result.returncode
    print(f'PASS: {profile}; no app build, native/device acceptance or deployment claimed.')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('map', help='Print source/dependency entry points without executing generators')
    doctor = commands.add_parser('doctor', help='Check tools, Git inventory and known regeneration blockers')
    doctor.add_argument('--require-generator-inputs', action='store_true',
                        help='Fail for known missing or local-only generator inputs')
    checks = commands.add_parser('check', help='Run selected existing tests with no private dependencies')
    checks.add_argument('--profile', choices=PROFILES, default='smoke')
    args = parser.parse_args()
    try:
        if args.command != 'map' and not prerequisites():
            return 1
        tracked = git_files(ROOT)
        data = load_map(ROOT, tracked)
        if args.command == 'map':
            for component in data['components']:
                print(f'[{component["id"]}]')
                for category in ['sources', 'tools', 'generated']:
                    print(f'  {category}: {", ".join(component[category]) or "(none)"}')
                for item in component['inputs']:
                    print(f'  input: {item["path"]} (tracked={item["tracked"]})')
                print(f'  {component["notes"]}')
            return 0
        inputs_ok = report_inputs(ROOT, data)
        if args.command == 'doctor':
            print('PASS: offline-check prerequisites and mapped Git entries; generator readiness reported separately.')
            return 1 if args.require_generator_inputs and not inputs_ok else 0
        return run_checks(ROOT, args.profile)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f'FAIL: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
