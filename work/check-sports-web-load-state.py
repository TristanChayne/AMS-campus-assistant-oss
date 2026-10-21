"""Compile and run Android-free Sports WebView load-state and navigation regressions."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
JAVA_HOME = Path(os.environ.get("JAVA_HOME", r"E:\RuntimeEnv\Java\jdk-21.0.8+9"))
JAVAC = JAVA_HOME / "bin" / "javac.exe"
JAVA = JAVA_HOME / "bin" / "java.exe"
assert JAVAC.is_file() and JAVA.is_file(), f"JDK 21 is unavailable under {JAVA_HOME}"

sources = [
    ROOT / "outputs/ams-android/app/src/main/java/cn/local/ams/SportsWebLoadState.java",
    ROOT / "outputs/ams-android/app/src/main/java/cn/local/ams/SportsNavigation.java",
    ROOT / "work/SportsWebLoadStateChecks.java",
    ROOT / "work/SportsNavigationChecks.java",
]
with tempfile.TemporaryDirectory(prefix="ams-sports-load-state-") as temporary:
    classes = Path(temporary)
    subprocess.run([str(JAVAC), "-encoding", "UTF-8", "-d", str(classes), *map(str, sources)], check=True)
    subprocess.run([str(JAVA), "-cp", str(classes), "cn.local.ams.SportsWebLoadStateChecks"], check=True)
    subprocess.run([str(JAVA), "-cp", str(classes), "cn.local.ams.SportsNavigationChecks"], check=True)
