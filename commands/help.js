const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { getTranslator } = require('../utils/localeHelpers');
const fs = require('node:fs');
const path = require('node:path');

// Count commands dynamically
function countCommandsInCategory(category) {
  const categoryPath = path.join(__dirname, category);
  if (!fs.existsSync(categoryPath)) return 0;
  const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
  return files.length;
}

// Count all commands
function countTotalCommands() {
  let total = 0;
  // Root commands
  const rootFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js') && file !== 'help.js');
  total += rootFiles.length;
  
  // Music commands
  total += countCommandsInCategory('music');
  
  // Config commands
  total += countCommandsInCategory('config');
  
  return total;
}

// Count supported languages
function countSupportedLanguages() {
  const localesPath = path.join(__dirname, '..', 'locales');
  if (!fs.existsSync(localesPath)) return 0;
  return fs.readdirSync(localesPath).filter(file => file.endsWith('.json')).length;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands and how to use them'),

  async execute(interaction, client) {
    const t = await getTranslator(client, interaction.guildId);
    
    // Get dynamic counts
    const musicCount = countCommandsInCategory('music');
    const totalCommands = countTotalCommands();
    const languageCount = countSupportedLanguages();
    
    const mainEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t('commands.help.main.title'))
      .setDescription(t('commands.help.main.description'))
      .addFields(
        {
          name: `🎵 ${t('commands.help.categories.music')}`,
          value: t('commands.help.categories.music_description'),
          inline: true
        },
        {
          name: `⚙️ ${t('commands.help.categories.config')}`,
          value: t('commands.help.categories.config_description'),
          inline: true
        },
        {
          name: `🛠️ ${t('commands.help.categories.utilities')}`,
          value: t('commands.help.categories.utilities_description'),
          inline: true
        }
      )
      .setFooter({ 
        text: t('commands.help.main.footer'),
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder(t('commands.help.dropdown.placeholder'))
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(t('commands.help.categories.music'))
          .setDescription(t('commands.help.categories.music_short', { count: musicCount }))
          .setValue('music')
          .setEmoji('🎵'),
        new StringSelectMenuOptionBuilder()
          .setLabel(t('commands.help.categories.config'))
          .setDescription(t('commands.help.categories.config_short'))
          .setValue('config')
          .setEmoji('⚙️'),
        new StringSelectMenuOptionBuilder()
          .setLabel(t('commands.help.categories.utilities'))
          .setDescription(t('commands.help.categories.utilities_short'))
          .setValue('utilities')
          .setEmoji('🛠️'),
        new StringSelectMenuOptionBuilder()
          .setLabel(t('commands.help.categories.admin'))
          .setDescription(t('commands.help.categories.admin_short'))
          .setValue('admin')
          .setEmoji('🔐'),
        new StringSelectMenuOptionBuilder()
          .setLabel(t('commands.help.categories.home'))
          .setDescription(t('commands.help.categories.home_short'))
          .setValue('home')
          .setEmoji('🏠')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.reply({
      embeds: [mainEmbed],
      components: [row],
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async i => {
      const selectedCategory = i.values[0];
      
      let categoryEmbed;
      
      switch (selectedCategory) {
        case 'home':
          categoryEmbed = mainEmbed;
          break;
        
        case 'music':
          categoryEmbed = createMusicEmbed(t, client, musicCount);
          break;
        
        case 'config':
          categoryEmbed = createConfigEmbed(t, client, languageCount);
          break;
        
        case 'utilities':
          categoryEmbed = createUtilitiesEmbed(t, client);
          break;
        
        case 'admin':
          categoryEmbed = createAdminEmbed(t, client);
          break;
      }

      await i.update({ embeds: [categoryEmbed], components: [row] });
    });

    collector.on('end', async () => {
      try {
        const disabledRow = new ActionRowBuilder().addComponents(
          StringSelectMenuBuilder.from(selectMenu).setDisabled(true)
        );
        await response.edit({ components: [disabledRow] });
      } catch (error) {
        // Message might be deleted
      }
    });
  }
};

function createMusicEmbed(t, client, musicCount) {
  const embed = new EmbedBuilder()
    .setColor(0xff0066)
    .setTitle(`🎵 ${t('commands.help.categories.music')}`)
    .setDescription(t('commands.help.music.description', { count: musicCount }))
    .addFields(
      {
        name: '</play:0>',
        value: t('commands.help.music.play'),
        inline: false
      },
      {
        name: '</pause:0>',
        value: t('commands.help.music.pause'),
        inline: true
      },
      {
        name: '</resume:0>',
        value: t('commands.help.music.resume'),
        inline: true
      },
      {
        name: '</skip:0>',
        value: t('commands.help.music.skip'),
        inline: true
      },
      {
        name: '</stop:0>',
        value: t('commands.help.music.stop'),
        inline: true
      },
      {
        name: '</queue:0>',
        value: t('commands.help.music.queue'),
        inline: true
      },
      {
        name: '</shuffle:0>',
        value: t('commands.help.music.shuffle'),
        inline: true
      },
      {
        name: '</skipto:0>',
        value: t('commands.help.music.skipto'),
        inline: true
      },
      {
        name: '</seek:0>',
        value: t('commands.help.music.seek'),
        inline: true
      },
      {
        name: '</lyrics:0>',
        value: t('commands.help.music.lyrics'),
        inline: true
      },
      {
        name: '</filters:0>',
        value: t('commands.help.music.filters'),
        inline: false
      }
    )
    .setFooter({ 
      text: t('commands.help.footer'),
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  return embed;
}

function createConfigEmbed(t, client, languageCount) {
  const embed = new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle(`⚙️ ${t('commands.help.categories.config')}`)
    .setDescription(t('commands.help.config.description'))
    .addFields(
      {
        name: '</language:0>',
        value: t('commands.help.config.language', { count: languageCount }),
        inline: false
      }
    )
    .setFooter({ 
      text: t('commands.help.footer'),
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  return embed;
}

function createUtilitiesEmbed(t, client) {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(`🛠️ ${t('commands.help.categories.utilities')}`)
    .setDescription(t('commands.help.utilities.description'))
    .addFields(
      {
        name: '</ping:0>',
        value: t('commands.help.utilities.ping'),
        inline: false
      }
    )
    .setFooter({ 
      text: t('commands.help.footer'),
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  return embed;
}

function createAdminEmbed(t, client) {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`🔐 ${t('commands.help.categories.admin')}`)
    .setDescription(t('commands.help.admin.description'))
    .addFields(
      {
        name: '</admin:0>',
        value: t('commands.help.admin.admin'),
        inline: false
      }
    )
    .setFooter({ 
      text: t('commands.help.footer'),
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  return embed;
}
