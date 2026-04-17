"use strict";

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const SUPPORT_ROLE_1 = "1494277529614159893";
const SUPPORT_ROLE_2 = "1494277209668456539";

const TICKET_TYPES = [
  { id: "report", label: "Report", emoji: "📄", color: 0xed4245, message: "Dear {user MENTION},\n\n*Your username:\nYour rank:\nTheir username:\nRule Violated:\n\nEvidence:*" },
  { id: "appeal", label: "Appeal", emoji: "⚖️", color: 0xfee75c, message: "Dear {user MENTION},\n\nYour username:\nYour rank:\nInfraction:\nAppeal message:" },
  { id: "bug", label: "Bug", emoji: "🐞", color: 0x57f287, message: "Dear {user MENTION},\n\n*Your username:\nYour rank:\nServer Bug:\nHow’s it’s affecting the server:\n\nEvidence (optional):*" }
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const commands = [
    new SlashCommandBuilder().setName("panel").setDescription("Send panel").setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName("close").setDescription("Close ticket")
  ].map(c => c.toJSON());
  
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Bot is live and commands are synced!");
  } catch (e) { console.error(e); }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
    const row = new ActionRowBuilder().addComponents(
      TICKET_TYPES.map(t => new ButtonBuilder().setCustomId(`create_${t.id}`).setLabel(t.label).setEmoji(t.emoji).setStyle(ButtonStyle.Secondary))
    );
    return interaction.reply({ content: "**TICKET CATEGORY:**\nNeed support? Select a ticket here!", components: [row] });
  }

  if (interaction.isButton() && interaction.customId.startsWith("create_")) {
    try {
      // 1. IMMEDIATELY tell Discord we are working (Stops "Interaction Failed")
      await interaction.deferReply({ ephemeral: true });

      const typeId = interaction.customId.split("_")[1];
      const type = TICKET_TYPES.find(t => t.id === typeId);

      // 2. Find "Tickets" category
      const category = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === "tickets");

      // 3. Create the channel
      const ticketChannel = await interaction.guild.channels.create({
        name: `${typeId}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category ? category.id : null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SUPPORT_ROLE_1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SUPPORT_ROLE_2, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      const embed = new EmbedBuilder().setColor(type.color).setDescription(type.message.replace("{user MENTION}", `<@${interaction.user.id}>`));
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [buttons] });
      return interaction.editReply(`✅ Ticket created: ${ticketChannel}`);

    } catch (err) {
      console.error("ERROR CREATING TICKET:", err);
      return interaction.editReply("❌ Failed to create ticket. Make sure the bot has 'Manage Channels' permissions!");
    }
  }

  // Handle Close Button
  if (interaction.isButton() && interaction.customId === "close") {
    await interaction.reply("Ticket closing in 5 seconds...");
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
  
  // Handle Claim Button
  if (interaction.isButton() && interaction.customId === "claim") {
    if (!interaction.member.roles.cache.has(SUPPORT_ROLE_1) && !interaction.member.roles.cache.has(SUPPORT_ROLE_2)) {
      return interaction.reply({ content: "🚨You do not have required authorization to claim this ticket!", ephemeral: true });
    }
    return interaction.reply(`This ticket has been claimed by <@${interaction.user.id}>.`);
  }
});

client.login(TOKEN);
