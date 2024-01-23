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
  logMessage,
  LogLevel,
  UPDATES_ROLE_ID,
} from './index.js';
import { saveChannelId } from './libs/database.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('tf')
    .setDescription('Commands related to TestFlight updates')
    .addSubcommand(subcommand =>
      subcommand.setName('channel')
        .setDescription('Set the channel to send update embeds to')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to send updates')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand.setName('role')
        .setDescription('Manage the TestFlight update notification role')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Choose to give or remove the role')
            .setRequired(true)
            .addChoices(
              { name: 'give', value: 'give' },
              { name: 'remove', value: 'remove' }
            ))
    )
    .addSubcommand(subcommand =>
      subcommand.setName('update')
        .setDescription('Manually trigger an update message')
        .addBooleanOption(option =>
          option.setName('ping')
            .setDescription('Choose whether to ping the update role')
            .setRequired(false))
    ),
].map(command => command.toJSON());

// slash (application) commands
export async function setupCommandListeners(client: Client, updatesRoleId: string) {
  client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
    if (!interaction.isCommand() || !interaction.inGuild()) return;

    const commandInteraction = interaction as ChatInputCommandInteraction;
    const member = commandInteraction.member as GuildMember;

    try {
      if (!commandInteraction.guild) {
        await commandInteraction.reply('This command can only be used in a server.');
        return;
      }

      if (commandInteraction.commandName === 'tf') {
        const subcommand = commandInteraction.options.getSubcommand();

        switch (subcommand) {
          case 'channel':
            try {
              if (!commandInteraction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
                return void await commandInteraction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
              }

              const channel = commandInteraction.options.getChannel('channel', true) as TextChannel;
              if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
                return void await commandInteraction.reply({ content: 'Please specify a valid text or announcement channel.', ephemeral: true });
              }

              const newChannelId = channel.id;
              await saveChannelId(newChannelId);
              await interaction.reply({ content: `Channel successfully set to ${channel.name}`, ephemeral: true });
            } catch (error) {
              await interaction.reply({ content: `Failed to set the channel. Error: ${error}`, ephemeral: true });
            }
            break;

          case 'role':
            const action = commandInteraction.options.getString('action');
            const role = UPDATES_ROLE_ID
            if (!role) {
              await commandInteraction.reply({ content: 'Update role not found. Please ping <@326237293612367873>.', ephemeral: true });
              break;
            }

            if (action === 'give') {
              await member.roles.add(role);
              await commandInteraction.reply({ content: 'You will now be notified with TestFlight updates.', ephemeral: true });
            } else if (action === 'remove') {
              await member.roles.remove(role);
              await commandInteraction.reply({ content: 'You will no longer be notified of TestFlight Updates.', ephemeral: true });
            } else {
              await commandInteraction.reply({ content: 'Invalid action.', ephemeral: true });
            }
            break;
          case 'update':
            if (!commandInteraction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
              return void await commandInteraction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            const shouldPingRole = commandInteraction.options.getBoolean('ping') ?? true;
            await commandInteraction.deferReply({ ephemeral: true });

            try {
              await fetchAndSendData(updatesRoleId, true, shouldPingRole);
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
      }
    } catch (error) {
      console.error('Interaction Create', error);
      if (commandInteraction.isRepliable()) {
        await commandInteraction.reply('An error occurred while processing your command.').catch(console.error);
      }
    }
  })
}