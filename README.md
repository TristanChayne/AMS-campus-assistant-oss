# AMS Campus Assistant / AMS 校园助手

A student-built, unofficial campus assistant for Xi'an Jiaotong-Liverpool University (XJTLU), with Android and iOS clients for timetables, course reminders and campus-service access.

学生独立开发的非官方校园助手。学校认证、预约及其他业务结果由对应学校系统决定；本项目不代表校方，也不提供学校账号或绕过访问控制。

## Features and scope

- Timetables and course reminder interfaces across Android and iOS.
- Campus-service entry points and UI adaptations for library seating, discussion rooms, sports and shuttle services.
- Shared web UI, native platform code, an administration frontend and service source.
- Mini Program source is included as development work; its generator still has four missing historical inputs. It is not presented as a fully reproducible or publicly released client.

功能开放情况依赖安装版本、账号权限和对应学校服务。原生构建、真实设备与真实业务验收分别记录，不将演示数据或模拟支付当作实际交易结果。

## Usage evidence

Maintainer-provided platform screenshots show:

- iOS 0.2.0 build 6: **88 installations and 1,899 recorded app uses** in TestFlight.
- Five Android versions visible in the supplied Pgyer screenshot: **150 downloads** in total (6 + 122 + 13 + 7 + 2).

These are screenshot snapshots supplied on 2026-10-21; they are not unique-user counts, monthly active users or a complete all-version download total. See [usage evidence](docs/project/usage-evidence.md).

## Start here

- [Development setup and offline checks](docs/development/README.md)
- [Source map](docs/development/source-map.md)
- [Contributing](CONTRIBUTING.md)
- [Current work and verification boundaries](TASKS.md), [project progress](项目进度.md), [product decisions](DECISIONS.md)

`outputs/` includes source and `work/` includes generators and authored inputs. Do not remove directories based on their names.

```text
python -B tools/repo/manage.py doctor
python -B tools/repo/manage.py check --profile smoke
python -B tools/repo/manage.py check --profile service
```

These checks do not require production credentials, install dependencies, deploy services or contact school systems. Full native builds have additional requirements described in the development guide.

## Source snapshot and build limits

This public export starts from source commit `dffa689bd4d1c75e2fac2dbe37426919639545ef` in the maintainer's private collaboration repository. The new public history starts with this export; it does not claim to reconstruct earlier development history.

University frontend bundles and copied pages/configuration are excluded because redistribution permission was not established. Campus map images are also excluded. The native app depends on live school services and authorized external assets; offline checks do not imply a complete standalone app build. Existing private collaboration branches, tags, personal instructions and production data are not published with this snapshot.

## License and third-party materials

Original AMS code is released under the [MIT License](LICENSE). Third-party components and materials retain their own rights; see [distribution scope and notices](THIRD_PARTY_NOTICES.md). Source publication does not imply university authorization or permission to redistribute externally sourced assets.

