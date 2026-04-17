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
  {
    id: "report",
    label: "Report Ticket",
    emoji: "🚨",
    color: 0xed4245,
    message: `Dear {user MENTION},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Their username:
Rule Violated:

Evidence:*`,
  },
  {
    id: "appeal",
    label: "Appeal Ticket",
    emoji: "⚖️",
    color: 0xfee75c,
    message: `Dear {user MENTION},

To request for assistance, we kindly request you to follow the format below.

Your username:
Your rank:
Infraction:
Appeal message:`,
  },
  {
    id: "bug",
    label: "Bug Ticket",
    emoji: "🐛",
    color: 0x57f287,
    message: `Dear {user MENTION},

To request for assistance, we kindly request you to follow the format below.

*Your username:
Your rank:
Server Bug:
How’s it’s affecting the server:

Evidence (optional):*`,
  },
];

const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Send ticket panel").setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),
  new SlashCommandBuilder().setName("pending").setDescription("Mark pending"),
  new SlashCommandBuilder().setName("accepted").setDescription("Mark accepted"),
  new SlashCommandBuilder().setName("denied").setDescription("Mark denied"),
  new SlashCommandBuilder().setName("add").setDescription("Add user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("remove").setDescription("Remove user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("move").setDescription("Move ticket").addChannelOption(o => o.setName("category").setDescription("Category").setRequired(true).addChannelTypes(ChannelType.GuildCategory)),
].map(c => c.toJSON());

function isStaff(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator)
    || member.roles.cache.has(SUPPORT_ROLE_1)
    || member.roles.cache.has(SUPPORT_ROLE_2);
}

// Fixed to check for prefix since we aren't using a fixed category ID anymore
function isTicket(channel) {
  return TICKET_TYPES.some(t => channel.name.startsWith(`${t.id}-`));
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`✅ Bot Online: ${client.user.tag}`);
  } catch (err) { console.error(err); }
});

client.on("interactionCreate", async (interaction) => {
  const { commandName, customId, guild, channel, member, user } = interaction;

  if (interaction.isChatInputCommand()) {
    if (commandName === "panel") {
      const row = new ActionRowBuilder().addComponents(
        TICKET_TYPES.map(t => new ButtonBuilder().setCustomId(`create_${t.id}`).setLabel(t.label).setEmoji(t.emoji).setStyle(ButtonStyle.Secondary))
      );
      return interaction.reply({ content: "**Support System Selection**", components: [row] });
    }

    if (["close","pending","accepted","denied","add","remove","move"].includes(commandName)) {
      if (!isTicket(channel)) return interaction.reply({ content: "🚨 This command can only be executed inside a ticket!", ephemeral: true });
      if (["pending","accepted","denied","move"].includes(commandName) && !isStaff(member)) return interaction.reply({ content: "🚨 Staff only.", ephemeral: true });

      if (commandName === "close") {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_close").setLabel("Confirm").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("deny_close").setLabel("Deny").setStyle(ButtonStyle.Danger)
        );
        return interaction.reply({ 
            embeds: [new EmbedBuilder().setTitle("Close!").setDescription(`${user} wants to close this ticket!`)],
            components: [row] 
        });
      }

      if (commandName === "pending") return interaction.reply("📌 Ticket is now **PENDING**.");
      if (commandName === "accepted") return interaction.reply("✅ Ticket **ACCEPTED**.");
      if (commandName === "denied") return interaction.reply("❌ Ticket **DENIED**.");
      if (commandName === "add") {
        const u = interaction.options.getMember("user");
        await channel.permissionOverwrites.edit(u.id, { ViewChannel: true, SendMessages: true });
        return interaction.reply(`Added ${u}`);
      }
      if (commandName === "remove") {
        const u = interaction.options.getMember("user");
        await channel.permissionOverwrites.edit(u.id, { ViewChannel: false });
        return interaction.reply(`Removed ${u}`);
      }
      if (commandName === "move") {
        const cat = interaction.options.getChannel("category");
        await channel.setParent(cat.id, { lockPermissions: false });
        return interaction.reply({ content: `# This Ticket has been moved to a ${cat.name}` });
      }
    }
  }

  if (interaction.isButton()) {
    if (customId.startsWith("create_")) {
      await interaction.deferReply({ ephemeral: true });
      const typeId = customId.split("_")[1];
      const type = TICKET_TYPES.find(t => t.id === typeId);

      // Look for a category named "Tickets" automatically
      const targetCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === "tickets");

      const existing = guild.channels.cache.find(c => c.name === `${typeId}-${user.username.toLowerCase().replace(/\s+/g, '-')}`);
      if (existing) return interaction.editReply(`🚨 You already have a ticket: ${existing}`);

      const ticketChannel = await guild.channels.create({
        name: `${typeId}-${user.username}`,
        type: ChannelType.GuildText,
        parent: targetCategory ? targetCategory.id : null, // Uses the "Tickets" category if it exists
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: SUPPORT_ROLE_1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SUPPORT_ROLE_2, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      const embed = new EmbedBuilder().setColor(type.color).setDescription(type.message.replace("{user MENTION}", `<@${user.id}>`));
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim_ticket").setLabel("Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("close_prompt").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
      return interaction.editReply(`Ticket opened: ${ticketChannel}`);
    }

    if (customId === "claim_ticket") {
      if (!isStaff(member)) return interaction.reply({ content: "🚨You do not have required authorization to claim this ticket!", ephemeral: true });
      return interaction.reply(`This ticket has been claimed by ${user}.`);
    }

    if (customId === "close_prompt") {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_close").setLabel("Confirm").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("deny_close").setLabel("Deny").setStyle(ButtonStyle.Danger)
        );
        return interaction.reply({ 
            embeds: [new EmbedBuilder().setTitle("Close!").setDescription(`${user} wants to close this ticket!`)],
            components: [row] 
        });
    }

    if (customId === "confirm_close") {
        await interaction.reply("Ticket will be deleted in 5 seconds.");
        setTimeout(() => channel.delete().catch(() => {}), 5000);
    }

    if (customId === "deny_close") {
        await interaction.message.delete().catch(() => {});
        return interaction.reply({ content: `${user} has denied to close this ticket.` });
    }
  }
});

client.login(TOKEN);
