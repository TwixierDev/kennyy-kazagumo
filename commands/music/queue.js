const { SlashCommandBuilder } = require('discord.js');
const { getTranslator } = require('../../utils/localeHelpers');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the playback queue with interactive controls'),
  async execute(interaction, client) {
    const t = await getTranslator(client, interaction.guildId);
    const player = client.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.reply({ content: t('common.no_player'), ephemeral: true });
    }

    const helpers = client.queueHelpers;
    const state = { page: 0, perPage: 10, guildId: interaction.guildId };

    const embed = helpers?.buildQueueEmbed
      ? helpers.buildQueueEmbed(player, state.page, state.perPage, t)
      : null;
    const components = helpers?.buildQueueComponents
      ? helpers.buildQueueComponents(state.page, state.perPage, player, t)
      : [];

    const payload = embed ? { embeds: [embed], components } : { content: t('queue.title'), components };

    const message = await interaction.reply({ ...payload, fetchReply: true });

    if (client.queueState) {
      client.queueState.set(message.id, state);
    }
  }
};
