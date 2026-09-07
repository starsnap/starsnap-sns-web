# StarSnap Design System

`tokens.json` is the version-controlled single source of truth for StarSnap colors, typography, spacing, radii, and interaction sizes.

## Token layers

1. Primitive: raw palette, font sizes, spacing, radii, and motion values.
2. Semantic: `surface`, `text`, `brand`, `danger`, `success`, and other purpose-based aliases.
3. Component: card, header, navigation, and control defaults.

The generated files are committed inside each independently deployed project so Docker and CI builds do not depend on files outside their repository boundary.

## Commands

Run these commands from `starsnap-main/starsnap-sns-web`:

```bash
npm run design:sync
npm run design:check
```

- Change values only in `starsnap-main/starsnap-sns-web/design-system/tokens.json`.
- Run `design:sync` to update the three web CSS files, the web TypeScript bridge, and Android Compose tokens.
- Run `design:check` in CI or before a commit to detect drift.
- Existing `CustomColor` and `CustomTextStyle` Android APIs remain compatibility aliases; new UI should use `StarSnapColor` and `StarSnapTypography`.

## Type scale

| Role | Web | Android |
| --- | ---: | ---: |
| Micro | 10px | 10sp |
| Caption | 12px | 12sp |
| Label | 14px | 14sp |
| Body small | 15px | 15sp |
| Body | 16px | 16sp |
| Title | 18px | 18sp |
| Heading | 20px | 20sp |
| Heading large | 24px | 24sp |
| Display | 30px | 30sp |

Pretendard is the primary family on web and Android. Web projects use the same fallback stack when the webfont is unavailable.
