from pathlib import Path

source_path = Path(__file__).with_name('apply-webgpu-benchmark-pass.py')
source = source_path.read_text(encoding='utf-8')
old = '''repls.append((\n"  if (shadowSize > 0) rt.renderer.shadowMap.needsUpdate = true;\\n}\\n\\nfunction browserRafProbe",\n"  if (shadowsEnabled && rt.renderer.shadowMap) rt.renderer.shadowMap.needsUpdate = true;\\n  applyBenchmarkVisibility(rt);\\n}\\n\\nfunction browserRafProbe"\n))'''
new = '''repls.append((\n"  if (shadowSize > 0) rt.renderer.shadowMap.needsUpdate = true;\\n}",\n"  if (shadowsEnabled && rt.renderer.shadowMap) rt.renderer.shadowMap.needsUpdate = true;\\n  applyBenchmarkVisibility(rt);\\n}"\n))'''
if old not in source:
    raise SystemExit('Could not locate footer replacement in WebGPU benchmark helper')
source = source.replace(old, new, 1)
exec(compile(source, str(source_path), 'exec'), {'__file__': str(source_path), '__name__': '__main__'})
