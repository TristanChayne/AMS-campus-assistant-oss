from pathlib import Path
p=Path('outputs/ams-activation/wrangler.jsonc');s=p.read_text(encoding='utf-8-sig').replace('"run_worker_first": true','"run_worker_first": true, "html_handling": "none"');p.write_text(s,encoding='utf-8')
