# Plex Discord Bot

A JS script to be able to play music in your plex server using slash commands.

## Setup

### Clone and install dependencies

1. Go into the directory you would like the repository to be in, clone the repo using

```
git clone https://
```

2. Open/CD into the directory and run `npm install` to install the dependencies

### Setup env (enviroment variables) file

This is the file that will have information about the bot and plex to allow the bot to connect to the plex server.

This is what your .env file should look like

```
# Plex
HOSTNAME=<server ip or hostname>
HOSTNAME_REMOTE=<Remote name of the server>
PLEX_TOKEN=<follow the guide below>
PORT=32400

# Discord
TOKEN=<your discord bot token>
CHOICE=10
ONREADY_CHANNEL=<Discord channel id>
GUILD_ID=<Discord server/guild id>
DELETE_AFTER_SEARCH=false

```


Plex token
- Follow [this](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) guide to get your token

Hotname Remote:
- I got mine from the guide above, as when the XML file was previewed the URL was something like:
  - 192-168-0-123.<a random string>.plex.direct:32400
- Copy the URL without the port and use that as the remote name

Discord Token:
- Go to [Discord Applications page](https://discord.com/developers/applications) and create a new application
- Go to the bot page and copy the token.

Guild ID and Channel ID:
- For development, these are the guild and text channel that the bot will send messages to.
- To get the guid or channel id, right click on the channel and click "Copy ID"