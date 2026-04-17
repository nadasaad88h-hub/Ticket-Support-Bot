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

const tickets = new Map();
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

// FIXED TICKET DETECTION
function isTicketChannel(channel) {
  if (!channel) return false;

  if (tickets.has(channel.id)) return true;

  const name = (channel.name || "").toLowerCase();

  return (
    name.includes("ticket") ||
    name.includes("report") ||
    name.includes("appeal") ||
    name.includes("bug") ||
    name.includes("dept") ||
    name.includes("pending") ||
    name.includes("accepted") ||
    name.includes("denied") ||
    name.includes("closing")
  );
}

// ================= YOUR EXACT MESSAGES (UNCHANGED CONTENT) =================
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

  // PANEL
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

  // SAFE CHECK
  if (!isTicketChannel(channel) && commandName !== "panel") {
    return interaction.reply({
      content: "🚨 This command can only be executed inside a ticket!",
      ephemeral: true
    });
  }

  const ticket = tickets.get(channel.id);

  const reply = (msg) =>
    interaction.reply({ content: msg, ephemeral: true });

  // ================= COMMANDS =================
  if (commandName === "pending") {
    if (!isSupport(member)) return reply("No permission");
    await channel.setName(`🟡 Pending ${ticketCount}`);
    return reply("Marked pending");
  }

  if (commandName === "accepted") {
    if (!isSupport(member)) return reply("No permission");
    const reason = interaction.options.getString("reason");
    await channel.setName(`🟢 Accepted ${ticketCount}`);
    return reply(`Accepted: ${reason}`);
  }

  if (commandName === "denied") {
    if (!isSupport(member)) return reply("No permission");
    const reason = interaction.options.getString("reason");
    await channel.setName(`🔴 Denied ${ticketCount}`);
    return reply(`Denied: ${reason}`);
  }

  if (commandName === "move") {
    if (!isSupport(member)) return reply("No permission");

    const type = interaction.options.getString("type");

    await channel.setName(`${type} ${ticketCount}`);

    const msg = await channel.messages.fetch(ticket.messageId).catch(() => null);
    if (msg) await msg.edit(`# This Ticket has been moved to a ${type}`);

    return reply(`Moved to ${type}`);
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

  // CREATE TICKET
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
      topic: "ticket"
    });

    // 🔥 YOUR MESSAGE (RESTORED)
    const template = TICKET_MESSAGES[type];

    const msg = await channelCreated.send({
      content: template
        ? template.replace("{user, MENTION}", `<@${member.id}>`)
        : "Ticket created."
    });

    tickets.set(channelCreated.id, {
      ownerId: member.id,
      type,
      messageId: msg.id
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
