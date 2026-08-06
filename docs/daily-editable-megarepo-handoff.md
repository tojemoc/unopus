# Megarepo asset companion: `dailyEditable` on piece-type fields

This Rundown Editor change reads an optional `dailyEditable: true` flag on
payload fields in `sofie-rundown-editor-piece-types.json` (canonical home:
[`tojemoc/sofie` → `assets/`](https://github.com/tojemoc/sofie/tree/main/assets)).

## Fields to mark (suggested for Správy daily rewrite)

| Piece type | Field ids |
|---|---|
| `video` | `fileName` |
| `intro` | `fileName` |
| `bg-loop` | `fileName` |
| `wipe` | `fileName` |
| `l3d-tema` | `headline`, `subline` |
| `l3d-mod` | `name`, `title` |
| `l3d-headline` | `headline`, `subline` |
| `l3d-syn` | `name`, `role` |
| `l3d-sjv` | `headline` |
| `l3d-sport` | `headline` |
| `headline` (ILU) | `text`, `iluFile` |

Example:

```json
{
  "id": "headline",
  "label": "Headline",
  "type": "string",
  "includeInName": true,
  "dailyEditable": true
}
```

## Handoff order (do not skip)

1. Land the JSON change in `tojemoc/sofie` `assets/sofie-rundown-editor-piece-types.json`.
2. In this repo, bump `SOFIE_ASSETS_REF` **and** every `EXPECTED_SHA256` in
   `scripts/fetch-sofie-megarepo-assets.sh` in the **same** commit
   (`git show <sha>:assets/<file> | sha256sum`).
3. Re-run the fetch script / restart so `SOFIE_MEGAREPO_ASSETS` points at the new tree.
4. In RE: **Settings → Connection → Reload type manifests**.

Until step 1–4 land, the Daily rewrite view still edits part **prompter/script**
rows, and piece fields can be marked `dailyEditable` via Settings → Piece Types
after this PR (checkbox on each payload field).
