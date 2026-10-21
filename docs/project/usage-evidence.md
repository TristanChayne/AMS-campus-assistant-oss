# Usage evidence / 使用证据

Evidence supplied by the maintainer on 2026-10-21. The screenshots' original capture times were not independently established.

| Source | Snapshot scope | Reported metric |
|---|---|---|
| Apple TestFlight | iOS 0.2.0 build 6 | 88 installations; 1,899 recorded app uses |
| Pgyer | Android 0.15.0, 0.14.0, 0.13.3, 0.13.2, 0.13.1 | 6 + 122 + 13 + 7 + 2 = 150 downloads |

Installations and downloads are not unique users. Do not sum installations across iOS builds to infer people. Invitation counts do not prove installation or participation. A dash in TestFlight is not interpreted as zero crashes or zero usage. The Android screenshot is a historical subset, not a current full release list.

The original platform screenshots are retained with the application materials for review. They are not uploaded in this proposed public source tree.

Recent maintenance includes reservation UI fixes, iOS session/foreground recovery, signed Android/iOS package preparation and release/update coordination. The private collaboration repository records the work; its private PR URLs are not presented as public evidence.

The exported GitHub Actions workflow runs offline smoke/service checks. Any new public workflow results should be checked after publication rather than inferred from earlier private CI.

