const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ================= ROLES =================
const SUPPORT_ROLES = [
  "1494277529614159893",
  "1494277209668456539"
];

const PANEL_ROLE = "Unbreakilo";

// ================= STATE =================
let ticketCount = 0;

const tickets = new Map(); // channelId -> { ownerId, type, messageId }
const closeVotes = new Map(); // channelId -> { yes:Set, no:Set }
const claimedTickets = new Map(); // channelId -> userId

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= HELPERS =================
function isSupport(member) {
  return member.roles.cache.some(r => SUPPORT_ROLES.includes(r.id));
}

function canUsePanel(member) {
  return member.roles.cache.some(r => r.name === PANEL_ROLE);
}

function isTicketChannel(channelId) {
  return tickets.has(channelId);
}

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("panel").setDescription("Send ticket panel"),
    new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

    new SlashCommandBuilder()
      .setName("add")
      .setDescription("Add user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

    new SlashCommandBuilder()
      .setName("remove")
      .setDescription("Remove user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

    new SlashCommandBuilder().setName("pending").setDescription("Mark pending"),

    new SlashCommandBuilder()
      .setName("accepted")
      .setDescription("Accept ticket")
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("denied")
      .setDescription("Deny ticket")
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("move")
      .setDescription("Move ticket")
      .addStringOption(o =>
        o.setName("type")
          .setDescription("Ticket type")
          .setRequired(true)
          .addChoices(
            { name: "Report Ticket", value: "Report Ticket" },
            { name: "Appeal Ticket", value: "Appeal Ticket" },
            { name: "Department Report Ticket", value: "Department Report Ticket" },
            { name: "Department Appeal Ticket", value: "Department Appeal Ticket" },
            { name: "Bug Ticket", value: "Bug Ticket" }
          )
      )
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands
  });

  console.log("Commands registered");
});

