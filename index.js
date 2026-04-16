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
  "Support Agency",
  "Support Agency High Command"
];

// ================= STATE =================
let ticketCount = 0;

// store ticket metadata in memory
const tickets = new Map(); 
// channelId → { ownerId, type, status }

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Send ticket panel"),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close a ticket (vote system)"),

    new SlashCommandBuilder()
      .setName("add")
      .setDescription("Add user to ticket")
      .addUserOption(o => o.setName("user").setRequired(true)),

    new SlashCommandBuilder()
      .setName("remove")
      .setDescription("Remove user from ticket")
      .addUserOption(o => o.setName("user").setRequired(true)),

    new SlashCommandBuilder()
      .setName("pending")
      .setDescription("Mark ticket pending"),

    new SlashCommandBuilder()
      .setName("accepted")
      .setDescription("Accept ticket")
      .addStringOption(o => o.setName("reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("denied")
      .setDescription("Deny ticket")
      .addStringOption(o => o.setName("reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("move")
      .setDescription("Move ticket type")
      .addStringOption(o =>
        o.setName("type")
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

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands registered.");
});

// ================= HELPERS =================
function isSupport(member) {
  return member.roles.cache.some(r =>
    SUPPORT_ROLES.includes(r.name)
  );
}

// ================= PANEL =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, channel } = interaction;

  // ================= PANEL =================
  if (commandName === "panel") {
    const embed = new EmbedBuilder()
      .setTitle("TICKET CATEGORY:")
      .setDescription("Need support? Select a ticket here!")
      .setColor(0x00aeff);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("report").setLabel("Report").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("appeal").setLabel("Appeal").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("dept_report").setLabel("Dept Report").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("dept_appeal").setLabel("Dept Appeal").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("bug").setLabel("Bug").setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // ================= CLOSE COMMAND =================
  if (commandName === "close") {
    const ticket = tickets.get(channel.id);
    if (!ticket) return interaction.reply({ content: "Not a ticket.", ephemeral: true });

    await channel.setName(`🔴 Closing ${ticketCount}`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_accept").setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close_deny").setLabel("Deny").setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      content: `Close!\n${member} wants to close this ticket.\n\nTicket Owner vs Support Team vote required.`,
      components: [row]
    });
  }

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

    return interaction.reply(`Accepted Reason: ${reason}`);
  }

  // ================= DENIED =================
  if (commandName === "denied") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    const reason = interaction.options.getString("reason");
    await channel.setName(`🔴 Denied ${ticketCount}`);

    return interaction.reply(`Denied Reason: ${reason}`);
  }

  // ================= MOVE =================
  if (commandName === "move") {
    if (!isSupport(member)) return interaction.reply({ content: "No permission", ephemeral: true });

    const type = interaction.options.getString("type");

    const ticket = tickets.get(channel.id);
    if (!ticket) return interaction.reply("Not a ticket");

    if (ticket.status && ["pending", "accepted", "denied"].includes(ticket.status)) {
      return interaction.reply("Cannot move finalized ticket.");
    }

    ticket.type = type;
    tickets.set(channel.id, ticket);

    await channel.setName(`${type} ${ticketCount}`);

    return interaction.reply(`Moved to ${type}`);
  }
});

// ================= BUTTONS =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const { guild, member, channel } = interaction;

  // ================= CREATE TICKET =================
  const types = {
    report: "Report Ticket",
    appeal: "Appeal Ticket",
    dept_report: "Department Report Ticket",
    dept_appeal: "Department Appeal Ticket",
    bug: "Bug Ticket"
  };

  if (types[interaction.customId]) {
    ticketCount++;

    const type = types[interaction.customId];

    const ticketChannel = await guild.channels.create({
      name: `${type} ${ticketCount}`,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
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

    tickets.set(ticketChannel.id, {
      ownerId: member.id,
      type,
      status: "open"
    });

    const embed = new EmbedBuilder()
      .setTitle(`Ticket Category: ${type}`)
      .setDescription(`Dear ${member}, please follow format instructions.`)
      .setColor(0x00aeff);

    return interaction.reply({ content: `Created ${ticketChannel}`, ephemeral: true });
  }

  // ================= CLOSE VOTE =================
  const ticket = tickets.get(channel.id);
  if (!ticket) return;

  const isOwner = member.id === ticket.ownerId;
  const isStaff = isSupport(member);

  if (!isOwner && !isStaff) return interaction.reply({ content: "No permission", ephemeral: true });

  if (interaction.customId === "close_accept") {
    ticketCount--;
    tickets.delete(channel.id);
    return channel.delete();
  }

  if (interaction.customId === "close_deny") {
    return interaction.reply("Close denied.");
  }
});

// ================= LOGIN =================
client.login(TOKEN);
