# Third-party materials and distribution scope

The root MIT license applies to original AMS code and documentation owned by the project contributors. It does not relicense third-party code, dependencies, screenshots of third-party applications, maps, university marks, or other third-party materials. Those materials retain their respective rights and licenses.

- ZXing: the existing Apache-2.0 notice is retained at `outputs/ams-android/app/src/main/assets/licenses/ZXing-LICENSE.txt`. The library binary is not included; consult the Android build instructions for dependency setup.
- npm dependencies: declared by the relevant package manifests and lockfiles. Refer to each upstream package's license. No bundled `node_modules` is distributed.
- Fiddler, Proxyman and other third-party UI shown in the maintainer-created HHT tutorials: screenshots illustrate configuration and have redacted credentials. They are not part of the MIT software grant or a grant of rights to the pictured products.
- The university and campus services operate independently of AMS. Their names and service URLs identify integrations; the project does not grant access rights, authorize third-party API use, or imply university endorsement.
- User login, sessions, keys, production databases, distribution signing and deployment secrets are not supplied.

## Excluded from this public source snapshot

The public export excludes captured university frontend bundles and copied original frontend pages/configuration (`work/app.*.js`, `work/chunk-*.js`, `work/chunk-vendors*.js`, `work/ams-app.js`, `work/ams-config.js`, `work/ams-mobile.html`, `work/ams-public.html`). Their redistribution permission was not established during preparation.

The campus map images `outputs/ams-android/app/src/main/assets/maps/sip.png` and `tc.jpg` are excluded pending redistribution permission. Their embedded copies in generated pages and asset manifests are replaced with the original external asset paths. Related map UI code remains as an integration reference. The map feature and iOS asset regeneration need separately authorized map files for a complete app build; the export does not silently replace them with fictional maps.

Promotional footage, third-party wallpaper/model files, music, private capture files and private signing material are not included. Documentation referring to externally obtained assets does not grant permission to redistribute those assets.

This is a source snapshot with documented build limits. Passing offline tests does not demonstrate real-account school transactions, payment, access-control operation, or installed-device acceptance.

