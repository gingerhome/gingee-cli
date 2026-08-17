/**
 * Optional feature packages for Gingee (keep in sync with gingee package.json
 * optionalDependencies and docs/server-config.md → Optional npm feature packages).
 * Used by `gingee-cli init` so new projects can install a slim core, then add only what they need.
 *
 * @type {Record<string, { name: string, packages: string[], description: string }>}
 */
const FEATURE_OPTIONS = {
  image: {
    name: 'Image processing (sharp)',
    packages: ['sharp'],
    description: "require('image') — resize, filters, format conversion"
  },
  postgres: {
    name: 'PostgreSQL driver (pg)',
    packages: ['pg'],
    description: 'app.json db type "postgres"'
  },
  mysql: {
    name: 'MySQL / MariaDB driver (mysql2)',
    packages: ['mysql2'],
    description: 'app.json db type "mysql"'
  },
  mssql: {
    name: 'Microsoft SQL Server driver (mssql)',
    packages: ['mssql'],
    description: 'app.json db type "mssql"'
  },
  oracle: {
    name: 'Oracle driver (oracledb)',
    packages: ['oracledb'],
    description: 'app.json db type "oracle" (native client often required)'
  },
  charts: {
    name: 'Charts & canvas (chartjs-node-canvas, canvas)',
    packages: ['chartjs-node-canvas', 'canvas'],
    description: 'chart / dashboard / barcode canvas rendering'
  },
  pdf: {
    name: 'PDF generation (pdfmake)',
    packages: ['pdfmake'],
    description: 'pdf module'
  },
  sendgrid: {
    name: 'SendGrid email (@sendgrid/mail)',
    packages: ['@sendgrid/mail'],
    description: 'email type "sendgrid" (console works without this)'
  },
  gemini: {
    name: 'Google Gemini AI (@google/generative-ai)',
    packages: ['@google/generative-ai'],
    description: 'ai type "gemini" (mock works without this)'
  }
};

/** Recommended developer set (Joy without Oracle / all SQL engines). */
const RECOMMENDED_FEATURES = ['image', 'postgres', 'charts', 'pdf', 'sendgrid', 'gemini'];

/** All optional feature keys. */
const ALL_FEATURES = Object.keys(FEATURE_OPTIONS);

/**
 * @param {string[]} featureKeys
 * @returns {string[]} unique npm package names
 */
function packagesForFeatures(featureKeys) {
  const set = new Set();
  for (const key of featureKeys || []) {
    const feat = FEATURE_OPTIONS[key];
    if (!feat) continue;
    for (const pkg of feat.packages) set.add(pkg);
  }
  return [...set];
}

/**
 * @param {'minimal'|'recommended'|'full'|'custom'} profile
 * @param {string[]} [customKeys]
 * @returns {string[]}
 */
function resolveFeatureKeys(profile, customKeys = []) {
  switch (profile) {
    case 'minimal':
      return [];
    case 'recommended':
      return [...RECOMMENDED_FEATURES];
    case 'full':
      return [...ALL_FEATURES];
    case 'custom':
      return Array.isArray(customKeys) ? customKeys.filter((k) => FEATURE_OPTIONS[k]) : [];
    default:
      return [];
  }
}

/**
 * Inquirer choices for the custom checkbox.
 * @returns {Array<{ name: string, value: string, checked: boolean }>}
 */
function checkboxChoices() {
  return ALL_FEATURES.map((key) => ({
    name: `${FEATURE_OPTIONS[key].name} — ${FEATURE_OPTIONS[key].description}`,
    value: key,
    checked: RECOMMENDED_FEATURES.includes(key)
  }));
}

module.exports = {
  FEATURE_OPTIONS,
  RECOMMENDED_FEATURES,
  ALL_FEATURES,
  packagesForFeatures,
  resolveFeatureKeys,
  checkboxChoices
};
