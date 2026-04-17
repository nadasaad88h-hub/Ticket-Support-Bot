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

// ───────── CONFIGURATION ─────────
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const SUPPORT_ROLE_ID = "1494277529614159893";
const HIGH_COMMAND_ROLE_ID = "1494277209668456539";
const UNBREAKILO_ROLE_NAME = "Unbreakilo";

// ───────── STATE MANAGEMENT ─────────
let ticketCount = 1; 
const closeVotes = new Map(); // channelId -> { support: boolean, owner: boolean }

// ───────── TICKET TYPES ─────────
const TICKET_TYPES = [
  { id: "report", label: "Report Ticket", prefix: "Report_Ticket", color: 0xed4245, message: "## Ticket Category: Report Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nTheir username:\nRule Violated:\n\nEvidence:*" },
  { id: "appeal", label: "Appeal Ticket", prefix: "Appeal_Ticket", color: 0xfee75c, message: "## Ticket Category: Appeal Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nInfraction:\nAppeal message:*" },
  { id: "dept_report", label: "Dept Report", prefix: "Dept_Report", color: 0x3498db, message: "## Ticket Category: Department Report Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nTheir username:\nTheir department:\nRule Violated:\n\nEvidence:*" },
  { id: "dept_appeal", label: "Dept Appeal", prefix: "Dept_Appeal", color: 0x9b59b6, message: "## Ticket Category: Department Appeal Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour department:\ninfraction:\n\nAppeal message:*" },
  { id: "bug", label: "Bug Ticket", prefix: "Bug_Ticket", color: 0x57f287, message: "## Ticket Category: Bug Ticket\nDear {user MENTION},\nTo request for assistance, we kindly request you to follow the format below.\n\n*Your username:\nYour rank:\nServer Bug:\nHow’s it’s affecting the server:\n\nEvidence (optional):*" }
];

// ───────── COMMAND REGISTRATION ─────────
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Send the ticket selection panel"),
  new SlashCommandBuilder().setName("close").setDescription("Request to close the ticket"),
  new SlashCommandBuilder().setName("pending").setDescription("Mark ticket as pending"),
  new SlashCommandBuilder().setName("accepted").setDescription("Mark ticket as accepted"),
  new SlashCommandBuilder().setName("denied").setDescription("Mark ticket as denied"),
  new SlashCommandBuilder().setName("add").setDescription("Add a user to the ticket").addUserOption(o => o.setName("user").setDescription("The user to add").setRequired(true)),
  new SlashCommandBuilder().setName("remove").setDescription("Remove a user from the ticket").addUserOption(o => o.setName("user").setDescription("The user to remove").setRequired(true)),
  new SlashCommandBuilder().setName("move").setDescription("Move the ticket to another category").addChannelOption(o => o.setName("category").setDescription("Target category").setRequired(true).addChannelTypes(ChannelType.GuildCategory)),
].map(c => c.toJSON());

// ───────── HELPERS ─────────
const isSupport = (m) => m.roles.cache.has(SUPPORT_ROLE_ID) || m.roles.cache.has(HIGH_COMMAND_ROLE_ID) || m.permissions.has(PermissionFlagsBits.Administrator);
const isUnbreakilo = (m) => m.roles.cache.some(r => r.name === UNBREAKILO_ROLE_NAME);
const isTicket = (c) => TICKET_TYPES.some(t => c.name.includes(t.prefix));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`✅ System Active: ${client.user.tag}`);
  } catch (e) { console.error(e); }
});

