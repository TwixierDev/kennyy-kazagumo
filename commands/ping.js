const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const net = require('node:net');
const { performance } = require('node:perf_hooks');
const { getTranslator } = require('../utils/localeHelpers');

const MAX_NODES = 10;
const LAVALINK_ENDPOINTS = ['/v4/info', '/version'];

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Measure latency for Discord, Lavalink, and Cloudflare'),
  async execute(interaction, client) {
    const t = await getTranslator(client, interaction.guildId);
    await interaction.deferReply();

    const discordMs = Math.max(0, Math.round(client.ws.ping));

    const lavalinkPromise = lavalinkHttpPing(readLavalinkConfigs(), t);
    const cloudflarePromise = tcpPing('1.1.1.1', 443, 4000);

    const [lavalinkResults, cloudflareMs] = await Promise.all([lavalinkPromise, cloudflarePromise]);

    const embed = new EmbedBuilder()
      .setTitle(t('commands.ping.embed.title'))
      .setColor(0x5865f2)
      .addFields({
        name: t('commands.ping.fields.discord.name'),
        value: t('commands.ping.fields.discord.value', {
          emoji: statusEmoji(discordMs),
          latency: discordMs
        }),
        inline: false
      });

    if (lavalinkResults.length) {
      for (const result of lavalinkResults) {
        const { config, latency, endpoint } = result;
        const displayName = config.name || config.identifier || 'node';
        embed.addFields({
          name: t('commands.ping.fields.lavalink.display_name', { name: displayName }),
          value: t('commands.ping.fields.lavalink.value', {
            emoji: statusEmoji(latency),
            latency: latency ?? 'N/A',
            endpoint: endpoint || 'N/A'
          }),
          inline: false
        });
      }
    } else {
      embed.addFields({
        name: t('commands.ping.fields.lavalink_empty.name'),
        value: t('commands.ping.fields.lavalink_empty.value', { emoji: statusEmoji(null) }),
        inline: false
      });
    }

    embed.addFields({
      name: t('commands.ping.fields.cloudflare.name'),
      value: t('commands.ping.fields.cloudflare.value', {
        emoji: statusEmoji(cloudflareMs),
        latency: cloudflareMs ?? 'N/A'
      }),
      inline: false
    });

    embed.setFooter({ text: t('commands.ping.embed.footer') });

    await interaction.editReply({ embeds: [embed] });
  }
};

function statusEmoji(ms) {
  if (ms === null || ms === undefined) return '⚪';
  if (ms <= 100) return '🟢';
  if (ms <= 200) return '🟡';
  return '🔴';
}

function readLavalinkConfigs() {
  const configs = [];

  for (let idx = 1; idx <= MAX_NODES; idx += 1) {
    const host = (process.env[`LAVALINK_NODE${idx}_HOST`] || '').trim();
    if (!host) continue;

    const name = (process.env[`LAVALINK_NODE${idx}_NAME`] || `node${idx}`).trim();
    const port = (process.env[`LAVALINK_NODE${idx}_PORT`] || '2333').trim();
    const password = process.env[`LAVALINK_NODE${idx}_PASSWORD`] || 'youshallnotpass';
    const secure = String(process.env[`LAVALINK_NODE${idx}_SECURE`] || 'false').toLowerCase() === 'true';
    const scheme = secure ? 'https' : 'http';
    configs.push({
      identifier: `node${idx}`,
      name,
      secure,
      host,
      port,
      password,
      scheme,
      base: `${scheme}://${host}:${port}`
    });
  }

  if (!configs.length) {
    const host = (process.env.LAVALINK_HOST || '').trim();
    if (host) {
      const name = (process.env.LAVALINK_NODE_NAME || 'node1').trim();
      const port = (process.env.LAVALINK_PORT || '2333').trim();
      const password = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
      const secure = String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true';
      const scheme = secure ? 'https' : 'http';
      configs.push({
        identifier: 'node1',
        name,
        secure,
        host,
        port,
        password,
        scheme,
        base: `${scheme}://${host}:${port}`
      });
    }
  }

  return configs;
}

async function lavalinkHttpPing(configs, t) {
  if (!configs.length) return [];

  const results = [];
  for (const cfg of configs) {
    let latency = null;
    let endpointUsed = 'N/A';

    for (const endpoint of LAVALINK_ENDPOINTS) {
      const url = cfg.base + endpoint;
      const start = performance.now();
      try {
        const resp = await fetch(url, {
          method: 'GET',
          headers: { Authorization: cfg.password },
          signal: AbortSignal.timeout(4000)
        });
        if (resp.status < 500) {
          latency = Math.round(performance.now() - start);
          endpointUsed = endpoint;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    results.push({ config: cfg, latency, endpoint: endpointUsed });
  }

  return results;
}

function tcpPing(host, port, timeoutMs = 3000) {
  return new Promise(resolve => {
    const start = performance.now();
    let settled = false;

    const done = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };

    const socket = net.createConnection({ host, port });
    socket.once('connect', () => done(Math.round(performance.now() - start)));
    socket.once('error', () => done(null));

    const timer = setTimeout(() => done(null), timeoutMs);
  });
}
