const { SlashCommandBuilder } = require('discord.js');
const { getTranslator } = require('../../utils/localeHelpers');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current song'),
  async execute(interaction, client) {
    const t = await getTranslator(client, interaction.guildId);
    const voiceChannel = interaction.member?.voice?.channel;
    const player = client.kazagumo.players.get(interaction.guildId);

    if (!voiceChannel) {
      return interaction.reply({ content: t('common.voice_required'), ephemeral: true });
    }

    if (!player) {
      return interaction.reply({ content: t('common.no_player'), ephemeral: true });
    }

    if (voiceChannel.id !== player.voiceId) {
      return interaction.reply({ content: t('common.not_same_channel'), ephemeral: true });
    }

    if (player.paused) {
      return interaction.reply({ content: t('commands.pause.already_paused'), ephemeral: true });
    }

    await player.pause(true);
    return interaction.reply({ content: t('commands.pause.success'), ephemeral: true });
  }
};