// ───────── INTERACTION HANDLER ─────────
client.on("interactionCreate", async (interaction) => {
  const { member, guild, channel, user, customId, commandName, options } = interaction;

  // --- SLASH COMMANDS ---
  if (interaction.isChatInputCommand()) {
    
    // 1. PANEL (Restricted to Unbreakilo)
    if (commandName === "panel") {
      if (!isUnbreakilo(member)) return interaction.reply({ content: "🚨 Only members with the **Unbreakilo** role can use this command.", ephemeral: true });
      
      const embed = new EmbedBuilder()
        .setDescription("## TICKET CATEGORY:\n\nSeeking for Support? Select the correct ticket here for quick assistance!")
        .setColor(0x2b2d31);

      const row = new ActionRowBuilder().addComponents(
        TICKET_TYPES.map(t => new ButtonBuilder().setCustomId(`create_${t.id}`).setLabel(t.label).setStyle(ButtonStyle.Secondary))
      );
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // Ticket-Specific Logic
    if (["close", "pending", "accepted", "denied", "add", "remove", "move"].includes(commandName)) {
      if (!isTicket(channel)) return interaction.reply({ content: "🚨 This command can only be used inside a ticket channel!", ephemeral: true });

      // Permission Check
      const isOwner = channel.topic === user.id;
      if (!isSupport(member) && !isOwner && !isUnbreakilo(member)) {
        return interaction.reply({ content: "🚨 You do not have permission to manage this ticket.", ephemeral: true });
      }

      // 2. CLOSE (2-Vote logic)
      if (commandName === "close") {
        if (isUnbreakilo(member)) {
          await interaction.reply("🔒 **Unbreakilo** bypass: Closing ticket...");
          return setTimeout(() => channel.delete().catch(() => {}), 3000);
        }

        const embed = new EmbedBuilder()
          .setDescription(`## Close!\n\n***${user} wants to close this ticket!***\n\nGreen button: Confirm      Red button: Deny`)
          .setColor(0xed4245);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("v_confirm").setLabel("Confirm").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("v_deny").setLabel("Deny").setStyle(ButtonStyle.Danger)
        );
        return interaction.reply({ embeds: [embed], components: [row] });
      }

      // 3-5. STATUS COMMANDS
      if (commandName === "pending") return interaction.reply("📌 Ticket is now **PENDING**.");
      if (commandName === "accepted") return interaction.reply("✅ Ticket **ACCEPTED**.");
      if (commandName === "denied") return interaction.reply("❌ Ticket **DENIED**.");

      // 6-7. ADD/REMOVE
      if (commandName === "add" || commandName === "remove") {
        const target = options.getMember("user");
        await channel.permissionOverwrites.edit(target.id, { ViewChannel: commandName === "add" });
        return interaction.reply(`${commandName === "add" ? "Added" : "Removed"} ${target} ${commandName === "add" ? "to" : "from"} the ticket.`);
      }

      // 8. MOVE
      if (commandName === "move") {
        const cat = options.getChannel("category");
        await channel.setParent(cat.id, { lockPermissions: false });
        return interaction.reply(`Moved to **${cat.name}**.`);
      }
    }
  }

  // --- BUTTONS ---
  if (interaction.isButton()) {
    
    // CREATE TICKET
    if (customId.startsWith("create_")) {
      await interaction.deferReply({ ephemeral: true });
      const type = TICKET_TYPES.find(t => t.id === customId.split("_")[1]);
      const cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === "tickets");

      const tChan = await guild.channels.create({
        name: `${type.prefix}-${ticketCount++}`,
        type: ChannelType.GuildText,
        parent: cat ? cat.id : null,
        topic: user.id, // Store owner
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: HIGH_COMMAND_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      const embed = new EmbedBuilder().setColor(type.color).setDescription(type.message.replace("{user MENTION}", `<@${user.id}>`));
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success));
      
      await tChan.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
      return interaction.editReply(`✅ Ticket created: ${tChan}`);
    }

    // CLAIM
    if (customId === "claim") {
      if (!isSupport(member)) return interaction.reply({ content: "🚨You do not have required authorization to claim this ticket!", ephemeral: true });
      return interaction.reply(`This ticket has been claimed by ${user}.`);
    }

    // VOTE SYSTEM
    if (customId === "v_confirm") {
      const isOwner = channel.topic === user.id;
      const isSup = isSupport(member);
      
      let votes = closeVotes.get(channel.id) || { support: false, owner: false };
      if (isSup) votes.support = true;
      if (isOwner) votes.owner = true;
      closeVotes.set(channel.id, votes);

      if (votes.support && votes.owner) {
        await interaction.reply("✅ Both confirmed. Deleting in 5 seconds...");
        return setTimeout(() => channel.delete().catch(() => {}), 5000);
      }
      return interaction.reply({ content: `✅ Vote logged. Need ${!votes.support ? "Support" : "Owner"} to confirm.`, ephemeral: false });
    }

    if (customId === "v_deny") {
      closeVotes.delete(channel.id);
      return interaction.reply(`${user} denied close. Voting reset.`);
    }
  }
});

client.login(TOKEN);
