"""Package local Quaternius CC0 downloads. No source files are modified."""
from pathlib import Path
import argparse, copy, json, struct, hashlib


def read_glb(path):
    raw = path.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); offset = 20 + size
    length = struct.unpack_from('<I', raw, offset)[0]
    return doc, raw[offset + 8:offset + 8 + length]


def write_glb(path, doc, data):
    data += b'\0' * (-len(data) % 4)
    doc['buffers'] = [{'byteLength': len(data)}]
    raw = json.dumps(doc, separators=(',', ':')).encode(); raw += b' ' * (-len(raw) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(raw) + len(data)) + struct.pack('<II', len(raw), 0x4E4F534A) + raw + struct.pack('<II', len(data), 0x004E4942) + data)


def character(source, hair_path, output):
    d = json.loads(source.read_text()); data = bytearray((source.parent / d['buffers'][0]['uri']).read_bytes())
    images = d.get('images', []); textures = d.get('textures', [])
    new_images, new_textures = [], []
    for material in d['materials']:
        material.pop('normalTexture', None); material.pop('occlusionTexture', None)
        pbr = material.setdefault('pbrMetallicRoughness', {})
        pbr.pop('metallicRoughnessTexture', None); pbr['roughnessFactor'] = 0.82
        if 'Hair' in material.get('name', ''):
            pbr.pop('baseColorTexture', None); pbr['baseColorFactor'] = [0.075, 0.04, 0.022, 1]
        if 'baseColorTexture' in pbr:
            image = images[textures[pbr['baseColorTexture']['index']]['source']]
            image_path = source.parent / image['uri']
            if not image_path.exists(): image_path = source.parent / image['uri'].replace('_png.png', '.png')
            raw = image_path.read_bytes(); data.extend(b'\0' * (-len(data) % 4))
            view = len(d['bufferViews']); d['bufferViews'].append({'buffer': 0, 'byteOffset': len(data), 'byteLength': len(raw)})
            data.extend(raw); new_images.append({'bufferView': view, 'mimeType': 'image/png'})
            new_textures.append({'source': len(new_images) - 1})
            pbr['baseColorTexture'] = {'index': len(new_textures) - 1}
    d['images'], d['textures'] = new_images, new_textures
    d.pop('samplers', None)
    h = json.loads(hair_path.read_text()); hb = (hair_path.parent / h['buffers'][0]['uri']).read_bytes()
    source_names = [h['nodes'][j]['name'] for j in h['skins'][0]['joints']]
    target_names = [d['nodes'][j]['name'] for j in d['skins'][0]['joints']]
    assert source_names == target_names, 'Hair joint ordering differs'
    data.extend(b'\0' * (-len(data) % 4)); offset = len(data); data.extend(hb)
    vo, ao = len(d['bufferViews']), len(d['accessors'])
    for view in h['bufferViews']:
        view = copy.deepcopy(view); view['byteOffset'] = view.get('byteOffset', 0) + offset; d['bufferViews'].append(view)
    for accessor in h['accessors']:
        accessor = copy.deepcopy(accessor); accessor['bufferView'] += vo; d['accessors'].append(accessor)
    mi = len(d['materials']); d['materials'].append({'name': 'CitizenHair', 'pbrMetallicRoughness': {'baseColorFactor': [0.075, 0.04, 0.022, 1], 'roughnessFactor': 0.9, 'metallicFactor': 0}})
    for mesh in h['meshes']:
        mesh = copy.deepcopy(mesh)
        for prim in mesh['primitives']:
            prim['attributes'] = {k: v + ao for k, v in prim['attributes'].items()}
            if 'indices' in prim: prim['indices'] += ao
            prim['material'] = mi
        mesh_id = len(d['meshes']); d['meshes'].append(mesh)
        node_id = len(d['nodes']); d['nodes'].append({'name': 'CitizenHair', 'mesh': mesh_id, 'skin': 0})
        d['nodes'][d['scenes'][0]['nodes'][0]]['children'].append(node_id)
    write_glb(output, d, bytes(data))


def animations(inputs, output):
    out = {'asset': {'version': '2.0', 'generator': 'Hierapolis curated Quaternius animations'}, 'nodes': [], 'scenes': [{'nodes': []}], 'scene': 0, 'accessors': [], 'bufferViews': [], 'animations': []}
    data = bytearray()
    for path, selected in inputs:
        doc, binary = read_glb(path)
        if not out['nodes']:
            out['nodes'] = [{k: v for k, v in n.items() if k not in ['mesh', 'skin']} for n in doc['nodes']]
            out['scenes'] = doc['scenes']
        node_by_name = {n.get('name'): i for i, n in enumerate(out['nodes'])}
        accessor_map = {}
        for animation in doc['animations']:
            if animation['name'] not in selected: continue
            animation = copy.deepcopy(animation)
            for sampler in animation['samplers']:
                for field in ['input', 'output']:
                    source_id = sampler[field]
                    if source_id in accessor_map:
                        sampler[field] = accessor_map[source_id]; continue
                    accessor = copy.deepcopy(doc['accessors'][source_id])
                    view = copy.deepcopy(doc['bufferViews'][accessor['bufferView']])
                    start = view.get('byteOffset', 0); chunk = binary[start:start + view['byteLength']]
                    data.extend(b'\0' * (-len(data) % 4))
                    view.update(buffer=0, byteOffset=len(data)); data.extend(chunk)
                    accessor['bufferView'] = len(out['bufferViews']); out['bufferViews'].append(view)
                    sampler[field] = len(out['accessors']); accessor_map[source_id] = sampler[field]; out['accessors'].append(accessor)
            for channel in animation['channels']:
                name = doc['nodes'][channel['target']['node']]['name']
                channel['target']['node'] = node_by_name[name]
            # Preserve each source bind pose for proportion-aware retargeting.
            animation['extras'] = {'bindPose': {n['name']: {k: n[k] for k in ['rotation', 'translation', 'scale'] if k in n} for n in doc['nodes'] if 'name' in n}}
            out['animations'].append(animation)
    write_glb(output, out, bytes(data))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--downloads', type=Path, default=Path.home() / 'Downloads'); args = parser.parse_args()
    base = args.downloads / 'Universal Base Characters[Standard]'
    out = Path('public/models/citizens'); out.mkdir(parents=True, exist_ok=True)
    for sex, hair in [('Male', 'SimpleParted'), ('Female', 'Buns')]:
        character(base / f'Base Characters/Godot - UE/Superhero_{sex}_FullBody.gltf', base / f'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_{hair}.gltf', out / f'{sex.lower()}.glb')
    animations([(args.downloads / 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb', {'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Idle_Talking_Loop', 'Interact'}), (args.downloads / 'Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb', {'Yes', 'Idle_FoldArms_Loop', 'Walk_Carry_Loop'})], out / 'motions.glb')
    for label, folder, filename in [('base', base, 'License_Standard.txt'), ('animation-1', args.downloads / 'Universal Animation Library[Standard]', 'License.txt'), ('animation-2', args.downloads / 'Universal Animation Library 2[Standard]', 'License.txt')]:
        (out / f'LICENSE-{label}.txt').write_bytes((folder / filename).read_bytes())
    manifest = {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in out.glob('*.glb')}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n'); print(json.dumps(manifest, indent=2))
