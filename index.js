const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ================= STATE =================
let ticketCount = 0;

const TICKETS = new Map(); // channelId -> ticket object
const USER_LIMITS = new Map(); // userId -> { type: channelId }

// ================= ROLES =================
const SUPPORT_ROLES = [
  "1494277529614159893",
  "1494277209668456539"
];

const PANEL_ROLE = "Unbreakilo";

// ================= SAFE HELPERS =================
function isSupport(member) {
  return member.roles.cache.some(r => SUPPORT_ROLES.includes(r.id));
}

function canUsePanel(member) {
  return member.roles.cache.some(r => r.name === PANEL_ROLE);
}

function isTicket(channel) {
  return TICKETS.has(channel.id);
}

function safeReply(interaction, content, ephemeral = true) {
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp({ content, ephemeral });
  }
  return interaction.reply({ content, ephemeral });
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

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= COMMAND REGISTRATION (FIXED CRASH) =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Send ticket panel"),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close a ticket")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands
  });

  console.log("Commands loaded safely");
});

// ================= SINGLE INTERACTION ROUTER =================
client.on("interactionCreate", async (interaction) => {
  try {

    // ================= SLASH COMMANDS =================
    if (interaction.isChatInputCommand()) {
      const { commandName, member, channel } = interaction;

      if (commandName === "panel") {
        if (!canUsePanel(member))
          return safeReply(interaction, "No permission");

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

      if (commandName === "close") {
        if (!isTicket(channel))
          return safeReply(interaction, "Not a ticket");

        return interaction.reply({
          content: "Close system ready for upgrade (safe mode)",
          ephemeral: true
        });
      }
    }

    // ================= BUTTONS =================
    if (interaction.isButton()) {
      const { guild, member, customId } = interaction;

      const types = {
        report: "Report Ticket",
        appeal: "Appeal Ticket",
        dept_report: "Department Report Ticket",
        dept_appeal: "Department Appeal Ticket",
        bug: "Bug Ticket"
      };

      // CREATE TICKET
      if (types[customId]) {

        ticketCount++;

        const type = types[customId];

        const channel = await guild.channels.create({
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

        const msg = await channel.send({
          content: template.replace("{user, MENTION}", `<@${member.id}>`),
          components: [row]
        });

        TICKETS.set(channel.id, {
          owner: member.id,
          type,
          messageId: msg.id
        });

        return interaction.reply({
          content: `Ticket created: ${channel}`,
          ephemeral: true
        });
      }

      // CLAIM
      if (customId === "claim") {
        if (!isSupport(member)) {
          return interaction.reply({
            content: "🚨 You do not have required authorization to claim this ticket!",
            ephemeral: true
          });
        }

        await interaction.deferUpdate();

        return interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setDescription(`This ticket has been claimed by ${member}.`)
              .setColor(0x2b2d31)
          ]
        });
      }
    }

  } catch (err) {
    console.error("Interaction error:", err);

    if (!interaction.replied) {
      return interaction.reply({
        content: "❌ Something went wrong, check logs.",
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);
