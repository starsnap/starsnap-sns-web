import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, '../../..');
const tokens = JSON.parse(fs.readFileSync(path.join(here, 'tokens.json'), 'utf8'));

const generatedHeader = '/* AUTO-GENERATED from /starsnap-main/starsnap-sns-web/design-system/tokens.json. Do not edit directly. */';
const generatedXmlHeader = '<!-- AUTO-GENERATED from /starsnap-main/starsnap-sns-web/design-system/tokens.json. Do not edit directly. -->';
const colorPrimitives = tokens.color.primitive;
const semanticColors = tokens.color.semantic;
const darkSemanticColors = tokens.color.theme.dark;
const lightEffects = tokens.color.effect.light;
const darkEffects = tokens.color.effect.dark;

const kebab = (value) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const cssColorVar = (reference) => {
  const [group, shade] = reference.split('.');
  return `var(--ss-${kebab(group)}-${kebab(shade)})`;
};
const resolveColor = (reference) => {
  const [group, shade] = reference.split('.');
  return colorPrimitives[group][shade];
};
const composeColor = (hex) => `0xFF${hex.slice(1).toUpperCase()}`;
const kotlinName = (value) => value;
const fontWeightName = {
  regular: 'Normal',
  medium: 'Medium',
  semibold: 'SemiBold',
  bold: 'Bold',
};

function assertMatchingKeys(label, light, dark) {
  const lightKeys = Object.keys(light).sort();
  const darkKeys = Object.keys(dark).sort();
  if (JSON.stringify(lightKeys) !== JSON.stringify(darkKeys)) {
    const missing = lightKeys.filter((key) => !darkKeys.includes(key));
    const extra = darkKeys.filter((key) => !lightKeys.includes(key));
    throw new Error(`${label} theme keys differ. missing=[${missing.join(', ')}] extra=[${extra.join(', ')}]`);
  }
}

function assertColorReferences(label, colors) {
  for (const [name, reference] of Object.entries(colors)) {
    const [group, shade] = reference.split('.');
    if (!colorPrimitives[group] || colorPrimitives[group][shade] === undefined) {
      throw new Error(`${label}.${name} references unknown primitive: ${reference}`);
    }
  }
}

assertMatchingKeys('semantic color', semanticColors, darkSemanticColors);
assertMatchingKeys('effect color', lightEffects, darkEffects);
assertColorReferences('color.semantic', semanticColors);
assertColorReferences('color.theme.dark', darkSemanticColors);

