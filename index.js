"use strict";

const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits, ChannelType, Collection
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const SUPPORT_ROLE_ID = "1494277529614159893";
const HIGH_COMMAND_ROLE_ID = "1494277209668456539";
const UNBREAKILO_ROLE_NAME = "Unbreakilo";

// ───────── INTERNAL MEMORY (Bypasses Discord Lag) ─────────
const ticketMemory = new Collection(); 
// Stores: { channelId: { ownerId, type, count, claimedBy, status } }
const closeVotes = new Map();
let ticketCount = 1;

const TICKET_TYPES = [
  { id: "report", label: "Report Ticket", prefix: "Report_Ticket", color: 0xed4245, message: "## Ticket Category: Report Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nTheir username:\nRule Violated:\n\nEvidence:*" },
  { id: "appeal", label: "Appeal Ticket", prefix: "Appeal_Ticket", color: 0xfee75c, message: "## Ticket Category: Appeal Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nInfraction:\nAppeal message:*" },
  { id: "dept_report", label: "Department Report Ticket", prefix: "Dept_Report", color: 0x3498db, message: "## Ticket Category: Department Report Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nTheir username:\nTheir department:\nRule Violated:\n\nEvidence:*" },
  { id: "dept_appeal", label: "Department Appeal Ticket", prefix: "Dept_Appeal", color: 0x9b59b6, message: "## Ticket Category: Department Appeal Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour department:\ninfraction:\n\nAppeal message:*" },
  { id: "bug", label: "Bug Ticket", prefix: "Bug_Ticket", color: 0x57f287, message: "## Ticket Category: Bug Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nServer Bug:\nHow’s it’s affecting the server:\n\nEvidence (optional):*" }
];

const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Send the ticket selection panel"),
  new SlashCommandBuilder().setName("close").setDescription("Request to close the ticket"),
  new SlashCommandBuilder().setName("pending").setDescription("Mark ticket as pending"),
  new SlashCommandBuilder().setName("accepted").setDescription("Mark ticket as accepted"),
  new SlashCommandBuilder().setName("denied").setDescription("Mark ticket as denied"),
  new SlashCommandBuilder().setName("add").setDescription("Add a user").addUserOption(o => o.setName("user").setDescription("The user to add").setRequired(true)),
  new SlashCommandBuilder().setName("remove").setDescription("Remove a user").addUserOption(o => o.setName("user").setDescription("The user to remove").setRequired(true)),
  new SlashCommandBuilder().setName("move").setDescription("Change ticket type")
    .addStringOption(o => o.setName("type").setDescription("Select new ticket category").setRequired(true)
    .addChoices(...TICKET_TYPES.map(t => ({ name: t.label, value: t.id })))),
].map(c => c.toJSON());

const isSupport = (m) => m.roles.cache.has(SUPPORT_ROLE_ID) || m.roles.cache.has(HIGH_COMMAND_ROLE_ID) || m.permissions.has(PermissionFlagsBits.Administrator);
const isUnbreakilo = (m) => m.roles.cache.some(r => r.name === UNBREAKILO_ROLE_NAME);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try { await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands }); console.log(`✅ System Live: ${client.user.tag}`); } catch (e) { console.error(e); }
});

