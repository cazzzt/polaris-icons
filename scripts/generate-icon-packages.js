// Generates polaris-icons's index.ts file based upon the svgs in polaris-icons-raw

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const iconBasePath = path.resolve(
  __dirname,
  '../packages/polaris-icons-raw/icons/polaris',
);

const indexFilePath = path.resolve(
  __dirname,
  '../packages/polaris-icons/src/index.ts',
);

const preamble = `// DO NOT MANUALLY EDIT THIS FILE
// This file was automatically generated
// Run 'yarn run generate-icon-packages' from the root of the monorepo to generate a new version`;

const allSvgExportsString = glob
  .sync('*.svg', {cwd: iconBasePath})
  .filter(isFileExcluded)
  .map(filenameToExport)
  .join('\n\n');

fs.writeFileSync(indexFilePath, `${preamble}\n\n${allSvgExportsString}\n`);

function isFileExcluded(filename) {
  const blocklist = new Set(['ellipsis_minor.svg']);
  return !blocklist.has(filename);
}

function filenameToExport(filename) {
  const basename = path.basename(filename, path.extname(filename));

  return `export {
  default as ${exportName(basename)},
} from '@shopify/polaris-icons-raw/icons/polaris/${filename}';`;
}

/**
 * Capitalizes the first letter and any letter following a hyphen or underscore
 * and removes hyphens and underscores
 *
 * E.g. viewport-wide_major_monotone becomes ViewportWideMajorMonotone,
 */
function exportName(name) {
  return name.replace(/(?:^|[-_])([a-z])/g, (match, letter) => {
    return letter.toUpperCase();
  });
}
