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

const tickets = new Map(); // channelId -> ticket data
const closeVotes = new Map();
const claimedTickets = new Map();
const userTickets = new Map();

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

// ✅ FINAL FIXED TICKET CHECK (NO MORE BUGS)
function isTicketChannel(channel) {
  if (!channel) return false;

  // 1. PRIMARY SOURCE (MOST RELIABLE)
  if (tickets.has(channel.id)) return true;

  // 2. FALLBACKS (SURVIVES RESTARTS)
  const name = (channel.name || "").toLowerCase();
  const topic = (channel.topic || "").toLowerCase();

  return (
    name.includes("ticket") ||
    name.includes("report") ||
    name.includes("appeal") ||
    name.includes("bug") ||
    name.includes("dept") ||
    topic.includes("ticket")
  );
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

// ================= COMMAND HANDLER =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, channel } = interaction;

  // ================= PANEL =================
  if (commandName === "panel") {
    if (!canUsePanel(member)) {
      return interaction.reply({ content: "No permission.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("TICKET CATEGORY:")
      .setDescription("Need support? Select a ticket here!")
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("report").setLabel("Report").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("appeal").setLabel("Appeal").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("dept_report").setLabel("Dept Report").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("dept_appeal").setLabel("Dept Appeal").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("bug").setLabel("Bug").setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // ================= FIXED TICKET CHECK =================
  if (!isTicketChannel(channel) && commandName !== "panel") {
    return interaction.reply({
      content: "🚨 This command can only be executed inside a ticket!",
      ephemeral: true
    });
  }

  const ticket = tickets.get(channel.id);

  const reply = (msg) =>
    interaction.reply({ content: msg, ephemeral: true });

  // ================= ADD =================
  if (commandName === "add") {
    if (!isSupport(member)) return reply("No permission");

    const user = interaction.options.getUser("user");

    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    return reply(`Added ${user}`);
  }

  // ================= REMOVE =================
  if (commandName === "remove") {
    if (!isSupport(member)) return reply("No permission");

    const user = interaction.options.getUser("user");

    await channel.permissionOverwrites.delete(user.id);

    return reply(`Removed ${user}`);
  }

  // ================= PENDING =================
  if (commandName === "pending") {
    if (!isSupport(member)) return reply("No permission");

    ticket.status = "pending";
    tickets.set(channel.id, ticket);

    await channel.setName(`🟡 Pending ${ticketCount}`);
    return reply("Marked pending");
  }

  // ================= ACCEPT =================
  if (commandName === "accepted") {
    if (!isSupport(member)) return reply("No permission");

    const reason = interaction.options.getString("reason");

    ticket.status = "accepted";
    tickets.set(channel.id, ticket);

    await channel.setName(`🟢 Accepted ${ticketCount}`);
    return reply(`Accepted: ${reason}`);
  }

  // ================= DENY =================
  if (commandName === "denied") {
    if (!isSupport(member)) return reply("No permission");

    const reason = interaction.options.getString("reason");

    ticket.status = "denied";
    tickets.set(channel.id, ticket);

    await channel.setName(`🔴 Denied ${ticketCount}`);
    return reply(`Denied: ${reason}`);
  }

  // ================= MOVE =================
  if (commandName === "move") {
    if (!isSupport(member)) return reply("No permission");

    const type = interaction.options.getString("type");

    ticket.type = type;
    tickets.set(channel.id, ticket);

    await channel.setName(`${type} ${ticketCount}`);

    const msg = await channel.messages.fetch(ticket.messageId).catch(() => null);
    if (msg) await msg.edit(`# This Ticket has been moved to a ${type}`);

    return reply(`Moved to ${type}`);
  }

  // ================= CLOSE =================
  if (commandName === "close") {
    const isOwner = member.id === ticket.ownerId;
    const isStaff = isSupport(member);

    if (!isOwner && !isStaff) return reply("No permission");

    await channel.setName(`🔴 Closing ${ticketCount}`);

    closeVotes.set(channel.id, { yes: new Set(), no: new Set() });

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("Close!")
      .setDescription(`***${member} wants to close this ticket!***`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_yes").setLabel("Confirm").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close_no").setLabel("Deny").setStyle(ButtonStyle.Danger)
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

  // ================= CREATE =================
  if (types[interaction.customId]) {
    const type = types[interaction.customId];
    const userId = member.id;

    if (!userTickets.has(userId)) userTickets.set(userId, {});
    const existing = userTickets.get(userId);

    if (existing[type]) {
      return interaction.reply({
        content: `🚫 You already have an open **${type}** ticket!`,
        ephemeral: true
      });
    }

    ticketCount++;

    const channelCreated = await guild.channels.create({
      name: `${type} ${ticketCount}`,
      topic: "ticket",
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

    const msg = await channelCreated.send({
      content: `## Ticket Category: ${type}\nDear ${member},\n\nPlease follow format...`
    });

    tickets.set(channelCreated.id, {
      ownerId: member.id,
      type,
      messageId: msg.id,
      status: "open"
    });

    existing[type] = channelCreated.id;
    userTickets.set(userId, existing);

    return interaction.reply({
      content: `Ticket created: ${channelCreated}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);
