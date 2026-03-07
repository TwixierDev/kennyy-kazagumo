function getTranslator(client, guildId) {
  if (client?.i18n?.getFixedT) {
    return client.i18n.getFixedT(guildId);
  }
  return Promise.resolve((key, variables = {}) => {
    if (!variables || Object.keys(variables).length === 0) return key;
    return key.replace(/\{(\w+)\}/g, (_, token) => {
      const replacement = variables[token];
      return replacement === undefined ? `{${token}}` : String(replacement);
    });
  });
}

const LANGUAGE_LABELS = Object.freeze({
  en: 'English',
  pt: 'Português (BR)',
  'pt-pt': 'Português (PT)',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ru: 'Русский',
  tr: 'Türkçe'
});

function getLanguageLabel(code) {
  return LANGUAGE_LABELS[code] ?? code;
}

module.exports = { getTranslator, getLanguageLabel };
