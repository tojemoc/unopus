# Megarepo asset companion: `maxLength` on piece-type string fields

This Rundown Editor change reads an optional `maxLength` integer on payload
fields in `sofie-rundown-editor-piece-types.json` (canonical home:
[`tojemoc/sofie` → `assets/`](https://github.com/tojemoc/sofie/tree/main/assets)).

When set, the piece editor and Daily rewrite view hard-limit input length (with
an `n / max` counter). GFX preview stubs keep a fixed font size and clip with
ellipsis — they do not auto-scale or wrap at the container edge.

## Suggested limits (tune to on-air Caspar templates)

| Piece type | Field ids | Suggested `maxLength` |
|---|---|---|
| `l3d-tema` | `headline`, `subline` | 40 / 50 |
| `l3d-headline` | `headline`, `subline` | 40 / 50 |
| `l3d-mod` | `name`, `title` | 28 / 40 |
| `l3d-predstavovak` | `name`, `title` | 28 / 40 |
| `l3d-syn` | `name`, `role` | 28 / 40 |
| `l3d-sjv` | `kicker`, `headline` | 20 / 40 |
| `l3d-sport` | `kicker`, `headline`, `source` | 20 / 40 / 30 |
| `l3d-odporucanie` | `headline` | 40 |
| `source` | `source` | 30 |

Example:

```json
{
  "id": "headline",
  "label": "Headline",
  "type": "string",
  "includeInName": true,
  "maxLength": 40
}
```

## Handoff order (do not skip)

1. Land the JSON change in `tojemoc/sofie` `assets/sofie-rundown-editor-piece-types.json`.
2. In this repo, bump `SOFIE_ASSETS_REF` **and** every `EXPECTED_SHA256` in
   `scripts/fetch-sofie-megarepo-assets.sh` in the **same** commit
   (`git show <sha>:assets/<file> | sha256sum`).
3. Re-run the fetch script / restart so `SOFIE_MEGAREPO_ASSETS` points at the new tree.
4. In RE: **Settings → Connection → Reload type manifests**.

Until step 1–4 land, operators can set **Max length** per field under
**Settings → Piece Types** (saved in the local type-manifest DB).