// ================= COMMANDS =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, channel } = interaction;

  // ================= PANEL =================
  if (commandName === "panel") {
    if (!canUsePanel(member)) {
      return interaction.reply({ content: "No permission.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("**TICKET CATEGORY:**")
      .setDescription("Need support? Select a ticket here!")
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("report").setLabel("📄 Report").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("appeal").setLabel("⚖️ Appeal").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("dept_report").setLabel("🏢 Dept Report").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("dept_appeal").setLabel("📂 Dept Appeal").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("bug").setLabel("🐞 Bug").setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // ================= TICKET CHECK =================
  if (!isTicketChannel(channel.id) && commandName !== "panel") {
    return interaction.reply({
      content: "🚨 This command can only be executed inside a ticket!",
      ephemeral: true
    });
  }

  const ticket = tickets.get(channel.id);

  const staffReply = (msg) =>
    interaction.reply({ content: msg, ephemeral: true });

  // ================= STAFF COMMANDS =================
  if (commandName === "add") {
    if (!isSupport(member)) return staffReply("No permission");

    const user = interaction.options.getUser("user");

    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    return staffReply(`Added ${user}`);
  }

  if (commandName === "remove") {
    if (!isSupport(member)) return staffReply("No permission");

    const user = interaction.options.getUser("user");

    await channel.permissionOverwrites.delete(user.id);

    return staffReply(`Removed ${user}`);
  }

  if (commandName === "pending") {
    if (!isSupport(member)) return staffReply("No permission");

    await channel.setName(`🟡 Pending ${ticketCount}`);
    return staffReply("Marked pending");
  }

  if (commandName === "accepted") {
    if (!isSupport(member)) return staffReply("No permission");

    const reason = interaction.options.getString("reason");

    await channel.setName(`🟢 Accepted ${ticketCount}`);

    return staffReply(`Accepted: ${reason}`);
  }

  if (commandName === "denied") {
    if (!isSupport(member)) return staffReply("No permission");

    const reason = interaction.options.getString("reason");

    await channel.setName(`🔴 Denied ${ticketCount}`);

    return staffReply(`Denied: ${reason}`);
  }

  // ================= MOVE =================
  if (commandName === "move") {
    if (!isSupport(member)) return staffReply("No permission");

    const type = interaction.options.getString("type");

    await channel.setName(`${type} ${ticketCount}`);

    const ticketData = tickets.get(channel.id);

    if (ticketData) {
      const msg = await channel.messages.fetch(ticketData.messageId).catch(() => null);
      if (msg) await msg.edit(`# This Ticket has been moved to a ${type}`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("Ticket Moved")
      .setDescription(`This ticket has been moved to a **${type}**`);

    await channel.send({ embeds: [embed] });

    return staffReply(`Moved to ${type}`);
  }

  // ================= CLOSE =================
  if (commandName === "close") {
    const isOwner = member.id === ticket.ownerId;
    const isStaff = isSupport(member);

    if (!isOwner && !isStaff) return staffReply("No permission");

    await channel.setName(`🔴 Closing ${ticketCount}`);

    closeVotes.set(channel.id, { yes: new Set(), no: new Set() });

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("## Close!")
      .setDescription(`***${member} wants to close this ticket!***`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_yes")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("close_no")
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
});

// ================= BUTTONS =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const { guild, member, channel } = interaction;

  const types = {
    report: "Report Ticket",
    appeal: "Appeal Ticket",
    dept_report: "Department Report Ticket",
    dept_appeal: "Department Appeal Ticket",
    bug: "Bug Ticket"
  };

  // ================= CREATE TICKET =================
  if (types[interaction.customId]) {
    ticketCount++;

    const type = types[interaction.customId];

    const channelCreated = await guild.channels.create({
      name: `${type} ${ticketCount}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: member.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    });

    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Success)
    );

    const msg = await channelCreated.send({
      content:
`## Ticket Category: ${type}
Dear ${member},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Their username:
Rule Violated:

Evidence:*`,
      components: [claimRow]
    });

    await msg.pin().catch(() => {});

    tickets.set(channelCreated.id, {
      ownerId: member.id,
      type,
      messageId: msg.id
    });

    return interaction.reply({
      content: `Ticket created: ${channelCreated}`,
      ephemeral: true
    });
  }

  // ================= CLAIM =================
  if (interaction.customId === "claim_ticket") {
    const allowed = member.roles.cache.some(r => SUPPORT_ROLES.includes(r.id));

    if (!allowed) {
      return member.send("🚨You do not have required authorization to claim this ticket!");
    }

    if (claimedTickets.has(channel.id)) {
      return interaction.reply({ content: "Already claimed.", ephemeral: true });
    }

    claimedTickets.set(channel.id, member.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claimed")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );

    await interaction.update({ components: [row] });

    // ✅ FINAL CLAIM EMBED
    const claimEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`This ticket has been claimed by ${member}.`);

    await channel.send({ embeds: [claimEmbed] });
  }

  // ================= CLOSE VOTES =================
  const ticket = tickets.get(channel.id);
  if (!ticket) return;

  if (!closeVotes.has(channel.id)) return;

  const vote = closeVotes.get(channel.id);

  const isOwner = member.id === ticket.ownerId;
  const isStaff = isSupport(member);

  if (!isOwner && !isStaff) return;

  if (interaction.customId === "close_yes") {
    vote.yes.add(member.id);
    vote.no.delete(member.id);
  }

  if (interaction.customId === "close_no") {
    vote.no.add(member.id);
    vote.yes.delete(member.id);

    return interaction.reply({
      content: `${member} ***has denied to close this ticket.***`
    });
  }

  if (vote.yes.size >= 2) {
    tickets.delete(channel.id);
    closeVotes.delete(channel.id);
    return channel.delete();
  }

  return interaction.reply({
    content: "Vote registered.",
    ephemeral: true
  });
});

client.login(TOKEN);
