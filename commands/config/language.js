const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getTranslator, getLanguageLabel } = require('../../utils/localeHelpers');

const SUPPORTED_LANGUAGES = [
  { name: 'English', value: 'en' },
  { name: 'Português (BR)', value: 'pt' },
  { name: 'Português (PT)', value: 'pt-pt' },
  { name: 'Español', value: 'es' },
  { name: 'Français', value: 'fr' },
  { name: 'Italiano', value: 'it' },
  { name: '日本語', value: 'ja' },
  { name: 'Русский', value: 'ru' },
  { name: 'Türkçe', value: 'tr' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Select the bot language for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option => {
      let builder = option.setName('language').setDescription('Language').setRequired(false);
      for (const choice of SUPPORTED_LANGUAGES) {
        builder = builder.addChoices(choice);
      }
      return builder;
    }),
  async execute(interaction, client) {
    if (!client?.i18n?.getFixedT) {
      return interaction.reply({ content: 'Language settings are not available right now.', ephemeral: true });
    }

    const t = await getTranslator(client, interaction.guildId);
    const requestedLanguage = interaction.options.getString('language');

    if (!requestedLanguage) {
      const currentLanguage = await client.i18n.getGuildLanguage(interaction.guildId);
      return interaction.reply({
        content: t('commands.language.current', { language: getLanguageLabel(currentLanguage) }),
        ephemeral: true
      });
    }

    try {
      await client.i18n.setGuildLanguage(interaction.guildId, requestedLanguage);
      return interaction.reply({
        content: t('commands.language.success', { language: getLanguageLabel(requestedLanguage) }),
        ephemeral: true
      });
    } catch (error) {
      client.emit('error', error);
      return interaction.reply({ content: t('commands.language.not_available'), ephemeral: true });
    }
  }
};
