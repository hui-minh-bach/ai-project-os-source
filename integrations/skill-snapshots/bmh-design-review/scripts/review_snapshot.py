#!/usr/bin/env python3
"""Read-only BMH rectangular geometry review; not engineering certification."""
import argparse
import json
import math
from pathlib import Path


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def review(data):
    issues = []
    def issue(severity, code, path, message):
        issues.append(dict(severity=severity, code=code, path=path, message=message))
    project = data.get('project', data) if isinstance(data, dict) else None
    if not isinstance(project, dict):
        issue('error', 'schema', '$', 'Expected a project object or state containing project.')
        project = {}
    site, plan = project.get('site'), project.get('plan')
    site = site if isinstance(site, dict) else {}
    plan = plan if isinstance(plan, dict) else {}
    width, depth, floors = (site.get(k) for k in ('width', 'depth', 'floors'))
    for key, value in [('width', width), ('depth', depth), ('floors', floors)]:
        if not number(value) or value <= 0 or (key == 'floors' and value != int(value)):
            issue('error', 'site_value', 'site.' + key, 'Expected a finite positive value; floors must be an integer.')
    rooms, openings = plan.get('rooms'), plan.get('openings', [])
    if not isinstance(rooms, list):
        issue('error', 'schema', 'plan.rooms', 'Expected room array.')
        rooms = []
    if not isinstance(openings, list):
        issue('error', 'schema', 'plan.openings', 'Expected opening array.')
        openings = []
    if not rooms:
        issue('warning', 'empty_plan', 'plan.rooms', 'No rooms to review.')
    by_id, valid_rooms = {}, []
    for i, room in enumerate(rooms):
        path = f'plan.rooms[{i}]'
        if not isinstance(room, dict):
            issue('error', 'schema', path, 'Expected room object.')
            continue
        rid = room.get('id')
        if not isinstance(rid, str) or not rid:
            issue('error', 'room_id', path, 'Missing string room id.')
        elif rid in by_id:
            issue('error', 'duplicate_room', path, 'Duplicate room id: ' + rid)
        else:
            by_id[rid] = room
        f = room.get('floor')
        if not number(f) or f < 0 or f != int(f) or (number(floors) and f >= floors):
            issue('error', 'floor', path + '.floor', 'Room floor is outside the declared floors.')
        vals = [room.get(k) for k in ('x', 'y', 'w', 'h')]
        if not all(number(v) for v in vals) or any(v <= 0 for v in vals[2:]):
            issue('error', 'room_geometry', path, 'Expected finite coordinates and positive room dimensions.')
            continue
        x, y, w, h = vals
        if x < -1e-6 or y < -1e-6 or (number(width) and x+w > width+1e-6) or (number(depth) and y+h > depth+1e-6):
            issue('error', 'lot_bounds', path, 'Room exceeds rectangular site bounds.')
        if number(f):
            valid_rooms.append((path, room))
    for i, (path, a) in enumerate(valid_rooms):
        for other_path, b in valid_rooms[i+1:]:
            if a['floor'] != b['floor']:
                continue
            overlap_x = min(a['x']+a['w'], b['x']+b['w']) - max(a['x'], b['x'])
            overlap_y = min(a['y']+a['h'], b['y']+b['h']) - max(a['y'], b['y'])
            if overlap_x > 1e-6 and overlap_y > 1e-6:
                issue('error', 'room_overlap', path, f'Room rectangle overlaps {other_path}; inspect intended topology.')
    opening_ids = set()
    for i, opening in enumerate(openings):
        path = f'plan.openings[{i}]'
        if not isinstance(opening, dict):
            issue('error', 'schema', path, 'Expected opening object.')
            continue
        oid = opening.get('id')
        if not isinstance(oid, str) or not oid:
            issue('error', 'opening_id', path, 'Missing string opening id.')
        elif oid in opening_ids:
            issue('error', 'duplicate_opening', path, 'Duplicate opening id: ' + oid)
        else:
            opening_ids.add(oid)
        room_id = opening.get('roomId')
        room = by_id.get(room_id) if isinstance(room_id, str) else None
        if room is None:
            issue('error', 'opening_room', path, 'Opening references a missing room.')
            continue
        if opening.get('floor') != room.get('floor'):
            issue('error', 'opening_floor', path, 'Opening and room floors differ.')
        side, span, offset = opening.get('side'), opening.get('width'), opening.get('offset')
        if side not in ('north', 'south', 'east', 'west'):
            issue('error', 'opening_side', path, 'Invalid wall side.')
        wall = room.get('w' if side in ('north', 'south') else 'h')
        if not number(span) or span <= 0 or (number(wall) and span > wall+1e-6):
            issue('error', 'opening_width', path, 'Opening width is invalid or exceeds wall length.')
        if not number(offset) or not 0 <= offset <= 1:
            issue('error', 'opening_offset', path, 'Expected offset between zero and one.')
        height = opening.get('height')
        sill = opening.get('sill', 0)
        if height is None:
            issue('warning', 'opening_height_missing', path, 'Opening height is unspecified; inspect normalized runtime geometry.')
        elif not number(height) or height <= 0 or not number(sill) or sill < 0:
            issue('error', 'opening_vertical', path, 'Invalid opening height or sill.')
        else:
            fh, slab = site.get('floorHeight'), site.get('slabThickness')
            if number(fh) and number(slab) and height+sill > fh-slab+1e-6:
                issue('error', 'opening_vertical_fit', path, 'Opening exceeds floor height less slab thickness.')
    errors = sum(i['severity'] == 'error' for i in issues)
    return dict(status='requires_geometry_fix' if errors else 'geometry_checks_passed',
                errors=errors, warnings=sum(i['severity'] == 'warning' for i in issues), issues=issues,
                unverified=['parcel polygon/setbacks', 'wall topology and door swing', 'furniture circulation',
                            'stair geometry/headroom/guards', 'structure and MEP', 'regulatory compliance'],
                scope='Basic rectangular snapshot checks only; not construction approval.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    args = parser.parse_args()
    try:
        result = review(json.loads(args.snapshot.read_text(encoding='utf-8')))
    except (OSError, ValueError) as exc:
        print(json.dumps(dict(status='input_error', error=str(exc))))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
