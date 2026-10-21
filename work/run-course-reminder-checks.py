"""Run Android reminder preference/planning checks on the JVM; does not call Android system services."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
JSON_SHA256 = "3cf6cd6892e32e2b4c1c39e0f52f5248a2f5b37646fdfbb79a66b46b618414ed"

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--java-root", type=Path, default=Path("E:/RuntimeEnv/Java/jdk-21.0.8+9"))
parser.add_argument("--sdk-root", type=Path, default=Path("E:/DevTools/AndroidTools/SDK"))
parser.add_argument("--cache", type=Path, default=Path("E:/DevTools/Cache/AMS-ANDROID-SYNC-001"))
args = parser.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)
json_jar = args.cache / "json-20240303.jar"
if not json_jar.exists():
    with urllib.request.urlopen("https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar", timeout=30) as response:
        content = response.read()
    if hashlib.sha256(content).hexdigest() != JSON_SHA256:
        raise SystemExit("JSON test dependency hash mismatch")
    json_jar.write_bytes(content)
if hashlib.sha256(json_jar.read_bytes()).hexdigest() != JSON_SHA256:
    raise SystemExit("JSON test dependency hash mismatch")
classes = args.cache / "reminder-checks"
classes.mkdir(exist_ok=True)
android_jar = args.sdk_root / "platforms/android-36/android.jar"
source = ROOT / "outputs/ams-android/app/src/main/java/cn/local/ams"
zxing_jar = args.sdk_root.parent / "Libraries/zxing-core-3.5.3.jar"
classpath = f"{json_jar};{android_jar};{zxing_jar}"
subprocess.run([str(args.java_root / "bin/javac.exe"), "-encoding", "UTF-8", "--release", "8", "-classpath", classpath, "-d", str(classes), *map(str, source.glob("*.java")), str(ROOT / "work/CourseReminderChecks.java"), str(ROOT / "work/MessageInboxChecks.java")], check=True)
subprocess.run([str(args.java_root / "bin/java.exe"), "-classpath", f"{classes};{classpath}", "cn.local.ams.CourseReminderChecks"], check=True)
