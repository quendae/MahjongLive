from pathlib import Path

root = Path(__file__).resolve().parents[1]

main_path = root / 'client/src/main.ts'
main = main_path.read_text(encoding='utf-8')
old_rules = "import { isRonFuriten, seatWindFor, winningTileTypeKeys } from '@mahjong-live/shared/rules';"
new_rules = "import { allTileTypes, isRonFuriten, seatWindFor, tileTypeKey, winningTileTypeKeys } from '@mahjong-live/shared/rules';"
if old_rules not in main:
    raise SystemExit('rules import anchor missing')
main = main.replace(old_rules, new_rules, 1)
old_tiles = "import { allTileTypes, tileTypeKey } from '@mahjong-live/shared/tiles';\n"
if old_tiles not in main:
    raise SystemExit('tiles import anchor missing')
main = main.replace(old_tiles, '', 1)
main_path.write_text(main, encoding='utf-8')

rules_path = root / 'shared/src/engine/rules/index.ts'
rules = rules_path.read_text(encoding='utf-8')
export_line = "export { allTileTypes, tileTypeKey } from '../tiles/tiles';\n"
if export_line not in rules:
    rules += export_line
rules_path.write_text(rules, encoding='utf-8')
