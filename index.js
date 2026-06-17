pconst { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const express = require('express');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember] 
});

const app = express();
app.get('/', (req, res) => res.send("Legend's Ticket System Engine Active."));

// ⚙️ GLOBAL ROLE & CHANNEL CONFIGURATIONS
const SET_PANEL_ROLE_ID = '1513112567676145839';
const PANEL_CHANNEL_ID = '1506529596865118208';
const DEFAULT_CLAIMER_ROLE_ID = '1513716863375376464';

// 📋 MULTI-CATEGORY CONFIGURATION MATRIX
const ticketTypes = {
    support: {
        label: 'Support Ticket',
        customId: 'ticket_support',
        style: ButtonStyle.Primary,
        channelPrefix: 'support-ticket-',
        title: 'Support Ticket',
        allowedRole: DEFAULT_CLAIMER_ROLE_ID,
        format: "Username:\nSupport Requesting:"
    },
    report: {
        label: 'Report Ticket',
        customId: 'ticket_report',
        style: ButtonStyle.Secondary,
        channelPrefix: 'report-ticket-',
        title: 'Report Ticket',
        allowedRole: '1506139327015550984',
        format: "Username:\nUser Reporting:\n\nEvidence (Required):"
    },
    moderation: {
        label: 'Moderation Report Ticket',
        customId: 'ticket_moderation',
        style: ButtonStyle.Danger,
        channelPrefix: 'moderation-ticket-',
        title: 'Moderation Report Ticket',
        allowedRole: '1506139327015550985',
        format: "Username:\nUser Reporting:\nUser’s Department:\n\nEvidence (Required):"
    },
    appeal: {
        label: 'Appeal Ticket',
        customId: 'ticket_appeal',
        style: ButtonStyle.Primary,
        channelPrefix: 'appeal-ticket-',
        title: 'Appeal Ticket',
        allowedRole: DEFAULT_CLAIMER_ROLE_ID,
        format: "Username:\nPunishment Appealing:\n\nAppeal Message:"
    },
    partnership: {
        label: 'Partnership Ticket',
        customId: 'ticket_partnership',
        style: ButtonStyle.Success,
        channelPrefix: 'partnership-ticket-',
        title: 'Partnership Ticket',
        allowedRole: '1512712008506802187',
        format: "Username:\nYour server name:\nMembers Count:\n\nPing (Ping a Partnership Manager):"
    },
    sponsor: {
        label: 'Sponsor Ticket',
        customId: 'ticket_sponsor',
        style: ButtonStyle.Success,
        channelPrefix: 'sponsor-ticket-',
        title: 'Sponsor Ticket',
        allowedRole: '1513716863375376464',
        format: "Username:\nWhat you wish to sponsor:\n\nPing (ping a manager of what you wish to sponsor):"
    }
};

// 📦 PERSISTENCE ENGINE ENGINE (Local File Database)
const writeQueues = {};
function loadJSON(file, defaultData = {}) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaultData, null, 4));
            return defaultData;
        }
        const data = fs.readFileSync(file, 'utf8').trim();
        if (!data) return defaultData;
        return JSON.parse(data);
    } catch (e) {
        return defaultData;
    }
}

function saveJSON(file, data) {
    if (!writeQueues[file]) writeQueues[file] = Promise.resolve();
    writeQueues[file] = writeQueues[file].then(() => {
        return fs.promises.writeFile(file, JSON.stringify(data, null, 4), 'utf8').catch(() => {});
    });
}

let ticketData = loadJSON('./tickets.json', { channels: {}, sequentialCounter: 1000 });

