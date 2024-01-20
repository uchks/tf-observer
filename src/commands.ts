//
//  commands.ts
//  tf-observer
//
//  Finished by uchks on 1/20/2024.
//  Copyright © 2024 uchks. All rights reserved.
//
//  Made for Enmity: 
//  https://discord.gg/Enmity / https://enmity.app

// imports
import {
    SlashCommandBuilder,
    TextChannel,
    Interaction,
    CacheType,
    PermissionsBitField,
    ChatInputCommandInteraction,
    GuildMember,
    ChannelType,
    Client,
} from 'discord.js';
import {
    fetchAndSendData,
    botState,
    logMessage,
    LogLevel,
} from './index.js';

export const commands = [
    new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('sets the channel to send update embeds to')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send updates')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('gives you the TestFlight update notification role'),
    new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('removes the TestFlight update notification role'),
    new SlashCommandBuilder()
        .setName('manualupdate')
        .setDescription('manually trigger an update message')
        .addBooleanOption(option =>
            option.setName('ping') // god forbid i ping anyone when i test.
                .setDescription('Choose whether to ping the update role')
                .setRequired(false))
].map(command => command.toJSON());

// slash (application) commands
export function setupCommandListeners(client: Client) {
    client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
        if (!interaction.isCommand() || !interaction.inGuild()) return;

        const commandInteraction = interaction as ChatInputCommandInteraction;

        try {
            if (!commandInteraction.guild) {
                await commandInteraction.reply('This command can only be used in a server.');
                return;
            }

            const { commandName } = commandInteraction;
            const member = commandInteraction.member as GuildMember;

            // set channel command, allows a staff member to set the channel for embeds to send to (primarily used for debugging tbh)
            if (commandName === 'setchannel') {
                try {
                    if (!commandInteraction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
                        return void await commandInteraction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                    }

                    const channel = commandInteraction.options.getChannel('channel', true) as TextChannel;
                    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
                        return void await commandInteraction.reply({ content: 'Please specify a valid text or announcement channel.', ephemeral: true });
                    }

                    const newChannelId = channel.id;
                    await botState.saveChannelId(newChannelId);
                    await interaction.reply({ content: `Channel successfully set to ${channel.name}`, ephemeral: true });
                } catch (error) {
                    await interaction.reply({ content: `Failed to set the channel. Error: ${error}`, ephemeral: true });
                }
            }

            // give role command, allows user to receive the pinging role
            if (commandName === 'giverole') {
                const role = commandInteraction.guild.roles.cache.find(role => role.name === 'TestFlight Updates');
                if (role) {
                    await member.roles.add(role);
                    await commandInteraction.reply({ content: 'You will now be notified with TestFlight updates.', ephemeral: true });
                } else {
                    await commandInteraction.reply({ content: 'Update role not found. Please ping <@326237293612367873>.', ephemeral: true });
                }
            }

            // remove role command, allows user to remove the pinging role
            if (commandName === 'removerole') {
                const role = commandInteraction.guild.roles.cache.find(role => role.name === 'TestFlight Updates');
                if (role) {
                    await member.roles.remove(role);
                    await commandInteraction.reply({ content: 'You will no longer be notified of TestFlight Updates.', ephemeral: true });
                } else {
                    await commandInteraction.reply({ content: 'Update role not found. Please ping <@326237293612367873>.', ephemeral: true });
                }
            }

            // manual update command, forces an embed to send
            if (commandName === 'manualupdate') {
                if (!commandInteraction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
                    return void await commandInteraction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                }

                const shouldPingRole = commandInteraction.options.getBoolean('ping') ?? true;
                await commandInteraction.deferReply({ ephemeral: true });

                try {
                    await fetchAndSendData(true, shouldPingRole);
                    await commandInteraction.editReply('Update notification forced and sent.');
                } catch (error) {
                    let errorMessage: string;
                    if (error instanceof Error) {
                        errorMessage = error.message;
                    } else {
                        errorMessage = String(error);
                    }
                    await commandInteraction.editReply('Failed to force send an update notification.');
                    logMessage(LogLevel.ERROR, 'Force Send Update Command', errorMessage);
                }
            }
        } catch (error) {
            console.error('Interaction Create', error);
            if (commandInteraction.isRepliable()) {
                await commandInteraction.reply('An error occurred while processing your command.').catch(console.error);
            }
        }
    })
}