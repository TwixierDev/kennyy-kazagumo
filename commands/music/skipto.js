const { SlashCommandBuilder } = require('discord.js');
const { getTranslator } = require('../../utils/localeHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skipto')
    .setDescription('Jump to a specific track in the queue')
    .addIntegerOption(option =>
      option
        .setName('position')
        .setDescription('Position in the queue (1 = next track)')
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction, client) {
    const t = await getTranslator(client, interaction.guildId);
    const voiceChannel = interaction.member?.voice?.channel;
    const player = client.kazagumo.players.get(interaction.guildId);
    const position = interaction.options.getInteger('position', true);

    if (!voiceChannel) {
      return interaction.reply({ content: t('common.voice_required'), ephemeral: true });
    }

    if (!player) {
      return interaction.reply({ content: t('common.no_player'), ephemeral: true });
    }

    if (voiceChannel.id !== player.voiceId) {
      return interaction.reply({ content: t('common.not_same_channel'), ephemeral: true });
    }

    if (!player.queue?.current) {
      return interaction.reply({ content: t('commands.skip.no_track'), ephemeral: true });
    }

    if (position < 1) {
      return interaction.reply({ content: t('commands.skipto.invalid_position'), ephemeral: true });
    }

    const queueLength = player.queue.length;
    if (queueLength < position) {
      return interaction.reply({ content: t('commands.skipto.too_short'), ephemeral: true });
    }

    // Remove all tracks before the target position
    // Position 1 = skip to next track (remove 0 tracks)
    // Position 2 = skip to 2nd track (remove 1 track)
    // Position 9 = skip to 9th track (remove 8 tracks)
    const tracksToRemove = position - 1;
    for (let i = 0; i < tracksToRemove; i += 1) {
      player.queue.shift();
    }

    // Skip current track to play the target track
    player.skip();

    return interaction.reply({ content: t('commands.skipto.success', { position }), ephemeral: true });
  }
};