function generateCss() {
  const lines = [generatedHeader, ':root {', '  color-scheme: light;', '', '  /* Primitive colors */'];

  for (const [group, shades] of Object.entries(colorPrimitives)) {
    for (const [shade, value] of Object.entries(shades)) {
      lines.push(`  --ss-${kebab(group)}-${kebab(shade)}: ${value};`);
    }
  }

  lines.push('', '  /* Primitive typography */');
  lines.push(`  --ss-font-sans: ${tokens.typography.family.sans};`);
  lines.push(`  --ss-font-mono: ${tokens.typography.family.mono};`);
  for (const [name, value] of Object.entries(tokens.typography.size)) {
    lines.push(`  --ss-font-size-${kebab(name)}: ${value.rem};`);
  }
  for (const [name, value] of Object.entries(tokens.typography.weight)) {
    lines.push(`  --ss-font-weight-${kebab(name)}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.typography.lineHeight)) {
    lines.push(`  --ss-line-height-${kebab(name)}: ${value};`);
  }

  lines.push('', '  /* Primitive spacing, geometry, and motion */');
  for (const [name, value] of Object.entries(tokens.space)) lines.push(`  --ss-space-${name}: ${value};`);
  for (const [name, value] of Object.entries(tokens.radius)) lines.push(`  --ss-radius-${name}: ${value};`);
  lines.push('  --ss-shadow-sm: 0 1px 2px var(--ss-shadow-color-soft);');
  lines.push('  --ss-shadow-md: 0 12px 32px var(--ss-shadow-color);');
  lines.push('  --ss-shadow-lg: 0 20px 48px var(--ss-shadow-color-strong);');
  lines.push(`  --ss-duration-fast: ${tokens.motion.fast};`);
  lines.push(`  --ss-duration-normal: ${tokens.motion.normal};`);
  lines.push(`  --ss-ease-standard: ${tokens.motion.ease};`);

  lines.push('', '  /* Semantic colors */');
  for (const [name, reference] of Object.entries(semanticColors)) {
    lines.push(`  --ss-${kebab(name)}: ${cssColorVar(reference)};`);
  }
  for (const [name, value] of Object.entries(lightEffects)) {
    lines.push(`  --ss-${kebab(name)}: ${value};`);
  }

  lines.push('', '  /* Semantic typography */');
  for (const [name, role] of Object.entries(tokens.typography.roles)) {
    lines.push(`  --ss-type-${kebab(name)}-size: var(--ss-font-size-${kebab(role.size)});`);
    lines.push(`  --ss-type-${kebab(name)}-weight: var(--ss-font-weight-${kebab(role.weight)});`);
  }

  lines.push('', '  /* Component tokens */');
  lines.push('  --ss-header-bg: var(--ss-header-backdrop);');
  lines.push('  --ss-nav-bg: var(--ss-nav-backdrop);');
  lines.push('  --ss-card-bg: var(--ss-surface);');
  lines.push('  --ss-card-border: var(--ss-border);');
  lines.push('  --ss-card-radius: var(--ss-radius-lg);');
  lines.push('  --ss-card-shadow: var(--ss-shadow-sm);');
  lines.push('  --ss-control-radius: var(--ss-radius-md);');
  lines.push(`  --ss-control-height: ${tokens.control.height};`);
  lines.push('}');

  lines.push('', 'html.dark {', '  color-scheme: dark;');
  for (const [name, reference] of Object.entries(darkSemanticColors)) {
    lines.push(`  --ss-${kebab(name)}: ${cssColorVar(reference)};`);
  }
  for (const [name, value] of Object.entries(darkEffects)) {
    lines.push(`  --ss-${kebab(name)}: ${value};`);
  }
  lines.push('}');

  return `${lines.join('\n')}\n`;
}

function generateTypeScript() {
  const colorEntries = Object.keys(semanticColors)
    .map((name) => `    ${name}: 'var(--ss-${kebab(name)})',`)
    .join('\n\n');
  const sizeEntries = Object.keys(tokens.typography.size)
    .map((name) => `    ${name}: 'var(--ss-font-size-${kebab(name)})',`)
    .join('\n');

  return `// AUTO-GENERATED from /starsnap-main/starsnap-sns-web/design-system/tokens.json. Do not edit directly.\n` +
`export const designTokens = {\n` +
`  color: {\n${colorEntries}\n  },\n` +
`  typography: {\n` +
`    fontFamily: 'var(--ss-font-sans)',\n` +
`    size: {\n${sizeEntries}\n    },\n` +
`  },\n` +
`} as const;\n`;
}

function generateAndroidColors() {
  const semanticProperties = Object.keys(semanticColors)
    .map((name) => `    val ${kotlinName(name)}: Color,`)
    .join('\n');
  const lightEntries = Object.entries(semanticColors)
    .map(([name, reference]) => `    ${kotlinName(name)} = Color(${composeColor(resolveColor(reference))}),`)
    .join('\n');
  const darkEntries = Object.entries(darkSemanticColors)
    .map(([name, reference]) => `    ${kotlinName(name)} = Color(${composeColor(resolveColor(reference))}),`)
    .join('\n');
  const semanticAccessors = Object.keys(semanticColors)
    .map((name) => `    val ${kotlinName(name)}: Color\n` +
      `        @Composable @ReadOnlyComposable get() = LocalStarSnapColors.current.${kotlinName(name)}`)
    .join('\n');
  const brandEntries = Object.entries(colorPrimitives.yellow)
    .map(([shade, value]) => `    val yellow${shade} = Color(${composeColor(value)})`)
    .join('\n');

  return `// AUTO-GENERATED from /starsnap-main/starsnap-sns-web/design-system/tokens.json. Do not edit directly.\n` +
`package com.sns.starsnap.designsystem\n\n` +
`import androidx.compose.runtime.Composable\n` +
`import androidx.compose.runtime.Immutable\n` +
`import androidx.compose.runtime.ReadOnlyComposable\n` +
`import androidx.compose.runtime.staticCompositionLocalOf\n` +
`import androidx.compose.ui.graphics.Color\n\n` +
`@Immutable\n` +
`data class StarSnapColors(\n${semanticProperties}\n)\n\n` +
`val StarSnapLightColors = StarSnapColors(\n${lightEntries}\n)\n\n` +
`val StarSnapDarkColors = StarSnapColors(\n${darkEntries}\n)\n\n` +
`internal val LocalStarSnapColors = staticCompositionLocalOf { StarSnapLightColors }\n\n` +
`object StarSnapColor {\n${semanticAccessors}\n\n${brandEntries}\n}\n`;
}

function generateAndroidTypography() {
  const sizeEntries = Object.entries(tokens.typography.size)
    .map(([name, value]) => `    val ${name} = ${value.sp}.sp`)
    .join('\n');
  const roleEntries = Object.entries(tokens.typography.roles)
    .map(([name, role]) => `    val ${name} = TextStyle(\n` +
      `        fontFamily = TextFont.pretendard,\n` +
      `        fontWeight = FontWeight.${fontWeightName[role.weight]},\n` +
      `        fontSize = StarSnapFontSize.${role.size},\n` +
      `        lineHeight = ${role.lineHeightSp}.sp,\n` +
      `        color = Color.Unspecified,\n` +
      `    )`)
    .join('\n\n');

  return `// AUTO-GENERATED from /starsnap-main/starsnap-sns-web/design-system/tokens.json. Do not edit directly.\n` +
`package com.sns.starsnap.designsystem.text\n\n` +
`import androidx.compose.ui.graphics.Color\n` +
`import androidx.compose.ui.text.TextStyle\n` +
`import androidx.compose.ui.text.font.FontWeight\n` +
`import androidx.compose.ui.unit.sp\n` +
`\n` +
`object StarSnapFontSize {\n${sizeEntries}\n}\n\n` +
`object StarSnapTypography {\n${roleEntries}\n}\n`;
}

function generateAndroidThemeColors(colors) {
  return `${generatedXmlHeader}\n` +
`<resources>\n` +
`    <color name="starsnap_canvas">${resolveColor(colors.canvas)}</color>\n` +
`</resources>\n`;
}

const css = generateCss();
const targets = new Map([
  ['starsnap-main/starsnap-sns-web/src/styles/tokens.css', css],
  ['starsnap-admin/starsnap-admin-web/src/design-tokens.css', css],
  ['starsnap-log/starsnap-log-web/src/design-tokens.css', css],
  ['starsnap-main/starsnap-sns-web/src/styles/designTokens.ts', generateTypeScript()],
  ['starsnap-main/starsnap-android/core/designsystem/src/main/java/com/sns/starsnap/designsystem/StarSnapColor.kt', generateAndroidColors()],
  ['starsnap-main/starsnap-android/core/designsystem/src/main/java/com/sns/starsnap/designsystem/text/StarSnapTypography.kt', generateAndroidTypography()],
  ['starsnap-main/starsnap-android/core/designsystem/src/main/res/values/colors.xml', generateAndroidThemeColors(semanticColors)],
  ['starsnap-main/starsnap-android/core/designsystem/src/main/res/values-night/colors.xml', generateAndroidThemeColors(darkSemanticColors)],
]);

const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode)) {
  throw new Error('Use --check or --write.');
}

let hasMismatch = false;
for (const [relativePath, content] of targets) {
  const targetPath = path.join(workspaceRoot, relativePath);
  if (mode === '--write') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`wrote ${relativePath}`);
    continue;
  }

  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
  if (current !== content) {
    hasMismatch = true;
    console.error(`out of sync: ${relativePath}`);
  } else {
    console.log(`ok: ${relativePath}`);
  }
}

if (hasMismatch) process.exitCode = 1;
