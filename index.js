const DiscordJS = require('discord.js')
require('dotenv').config()

// Aqua color
colors = {
    'aqua': 0x5abdd1
}

const client = new DiscordJS.Client()
const guildID = "695744844378800229"
const developMode = true;
var songQueue = []

const getApp = (guildId) => {
    const app = client.api.applications(client.user.id)

    if (guildId) {
        app.guilds(guildId)
    }

    return app
}

client.on("ready", async () => {
    console.log("The bot is now ready")

    if (developMode) {
        var app = client.api.applications(client.user.id).guilds("695744844378800229").commands
    } else {
        var app = client.api.applications(client.user.id).commands
    }

    const commands = await app.get();

    // commands.forEach(command => {
    //     try {
    //         app.commands(command["id"]).delete()
    //         console.log("Deleting: " + command["name"])
    //     } catch { }
    // });

    // console.log(commands)

    // Ping command
    await app.post({
        data: {
            name: "ping",
            description: "Test command for saying pong",
        }
    })

    /**
     * /hello command   Joins, says "hello" (from Adele - Hello), then leaves
     * /playnext
     * /queue
     * /now             Shows what is currently playing
     */

    // Secret play (only the user sending the command can see what's added)
    await app.post({
        data: {
            name: "secretplay",
            description: "Play a song (or add it to the queue) without announcing it to others",
            options: [
                {
                    name: "title",
                    description: "The title of the song",
                    required: true,
                    type: 3,
                },
                {
                    name: "artist",
                    description: "The artist of the song (optional)",
                    required: false,
                    type: 4,
                },
            ]
        }
    })

    // Secret play (only the user sending the command can see what's added)
    await app.post({
        data: {
            name: "play",
            description: "Play a song (or add it to the queue)",
            options: [
                {
                    name: "title",
                    description: "The title of the song",
                    required: true,
                    type: 3,
                },
                {
                    name: "artist",
                    description: "The artist of the song (optional)",
                    required: false,
                    type: 4,
                },
            ]
        }
    })

    client.ws.on('INTERACTION_CREATE', async interaction => {
        const { name, options } = interaction.data
        const command = name.toLowerCase()

        console.log(options)

        if (command === "ping") {
            await reply(interaction, "Pong!")
        }
        else if (command === "play" || command === "secretplay") {
            if (command === "play") {
                flagsValue = 0
            } else {
                flagsValue = 64
            }

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        flags: flagsValue,
                        // content: "I'm triggered",
                        embeds: [
                            {
                                title: 'Currently searching for \"' + options[0]['value'] + '\"',
                                description: 'Some description'
                            }
                        ]
                    }
                }
            })
        }
        // else if (command === "embed") {
        //     reply(interaction, "An embed!")

        //     client.api.interactions(interaction.id, interaction.token).callback.post({
        //         data: {
        //             type: 4,
        //             data: {
        //                 embeds: [
        //                     {
        //                         title: 'Some title',
        //                         description: 'some description'
        //                     }
        //                 ]
        //             }
        //         }
        //     });
        // }
    })
})

const reply = async (interaction, response) => {
    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 4,
            data: {
                content: response
            }
        }
    })
}

client.login(process.env.TOKEN);