client.on("interactionCreate", async (interaction) => {
  const { member, guild, channel, user, customId, commandName, options } = interaction;

  if (interaction.isChatInputCommand()) {
    if (commandName === "panel") {
      if (!isUnbreakilo(member)) return interaction.reply({ content: "🚨 Only **Unbreakilo** can use this.", ephemeral: true });
      const embed = new EmbedBuilder().setDescription("## TICKET CATEGORY:\n\nSeeking for Support? Select the correct ticket here for quick assistance!").setColor(0x2b2d31);
      const row = new ActionRowBuilder().addComponents(TICKET_TYPES.map(t => new ButtonBuilder().setCustomId(`create_${t.id}`).setLabel(t.label).setStyle(ButtonStyle.Secondary)));
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    const data = ticketMemory.get(channel.id);
    if (!data) return interaction.reply({ content: "🚨 This channel is not a registered ticket or the bot has restarted.", ephemeral: true });

    const isOwner = user.id === data.ownerId;
    const isStaff = isSupport(member) || isUnbreakilo(member);

    if (commandName !== "close" && !data.claimedBy) return interaction.reply({ content: "🚨 This ticket must be **Claimed** before using commands.", ephemeral: true });
    if (["pending", "accepted", "denied", "move", "add", "remove"].includes(commandName) && !isStaff) return interaction.reply({ content: "🚨 Staff only command.", ephemeral: true });

    // --- COMMANDS ---

    if (commandName === "close") {
      if (!isStaff && !isOwner) return interaction.reply({ content: "🚨 No permission.", ephemeral: true });
      if (isUnbreakilo(member)) { ticketMemory.delete(channel.id); return channel.delete(); }
      const embed = new EmbedBuilder().setDescription(`## Close!\n***${user} wants to close!***\n\nGreen: Confirm | Red: Deny`).setColor(0xed4245);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("v_confirm").setLabel("Confirm").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("v_deny").setLabel("Deny").setStyle(ButtonStyle.Danger)
      );
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === "move") {
        if (data.status) return interaction.reply({ content: "🚨 Cannot move ticket once a status is set.", ephemeral: true });
        const newType = TICKET_TYPES.find(t => t.id === options.getString("type"));
        data.type = newType.prefix;
        await channel.setName(`${newType.prefix}-${data.count}`);
        return interaction.reply({ content: `✅ Ticket converted to **${newType.label}**.`, ephemeral: true });
    }

    if (commandName === "pending") {
        data.status = "PENDING";
        await channel.setName(`🟡 Pending_${data.type}-${data.count}`);
        return interaction.reply({ content: "✅ Ticket marked as **Pending**.", ephemeral: true });
    }

    if (commandName === "accepted" || commandName === "denied") {
        if (data.status !== "PENDING") return interaction.reply({ content: "🚨 You must use `/pending` first.", ephemeral: true });
        const label = commandName === "accepted" ? "Accepted" : "Denied";
        const emoji = commandName === "accepted" ? "🟢" : "🔴";
        data.status = label.toUpperCase();
        await channel.setName(`${emoji} ${label}_${data.type}-${data.count}`);
        return interaction.reply({ content: `✅ Ticket has been **${label}**.`, ephemeral: true });
    }

    if (commandName === "add" || commandName === "remove") {
        const target = options.getMember("user");
        await channel.permissionOverwrites.edit(target.id, { ViewChannel: commandName === "add" });
        return interaction.reply({ content: `User ${commandName === "add" ? "added" : "removed"}.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (customId.startsWith("create_")) {
      await interaction.deferReply({ ephemeral: true });
      const type = TICKET_TYPES.find(t => t.id === customId.split("_")[1]);
      const cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && (c.name.toLowerCase() === "tickets" || c.name.toLowerCase() === "support"));

      const tChan = await guild.channels.create({
        name: `${type.prefix}-${ticketCount}`,
        parent: cat ? cat.id : null,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: HIGH_COMMAND_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      ticketMemory.set(tChan.id, { ownerId: user.id, type: type.prefix, count: ticketCount, claimedBy: null, status: null });
      ticketCount++;

      const embed = new EmbedBuilder().setColor(type.color).setDescription(type.message.replace("{user MENTION}", `<@${user.id}>`));
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success));
      await tChan.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
      return interaction.editReply(`✅ Ticket created: ${tChan}`);
    }

    if (customId === "claim") {
      if (!isSupport(member)) return interaction.reply({ content: "🚨You do not have required authorization to claim this ticket!", ephemeral: true });
      const data = ticketMemory.get(channel.id);
      if (data) data.claimedBy = user.id;

      const disabledRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cl").setLabel("Claimed").setStyle(ButtonStyle.Success).setDisabled(true));
      await interaction.message.edit({ components: [disabledRow] });
      return interaction.reply(`Claimed by ${user}.`);
    }

    if (customId === "v_confirm") {
        const data = ticketMemory.get(channel.id);
        let votes = closeVotes.get(channel.id) || { s: false, o: false };
        if (isSupport(member)) votes.s = true;
        if (data && user.id === data.ownerId) votes.o = true;
        closeVotes.set(channel.id, votes);
        if (votes.s && votes.o) { ticketMemory.delete(channel.id); return channel.delete(); }
        return interaction.reply(`Vote logged. Need ${!votes.s ? "Staff" : "Owner"}.`);
    }
    if (customId === "v_deny") { closeVotes.delete(channel.id); return interaction.reply("Close request denied."); }
  }
});

client.login(TOKEN);