// ────────────────────────────────────────────────────────
// APPLICATION BOOTSTRAP & COMMAND DEPLOYER
// ────────────────────────────────────────────────────────
client.once('ready', async () => {
    console.log(`🎫 Ticket Engine initialized as ${client.user.tag}`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        const commands = [
            new SlashCommandBuilder()
                .setName('set_panel')
                .setDescription('Deploys the main Master Ticket Support Panel.'),
            new SlashCommandBuilder()
                .setName('add')
                .setDescription('Adds a user to this specific ticket channel.')
                .addUserOption(option => option.setName('target').setDescription('The user to add').setRequired(true)),
            new SlashCommandBuilder()
                .setName('remove')
                .setDescription('Removes an explicitly added user from this ticket channel.')
                .addUserOption(option => option.setName('target').setDescription('The user to remove').setRequired(true)),
            new SlashCommandBuilder()
                .setName('force_close')
                .setDescription('Instantly deletes the ticket in 3 seconds flat.')
        ].map(cmd => cmd.toJSON());

        const GUILD_ID = 'YOUR_SERVER_ID_HERE'; 

        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID), 
            { body: commands }
        );
        console.log('✅ Ticket slash commands successfully synced INSTANTLY to your test server.');
    } catch (e) {
        console.error('Failed deploying slash commands:', e);
    }
});

