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
const userTickets = new Map(); // user -> type tracking
const closeVotes = new Map();

// ================= HELPERS =================
function isSupport(member) {
  return member.roles.cache.some(r => SUPPORT_ROLES.includes(r.id));
}

function canUsePanel(member) {
  return member.roles.cache.some(r => r.name === PANEL_ROLE);
}

function isTicket(channel) {
  return tickets.has(channel.id);
}

// ================= YOUR EXACT MESSAGES (UNCHANGED) =================
const TICKET_MESSAGES = {
  "Report Ticket": `## Ticket Category: Report Ticket
Dear {user, MENTION},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Their username:
Rule Violated:

Evidence:*`,

  "Appeal Ticket": `## Ticket Category: Appeal Ticket
Dear {user, MENTION},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Infraction:
Appeal message:*`,

  "Department Report Ticket": `## Ticket Category: Department Report Ticket
Dear {user, MENTION},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Their username:
Their department:
Rule Violated:

Evidence:*`,

  "Department Appeal Ticket": `## Ticket Category: Department Appeal Ticket
Dear {user, MENTION},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your department:
infraction:

Appeal message:*`,

  "Bug Ticket": `## Ticket Category: Bug Ticket
Dear {user, MENTION},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Server Bug:
How’s it’s affecting the server:

Evidence (optional):*`
};

// ================= READY =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("panel").setDescription("Send ticket panel"),

    new SlashCommandBuilder().setName("add")
      .setDescription("Add user to ticket")
      .addUserOption(o => o.setName("user").setRequired(true)),

    new SlashCommandBuilder().setName("remove")
      .setDescription("Remove user from ticket")
      .addUserOption(o => o.setName("user").setRequired(true)),

    new SlashCommandBuilder().setName("pending"),
    
    new SlashCommandBuilder().setName("accepted")
      .addStringOption(o => o.setName("reason").setRequired(true)),

    new SlashCommandBuilder().setName("denied")
      .addStringOption(o => o.setName("reason").setRequired(true)),

    new SlashCommandBuilder().setName("move")
      .addStringOption(o =>
        o.setName("type")
          .setRequired(true)
          .addChoices(
            { name: "Report Ticket", value: "Report Ticket" },
            { name: "Appeal Ticket", value: "Appeal Ticket" },
            { name: "Department Report", value: "Department Report Ticket" },
            { name: "Department Appeal", value: "Department Appeal Ticket" },
            { name: "Bug Ticket", value: "Bug Ticket" }
          )
      ),

    new SlashCommandBuilder().setName("close")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });

  console.log("Commands registered");
});

// ================= COMMANDS =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, channel } = interaction;

  if (commandName === "panel") {
    if (!canUsePanel(member))
      return interaction.reply({ content: "No permission", ephemeral: true });

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

  if (!isTicket(channel)) {
    return interaction.reply({
      content: "🚨 This command can only be executed inside a ticket!",
      ephemeral: true
    });
  }

  const ticket = tickets.get(channel.id);

  const safeReply = (msg) =>
    interaction.reply({ content: msg, ephemeral: true });

  // ADD
  if (commandName === "add") {
    if (!isSupport(member)) return safeReply("No permission");

    const user = interaction.options.getUser("user");
    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    return safeReply("User added");
  }

  // REMOVE
  if (commandName === "remove") {
    if (!isSupport(member)) return safeReply("No permission");

    const user = interaction.options.getUser("user");
    await channel.permissionOverwrites.delete(user.id);

    return safeReply("User removed");
  }

  // PENDING
  if (commandName === "pending") {
    if (!isSupport(member)) return safeReply("No permission");
    await channel.setName(`🟡 Pending ${ticketCount}`);
    return safeReply("Marked pending");
  }

  // ACCEPT
  if (commandName === "accepted") {
    if (!isSupport(member)) return safeReply("No permission");

    const reason = interaction.options.getString("reason");
    await channel.setName(`🟢 Accepted ${ticketCount}`);

    return interaction.reply({
      content: `Accepted: ${reason}`,
      ephemeral: false
    });
  }

  // DENY
  if (commandName === "denied") {
    if (!isSupport(member)) return safeReply("No permission");

    const reason = interaction.options.getString("reason");
    await channel.setName(`🔴 Denied ${ticketCount}`);

    return interaction.reply({
      content: `Denied: ${reason}`,
      ephemeral: false
    });
  }

  // MOVE
  if (commandName === "move") {
    if (!isSupport(member)) return safeReply("No permission");

    const type = interaction.options.getString("type");

    await channel.setName(`${type} ${ticketCount}`);

    const msg = await channel.messages.fetch(ticket.messageId).catch(() => null);
    if (msg) await msg.edit(`# This Ticket has been moved to a ${type}`);

    return safeReply(`Moved to ${type}`);
  }

  // CLOSE (simple stable version)
  if (commandName === "close") {
    const isOwner = member.id === ticket.ownerId;
    const isStaff = isSupport(member);

    if (!isOwner && !isStaff)
      return safeReply("No permission");

    await channel.delete();
  }
});

// ================= BUTTON SYSTEM =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const { member, channel, guild } = interaction;

  const types = {
    report: "Report Ticket",
    appeal: "Appeal Ticket",
    dept_report: "Department Report Ticket",
    dept_appeal: "Department Appeal Ticket",
    bug: "Bug Ticket"
  };

  // CREATE TICKET
  if (types[interaction.customId]) {
    const type = types[interaction.customId];

    ticketCount++;

    const channelCreated = await guild.channels.create({
      name: `${type} ${ticketCount}`,
      topic: "ticket"
    });

    const template = TICKET_MESSAGES[type];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
    );

    const msg = await channelCreated.send({
      content: template.replace("{user, MENTION}", `<@${member.id}>`),
      components: [row]
    });

    tickets.set(channelCreated.id, {
      ownerId: member.id,
      type,
      messageId: msg.id
    });

    if (!userTickets.has(member.id)) userTickets.set(member.id, {});
    userTickets.get(member.id)[type] = true;

    return interaction.reply({
      content: `Ticket created: ${channelCreated}`,
      ephemeral: true
    });
  }

  // CLAIM
  if (interaction.customId === "claim") {
    if (!isSupport(member)) {
      return interaction.reply({
        content: "🚨 You do not have required authorization to claim this ticket!",
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    return channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`This ticket has been claimed by ${member}.`)
          .setColor(0x2b2d31)
      ]
    });
  }
});

client.login(TOKEN);
