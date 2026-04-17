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

// SUPPORT ROLE IDS
const SUPPORT_ROLES = [
  "1494277529614159893", // Support Agency
  "1494277209668456539"  // Support Agency High Command
];

const PANEL_ROLE = "Unbreakilo";

let ticketCount = 0;
const tickets = new Map();

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
          .setDescription("Type")
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

  const { commandName, member, channel, guild } = interaction;

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

  // BLOCK OUTSIDE TICKETS
  if (!isTicketChannel(channel.id)) {
    return interaction.reply({ content: "Use inside tickets only.", ephemeral: true });
  }

  const ticket = tickets.get(channel.id);

  // ================= ADD =================
  if (commandName === "add") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    const user = interaction.options.getUser("user");

    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    return interaction.reply(`Added ${user}`);
  }

  // ================= REMOVE =================
  if (commandName === "remove") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    const user = interaction.options.getUser("user");

    await channel.permissionOverwrites.delete(user.id);

    return interaction.reply(`Removed ${user}`);
  }

  // ================= PENDING =================
  if (commandName === "pending") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    await channel.setName(`🟡 Pending ${ticketCount}`);
    return interaction.reply("Marked pending");
  }

  // ================= ACCEPTED =================
  if (commandName === "accepted") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    const reason = interaction.options.getString("reason");

    await channel.setName(`🟢 Accepted ${ticketCount}`);
    return interaction.reply(`Accepted: ${reason}`);
  }

  // ================= DENIED =================
  if (commandName === "denied") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    const reason = interaction.options.getString("reason");

    await channel.setName(`🔴 Denied ${ticketCount}`);
    return interaction.reply(`Denied: ${reason}`);
  }

  // ================= MOVE =================
  if (commandName === "move") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    const type = interaction.options.getString("type");

    await channel.setName(`${type} ${ticketCount}`);
    return interaction.reply(`Moved to ${type}`);
  }

  // ================= CLOSE =================
  if (commandName === "close") {
    const isOwner = member.id === ticket.ownerId;
    const isStaff = isSupport(member);

    if (!isOwner && !isStaff) {
      return interaction.reply({ content: "No permission.", ephemeral: true });
    }

    await channel.setName(`🔴 Closing ${ticketCount}`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_accept").setLabel("Accept").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close_deny").setLabel("Deny").setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: `Close!\n${member} wants to close this ticket.`,
      components: [row]
    });
  }
});

// ================= BUTTONS =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const { guild, member } = interaction;

  const types = {
    report: "Report Ticket",
    appeal: "Appeal Ticket",
    dept_report: "Department Report Ticket",
    dept_appeal: "Department Appeal Ticket",
    bug: "Bug Ticket"
  };

  // CREATE TICKET
  if (types[interaction.customId]) {
    ticketCount++;

    const type = types[interaction.customId];

    const channel = await guild.channels.create({
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

    tickets.set(channel.id, {
      ownerId: member.id,
      type
    });

    // ================= YOUR EXACT MESSAGES =================

    let msg;

    if (type === "Report Ticket") {
      msg = await channel.send(
`## Ticket Category: Report Ticket
Dear ${member},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Their username:
Rule Violated:

Evidence:*`
      );
    }

    if (type === "Appeal Ticket") {
      msg = await channel.send(
`## Ticket Category: Appeal Ticket
Dear ${member},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Infraction:
Appeal message:*`
      );
    }

    if (type === "Department Report Ticket") {
      msg = await channel.send(
`## Ticket Category: Department Report Ticket
Dear ${member},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Their username:
Their department:
Rule Violated:

Evidence:*`
      );
    }

    if (type === "Department Appeal Ticket") {
      msg = await channel.send(
`## Ticket Category: Department Appeal Ticket
Dear ${member},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your department:
infraction:

Appeal message:*`
      );
    }

    if (type === "Bug Ticket") {
      msg = await channel.send(
`## Ticket Category: Bug Ticket
Dear ${member},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Server Bug:
How’s it’s affecting the server:

Evidence (optional):*`
      );
    }

    if (msg) await msg.pin().catch(() => {});

    return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  // CLOSE BUTTONS
  const ticket = tickets.get(interaction.channel.id);
  if (!ticket) return;

  if (interaction.customId === "close_accept") {
    tickets.delete(interaction.channel.id);
    return interaction.channel.delete();
  }

  if (interaction.customId === "close_deny") {
    return interaction.reply("Close cancelled.");
  }
});

client.login(TOKEN);
