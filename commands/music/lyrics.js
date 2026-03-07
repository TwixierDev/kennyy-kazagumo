const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTranslator } = require('../../utils/localeHelpers');
const { fetchLyrics, findLineIndex, renderTimedSnippet, getApproxPositionMs } = require('../../utils/lyricsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Show lyrics for the current track'),
  async execute(interaction, client) {
    const t = await getTranslator(client, interaction.guildId);
    const player = client.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.reply({ content: t('common.no_player'), ephemeral: true });
    }

    const track = player.queue.current;
    if (!track) {
      return interaction.reply({ content: t('lyrics.no_track'), ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });

    const searchingEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t('lyrics.searching_title'))
      .setDescription(t('lyrics.searching_description', { song: track.title }))
      .setFooter({ text: t('lyrics.searching_footer') });

    const message = await interaction.editReply({ embeds: [searchingEmbed] });

    const lyricsData = await fetchLyrics(track);

    if (!lyricsData) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(t('lyrics.not_found_title'))
        .setDescription(t('lyrics.not_found_description', { query: `${track.title} - ${track.author}` }));
      return interaction.editReply({ embeds: [notFoundEmbed] });
    }

    const timedLines = lyricsData.timedLines || [];
    const positionMs = getApproxPositionMs(player, track);
    const currentIndex = timedLines.length > 0 ? findLineIndex(timedLines, positionMs) : null;
    const snippet = timedLines.length > 0 ? renderTimedSnippet(timedLines, currentIndex) : null;

    const description = snippet || lyricsData.lyrics || t('lyrics.empty');
    const finalEmbed = createLyricsEmbed(track, lyricsData, description, t);

    await interaction.editReply({ embeds: [finalEmbed] });

    if (timedLines.length > 0) {
      startLyricsSync(player, message, track, lyricsData, t);
    }
  }
};

function createLyricsEmbed(track, lyricsData, description, t) {
  if (description.length > 4000) {
    description = description.substring(0, 3997) + '...';
  }

  const embed = new EmbedBuilder()
    .setColor(0xffff64)
    .setTitle(t('lyrics.embed_title', { title: lyricsData.title || track.title }))
    .setDescription(description)
    .setAuthor({
      name: lyricsData.artist || track.author,
      iconURL: lyricsData.thumbnail || null
    })
    .setFooter({
      text: t('lyrics.embed_footer', {
        track: track.title,
        source: lyricsData.source || '?'
      })
    });

  if (lyricsData.url) {
    embed.setURL(lyricsData.url);
  }

  return embed;
}

function startLyricsSync(player, message, track, lyricsData, t) {
  const existingInterval = player.data.get('lyricsInterval');
  if (existingInterval) {
    clearInterval(existingInterval);
  }

  const timedLines = lyricsData.timedLines;
  let lastIndex = null;
  let consecutiveFailures = 0;

  const interval = setInterval(async () => {
    try {
      const currentTrack = player.queue.current;
      if (!currentTrack || currentTrack.identifier !== track.identifier) {
        clearInterval(interval);
        player.data.delete('lyricsInterval');
        return;
      }

      if (!player.playing && !player.paused) {
        clearInterval(interval);
        player.data.delete('lyricsInterval');
        return;
      }

      const positionMs = getApproxPositionMs(player, track);
      const currentIndex = findLineIndex(timedLines, positionMs);

      if (currentIndex !== null && currentIndex !== lastIndex) {
        const snippet = renderTimedSnippet(timedLines, currentIndex);
        if (snippet) {
          const embed = createLyricsEmbed(track, lyricsData, snippet, t);
          try {
            await message.edit({ embeds: [embed] });
            consecutiveFailures = 0;
          } catch (error) {
            if (error.code === 10008) {
              clearInterval(interval);
              player.data.delete('lyricsInterval');
              return;
            }
            consecutiveFailures++;
            if (consecutiveFailures >= 3) {
              clearInterval(interval);
              player.data.delete('lyricsInterval');
              return;
            }
          }
          lastIndex = currentIndex;
        }
      }
    } catch (error) {
      console.log(`[Lyrics] Sync error: ${error.message}`);
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        clearInterval(interval);
        player.data.delete('lyricsInterval');
      }
    }
  }, 1000);

  player.data.set('lyricsInterval', interval);
}
