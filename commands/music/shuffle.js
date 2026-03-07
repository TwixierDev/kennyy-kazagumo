const { SlashCommandBuilder } = require('discord.js');
const { getTranslator } = require('../../utils/localeHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the current queue'),
  async execute(interaction, client) {
    const t = await getTranslator(client, interaction.guildId);
    const player = client.kazagumo.players.get(interaction.guildId);

    if (!player || !player.queue.length) {
      return interaction.reply({ content: t('commands.shuffle.empty'), ephemeral: true });
    }

    // Embaralha a fila
    player.queue.shuffle();

    return interaction.reply({ content: `🔀 ${t('commands.shuffle.success')}`, ephemeral: false });
  }
};
