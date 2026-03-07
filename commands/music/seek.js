const { SlashCommandBuilder } = require('discord.js');
const { getTranslator } = require('../../utils/localeHelpers');

const TIME_TOKEN_REGEX = /(\d+(?:\.\d+)?)(ms|s|m|h)?/gi;
const FLEXIBLE_PATTERN = /^\s*(\d+(?:\.\d+)?(ms|s|m|h)?\s*)+$/i;
const COLON_PATTERN = /^\d+(?::\d+){1,2}$/;
const UNIT_TO_MS = Object.freeze({
  h: 3_600_000,
  m: 60_000,
  s: 1_000,
  ms: 1
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Jump to a specific position in the current track')
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Example: 90s, 1m20s, 01:20, 2h5m')
        .setRequired(true)
    ),
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

    const track = player.queue?.current;
    if (!track) {
      return interaction.reply({ content: t('seek.no_track'), ephemeral: true });
    }

    const input = interaction.options.getString('time', true);
    const parsedMs = parseFlexibleTimestamp(input);

    if (parsedMs === null || parsedMs < 0) {
      return interaction.reply({ content: t('commands.seek.invalid'), ephemeral: true });
    }

    const trackDuration = getTrackDuration(track);
    const maxSeek = Math.max(0, trackDuration - 1_000);
    const targetPosition = clamp(parsedMs, 0, trackDuration ? maxSeek : parsedMs);

    try {
      await player.seek(targetPosition);
      return interaction.reply({
        content: t('commands.seek.success', { time: formatDuration(targetPosition) }),
        ephemeral: true
      });
    } catch (error) {
      client.emit('error', error);
      return interaction.reply({ content: t('commands.seek.error'), ephemeral: true });
    }
  }
};

function parseFlexibleTimestamp(rawInput) {
  if (!rawInput) return null;
  const value = rawInput.trim().toLowerCase();
  if (!value) return null;

  if (COLON_PATTERN.test(value)) {
    return parseColonTimestamp(value);
  }

  if (!FLEXIBLE_PATTERN.test(value)) {
    return null;
  }

  let total = 0;
  const tokens = Array.from(value.matchAll(TIME_TOKEN_REGEX));
  if (!tokens.length) {
    return null;
  }

  for (const token of tokens) {
    const amount = Number.parseFloat(token[1]);
    const unit = token[2] ?? 's';
    const multiplier = UNIT_TO_MS[unit];
    if (!Number.isFinite(amount) || !multiplier) {
      return null;
    }
    total += amount * multiplier;
  }

  return Math.round(total);
}

function parseColonTimestamp(input) {
  const segments = input.split(':').map(segment => Number.parseInt(segment, 10));
  if (!segments.every(Number.isFinite)) {
    return null;
  }

  while (segments.length < 3) {
    segments.unshift(0);
  }

  const [hours, minutes, seconds] = segments;
  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return Math.max(0, hours * UNIT_TO_MS.h + minutes * UNIT_TO_MS.m + seconds * UNIT_TO_MS.s);
}

function getTrackDuration(track) {
  const duration = track?.duration ?? track?.length ?? track?.info?.length ?? 0;
  return Number.isFinite(duration) ? duration : 0;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const minuteBlock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours ? `${String(hours).padStart(2, '0')}:${minuteBlock}` : minuteBlock;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (!Number.isFinite(max)) return Math.max(min, value);
  return Math.max(min, Math.min(max, value));
}