// ────────────────────────────────────────────────────────
// CORE SLASH COMMANDS DISPATCHER
// ────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, channelId, user, guild } = interaction;

    // 1. SET_PANEL COMMAND
    if (commandName === 'set_panel') {
        if (!interaction.member.roles.cache.has(SET_PANEL_ROLE_ID)) {
            return interaction.reply({ content: '❌ You do not have the required role to use this command.', ephemeral: true });
        }

        const panelChannel = await guild.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
        if (!panelChannel) {
            return interaction.reply({ content: '❌ Error: Could not find the configured panel channel ID.', ephemeral: true });
        }

        const panelEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Ticket Support System')
            .setDescription('Seeking for assistance in this server? Please create a ticket depending on your situation so we can properly assist you.');

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(ticketTypes.support.customId).setLabel(ticketTypes.support.label).setStyle(ticketTypes.support.style),
            new ButtonBuilder().setCustomId(ticketTypes.report.customId).setLabel(ticketTypes.report.label).setStyle(ticketTypes.report.style),
            new ButtonBuilder().setCustomId(ticketTypes.moderation.customId).setLabel(ticketTypes.moderation.label).setStyle(ticketTypes.moderation.style)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(ticketTypes.appeal.customId).setLabel(ticketTypes.appeal.label).setStyle(ticketTypes.appeal.style),
            new ButtonBuilder().setCustomId(ticketTypes.partnership.customId).setLabel(ticketTypes.partnership.label).setStyle(ticketTypes.partnership.style),
            new ButtonBuilder().setCustomId(ticketTypes.sponsor.customId).setLabel(ticketTypes.sponsor.label).setStyle(ticketTypes.sponsor.style)
        );

        await panelChannel.send({ embeds: [panelEmbed], components: [row1, row2] });
        return interaction.reply({ content: '✅ Master support panel sent successfully.', ephemeral: true });
    }

    const activeTicket = ticketData.channels[channelId];
    if (!activeTicket) {
        return interaction.reply({ content: '❌ This command can only be used inside an active ticket channel.', ephemeral: true });
    }

    // 2. ADD COMMAND
    if (commandName === 'add') {
        if (activeTicket.claimerId !== user.id) {
            return interaction.reply({ content: '❌ Only the staff member who claimed this ticket can use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('target');
        if (targetUser.id === user.id) {
            return interaction.reply({ content: '❌ You cannot add yourself to the ticket.', ephemeral: true });
        }

        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        if (!activeTicket.invitedUsers.includes(targetUser.id)) {
            activeTicket.invitedUsers.push(targetUser.id);
            saveJSON('./tickets.json', ticketData);
        }

        const addEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`## Player Added\n\n<@${user.id}> has added ${targetUser.username} to this ticket.`);

        return interaction.reply({ embeds: [addEmbed] });
    }

    // 3. REMOVE COMMAND
    if (commandName === 'remove') {
        if (activeTicket.claimerId !== user.id) {
            return interaction.reply({ content: '❌ Only the staff member who claimed this ticket can use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('target');
        if (targetUser.id === user.id) {
            return interaction.reply({ content: '❌ You cannot remove yourself from the ticket.', ephemeral: true });
        }

        await interaction.channel.permissionOverwrites.delete(targetUser.id);

        activeTicket.invitedUsers = activeTicket.invitedUsers.filter(id => id !== targetUser.id);
        saveJSON('./tickets.json', ticketData);

        const removeEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(`## Player Removed\n\n<@${user.id}> has removed ${targetUser.username} from this ticket.`);

        return interaction.reply({ embeds: [removeEmbed] });
    }

    // 4. FORCE_CLOSE COMMAND
    if (commandName === 'force_close') {
        if (activeTicket.claimerId !== user.id) {
            return interaction.reply({ content: '❌ Only the staff member who claimed this ticket can use this command.', ephemeral: true });
        }

        await interaction.reply({ content: '⚠️ **Force close initiated.** Closing channel environment and delivering transcript logs in 3 seconds...' });
        setTimeout(async () => {
            await executeTicketTeardown(interaction.channel, activeTicket);
        }, 3000);
    }
});

// ────────────────────────────────────────────────────────
// INTERACTION BUTTON ROUTERS
// ────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guild, user, channel } = interaction;

    // A. PANEL SPARK SELECTION INTERCEPTOR
    const typeKey = Object.keys(ticketTypes).find(key => ticketTypes[key].customId === customId);
    if (typeKey) {
        await interaction.deferReply({ ephemeral: true });
        const config = ticketTypes[typeKey];

        ticketData.sequentialCounter++;
        const currentCount = ticketData.sequentialCounter;
        saveJSON('./tickets.json', ticketData);

        const createdChannel = await guild.channels.create({
            name: `${config.channelPrefix}${currentCount}`,
            type: 0, 
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: config.allowedRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
        }).catch(() => null);

        if (!createdChannel) {
            return interaction.editReply({ content: '❌ Failed to generate custom ticket channel asset.' });
        }

        ticketData.channels[createdChannel.id] = {
            ownerId: user.id,
            claimerId: null,
            ticketType: config.title,
            allowedRole: config.allowedRole,
            invitedUsers: []
        };
        saveJSON('./tickets.json', ticketData);

        const displayEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(config.title)
            .setDescription(`Hello <@${user.id}>;\nPlease follow the format below in order for us to assist you:\n\n${config.format}\n\n-# created by <@${user.id}>`);

        const managementRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('action_claim').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('action_close').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await createdChannel.send({ content: `<@${user.id}>`, embeds: [displayEmbed], components: [managementRow] });
        return interaction.editReply({ content: `✅ Ticket opened successfully! Head to <#${createdChannel.id}>.` });
    }

    // B. CLAIM BUTTON INTERACTION
    if (customId === 'action_claim') {
        const ticket = ticketData.channels[channel.id];
        if (!ticket) return interaction.reply({ content: '❌ State mismatch: Context entry unavailable.', ephemeral: true });

        if (!interaction.member.roles.cache.has(ticket.allowedRole)) {
            return interaction.reply({ content: '❌ You do not have permission to claim this type of ticket.', ephemeral: true });
        }

        ticket.claimerId = user.id;
        saveJSON('./tickets.json', ticketData);

        await channel.permissionOverwrites.set([
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: ticket.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]);

        const claimedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claimed_placeholder').setLabel('Claimed').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('action_close').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        if (interaction.message) {
            await interaction.message.edit({ components: [claimedRow] }).catch(() => {});
        }

        await interaction.reply({ 
            embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`## <@${user.id}> has claimed this Ticket.`)] 
        });
        return;
    }

    // C. INITIAL CLOSE PROCESSING GATEWAY (HARDENED TWO-PARTY SYSTEM)
    if (customId === 'action_close') {
        const ticket = ticketData.channels[channel.id];
        if (!ticket) return interaction.reply({ content: '❌ Context missing.', ephemeral: true });

        // Unclaimed close condition bypass
        if (!ticket.claimerId) {
            if (user.id !== ticket.ownerId) {
                return interaction.reply({ content: '❌ Only the ticket creator can close an unclaimed ticket.', ephemeral: true });
            }
            await interaction.reply({ content: '🔒 **Ticket closed by owner.** Deleting channel configuration...' });
            return executeTicketTeardown(channel, ticket);
        }

        // Claimed close authorization check
        if (user.id !== ticket.ownerId && user.id !== ticket.claimerId) {
            return interaction.reply({ content: '❌ Only the ticket creator or the assigned assister can close this thread.', ephemeral: true });
        }

        const oppositePingId = (user.id === ticket.claimerId) ? ticket.ownerId : ticket.claimerId;

        const validationEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setDescription(`## 🚨 Ticket Confirmation\n\n<@${oppositePingId}>, please confirm if you would like to accept or decline closing this ticket.\n\n_*Note: Requested by <@${user.id}>_*`);

        // We bind the user who requested the close right into the customIds
        const confirmationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_close_yes_${user.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`confirm_close_no_${user.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [validationEmbed], components: [confirmationRow] });
    }

    // D. HARDENED CONFIRMATION PROMPT VALIDATORS
    if (customId.startsWith('confirm_close_yes_') || customId.startsWith('confirm_close_no_')) {
        const ticket = ticketData.channels[channel.id];
        if (!ticket) return interaction.reply({ content: '❌ Structural metadata reference lost.', ephemeral: true });

        // Parse who initiated the close command from the customId metadata string
        const customIdParts = customId.split('_');
        const initiatorId = customIdParts[3];

        // CRITICAL ANTI-SELF-APPROVE LOCK:
        if (user.id === initiatorId) {
            return interaction.reply({ 
                content: '⚠️ **Action Denied:** You cannot accept or deny your own close request! The other party must interact with this panel.', 
                ephemeral: true 
            });
        }

        // Ensure that random outsiders cannot click it either
        if (user.id !== ticket.ownerId && user.id !== ticket.claimerId) {
            return interaction.reply({ content: '❌ You are not authorized to decide this ticket\'s lifecycle.', ephemeral: true });
        }

        // Handle Approved Closure
        if (customId.startsWith('confirm_close_yes_')) {
            await interaction.reply({ content: '🔒 **Ticket verification complete.** Generating transcripts and wiping area...' });
            return executeTicketTeardown(channel, ticket);
        }

        // Handle Denied Closure
        if (customId.startsWith('confirm_close_no_')) {
            await interaction.message.delete().catch(() => {});
            return interaction.reply({ content: `❌ <@${user.id}> has declined the ticket closure. Ticket remains active.` });
        }
    }
});

// ────────────────────────────────────────────────────────
// TRANSCRIPTION LOG DISTRIBUTION & ANNIHILATION
// ────────────────────────────────────────────────────────
async function executeTicketTeardown(channel, ticket) {
    try {
        const participants = [ticket.ownerId];
        if (ticket.claimerId) participants.push(ticket.claimerId);
        ticket.invitedUsers.forEach(id => { if (!participants.includes(id)) participants.push(id); });

        const formattedParticipants = participants.map(id => `<@${id}>`).join(', ');
        const resolvedAssister = ticket.claimerId ? `<@${ticket.claimerId}>` : '`Unclaimed`';

        const transcriptEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(`**${ticket.ticketType} Closed.**\n\n**Ticket Owner:** <@${ticket.ownerId}>\n**Ticket Assister:** ${resolvedAssister}\n\n**Everyone in the ticket:** ${formattedParticipants}`);

        for (const targetId of participants) {
            try {
                const userInstance = await client.users.fetch(targetId).catch(() => null);
                if (userInstance) {
                    await userInstance.send({ embeds: [transcriptEmbed] }).catch(() => {});
                }
            } catch (err) {}
        }
    } catch (e) {
        console.error('Transcript error:', e);
    } finally {
        delete ticketData.channels[channel.id];
        saveJSON('./tickets.json', ticketData);
        await channel.delete().catch(() => {});
    }
}

app.listen(process.env.PORT || 3000);
client.login(process.env.TOKEN);
