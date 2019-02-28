const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const tryRequire = require('try-require');
// We need to have React in scope as it is used when we eval the svgr output
// eslint-disable-next-line no-unused-vars
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {default: convert} = require('@svgr/core');
const {svgOptions} = require('@shopify/images/optimize');

// If @shopify/polaris-icons is available to be required, check them too
const polarisIcons = tryRequire('@shopify/polaris-icons') || {};

function audit({filenames, baseDir}) {
  const polarisIconsComponentsPerFilename = Object.keys(polarisIcons).reduce(
    (memo, importKey) => {
      memo[`@shopify/polaris-icons/${importKey}.svg`] = polarisIcons[importKey];
      return memo;
    },
    {},
  );
  filenames.unshift(...Object.keys(polarisIconsComponentsPerFilename));

  const contentsPerFilename = filenames.map((filename) => {
    const reactComponent = filename.startsWith('@shopify/polaris-icons')
      ? polarisIconsComponentsPerFilename[filename]
      : componentFromSvgFile(path.join(baseDir, filename));
    return renderToStaticMarkup(reactComponent());
  });

  const dependentsByHash = filenames.reduce((memo, filename, i) => {
    const fileContents = contentsPerFilename[i];
    const contentHash = md5String(JSON.stringify(fileContents));

    if (!memo.hasOwnProperty(contentHash)) {
      memo[contentHash] = [];
    }
    memo[contentHash].push(filename);

    return memo;
  }, {});

  const duplicatedDependentsByHash = Object.keys(dependentsByHash).reduce(
    (memo, filename) => {
      if (dependentsByHash[filename].length > 1) {
        memo[filename] = dependentsByHash[filename];
      }
      return memo;
    },
    {},
  );

  const duplicatedHashes = Object.keys(duplicatedDependentsByHash);
  const duplicatedHashesCount = duplicatedHashes.length;

  return {
    summary: `Found ${duplicatedHashesCount} content hashes shared by multiple files`,
    status: duplicatedHashesCount > 0 ? 'error' : 'pass',
    info: duplicatedHashes
      .map((hash) => {
        const count = duplicatedDependentsByHash[hash].length;

        const filesStr = duplicatedDependentsByHash[hash]
          .map((file) => `    ${file}`)
          .join('\n');

        return `  ${hash} matches content used in ${count} files:\n${filesStr}`;
      })
      .join('\n'),
  };
}

function md5String(string) {
  return crypto
    .createHash('md5')
    .update(string)
    .digest('hex');
}

function componentFromSvgFile(filename) {
  const source = fs.readFileSync(filename, 'utf8');

  const svgrOutput = convert.sync(
    source,
    {
      plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
      svgoConfig: svgOptions(),
      replaceAttrValues: {
        '#FFF': 'currentColor',
        '#fff': 'currentColor',
        '#212B36': '{undefined}',
        '#212b36': '{undefined}',
      },
      template: ({template}, opts, {jsx}) => template.ast`(props) => ${jsx}`,
      jsx: {
        babelConfig: {
          plugins: [['@babel/plugin-transform-react-jsx']],
        },
      },
    },
    {
      filePath: filename,
    },
  );

  // eslint-disable-next-line no-eval
  return eval(svgrOutput);
}

audit.auditName = 'duplicate-content';
module.exports = audit;