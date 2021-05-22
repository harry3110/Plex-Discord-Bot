const DiscordJS = require('discord.js')
const PlexAPI = require('plex-api')
require('dotenv').config()

// Aqua color
colors = {
    'aqua': 0x5abdd1,
    'red': 0xa11a1a
}

// Plex options
var songQueue = []
var status = "" // "", "playing", "paused"

// Simple (may be all I need)
var plex = new PlexAPI({
    hostname:process.env.HOSTNAME,
    token: process.env.PLEX_TOKEN
})

// searchResults contains all of the songs IDs of a returned search, currentSearch is the query of the search
var searchResults = []
var currentSearch = null
var searchGuildMember = null

// Complex
// var plex = new PlexAPI({
//     hostname: process.env.HOSTNAME,
//     port: process.env.PORT,
//     username: process.env.USERNAME,
//     password: process.env.PASSWORD,
//     token: process.env.PLEX_TOKEN,
//     options: {
//         identifier: process.env.IDENTIFIER,
//         product: process.env.IDENTIFIER,
//         version: "1.0",
//         deviceName: process.env.DEVICE_NAME,
//         platform: "Discord",
//         device: "Discord"
//     }
// });

const plex_url = (middle, protocol = "http") => protocol + "://" + process.env.HOSTNAME + ":" + process.env.PORT + "" + middle + "?X-Plex-Token=" + process.env.PLEX_TOKEN
const music_url = (middle) => "http://arcadia:32400" + middle + "?X-Plex-Token=" + process.env.PLEX_TOKEN

// Functions
const numberToEmoji = function (num) {
    if (num == 0)      { return "0️⃣" }
    else if (num == 1) { return "1️⃣" }
    else if (num == 2) { return "2️⃣" }
    else if (num == 3) { return "3️⃣" }
    else if (num == 4) { return "4️⃣" }
    else if (num == 5) { return "5️⃣" }
    else if (num == 6) { return "6️⃣" }
    else if (num == 7) { return "7️⃣" }
    else if (num == 8) { return "8️⃣" }
    else if (num == 9) { return "9️⃣" }
    else             { return false }
}

const emojiToNumber = function (emoji) {
    if (emoji == "0️⃣")      { return 0 }
    else if (emoji == "1️⃣") { return 1 }
    else if (emoji == "2️⃣") { return 2 }
    else if (emoji == "3️⃣") { return 3 }
    else if (emoji == "4️⃣") { return 4 }
    else if (emoji == "5️⃣") { return 5 }
    else if (emoji == "6️⃣") { return 6 }
    else if (emoji == "7️⃣") { return 7 }
    else if (emoji == "8️⃣") { return 8 }
    else if (emoji == "9️⃣") { return 9 }
    else             { return false }
}

// Discord options
const client = new DiscordJS.Client()
const guildID = "695744844378800229"
const developMode = true;

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

    // const commands = await app.get();

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
     * /play        <name> [artist] [no. of results]
     * /playnext    <name> [artist] [no. of results]
     * /playfirst   <name> [artist] [no. of results]  (play the first result of the query)
     * /secretplay  <name> [artist] [no. of results]
     * /hello command   Joins, says "hello" (from Adele - Hello), then leaves
     * /queue
     * /now             Shows what is currently playing
     * /pauseafter      Pause the playlist after the current one has finished
     * /move            Move a song to a different postition in the queue
     * /remove          Remove a song from the queue
     * /skip
     * /viewpast        Show the last 10 played songs, and if they were skipped (maybe tick or cross if played fully)
     * 
     * 
     * Other things:
     * - Do status of bot/currently playing
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

        // console.log(options)

        if (command === "ping") {
            await reply(interaction, "Pong!")
        }
        else if (command === "play" || command === "playnext" || command === "secretplay") {
            if (command === "secretplay") {
                flagsValue = 64
            } else {
                flagsValue = 0
            }

            var songTitle = options[0]['value']

            /**
             * Plex search query
             */
            plex.query("/search?type=10&query=" + songTitle + "&X-Plex-Container-Start=0&X-Plex-Container-Size=" + process.env.CHOICE).then(async function (MediaContainerResult) {
                var results = MediaContainerResult["MediaContainer"]["Metadata"]
                // console.log(plex_url(result["thumb"], "attachment"))

                // Title:           title
                // Artist:          originalTitle
                // Album artist:    grandparentTitle
                // Album:           parentTitle
                // Album cover:     thumb

                fields = []
                invalid = false;

                // If there is already a search, don't overwrite it
                if (searchResults.length > 0) {
                    await client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                flags: flagsValue,
                                embeds: [
                                    {
                                        title: "Song choice cancelled",
                                        description: "There is already a search, close that before starting a new one",
                                        color: colors["red"]
                                    }
                                ]
                            }
                        }
                    })
                    
                } /*else if (results.length == 1) {
                    // @TODO Automatically choose the first option, if there is only one available
                    
                }*/ else {
                    // Used in case the search is cancelled
                    currentSearch = songTitle

                    // Get guild member (to join a voice channel) (from https://stackoverflow.com/questions/66561431/discord-js-voice-channel-with-slash-commands)
                    var guild = client.guilds.cache.get(interaction.guild_id)
                    searchGuildMember = guild.member(interaction.member.user.id)

                    // Catch if there are no items in the array
                    try {    
                        for (var i = 0; i < results.length; i++) {
                            if (results[i]["originalTitle"] == undefined) {
                                var artist = results[i]["grandparentTitle"]
                            } else {
                                var artist = results[i]["originalTitle"]
                            }
    
                            // searchResults.push(results[i]["Media"][0]["id"])
                            searchResults.push(MediaContainerResult.MediaContainer.Metadata[i])
        
                            fields.push({
                                name: "[" + (i + 1) + "] " + results[i]["title"],
                                value: artist + " (" + results[i]["parentTitle"] + ")"
                            })
                        }
    
                        if (fields == []) {
                            invalid = true;
                        }
                    } catch {
                        invalid = true;
                    }
    
                    if (invalid) {
                        description = "There are no songs available with that name"
                        footer = null
                    } else {
                        description = null
                        footer = {
                            text: "Select a song by reaction with a number. To cancel the search, react with ❌"
                        }
                    }
    
                    await client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                flags: flagsValue,
                                embeds: [
                                    {
                                        title: "Choose a song",
                                        description: description,
                                        color: colors["aqua"],
                                        fields: fields,
                                        // author: {
                                        //     name: "Your mom",
                                        //     url: "https://github.com/harry3110/",
                                        //     icon_url: "https://i.imgur.com/wSTFkRM.png"
                                        // },
                                        footer: footer
                                    }
                                ]
                            }
                        }
                    })
    
                    // client.user.setActivity(result["title"] + " - " + result["grandparentTitle"])
                }
            })
        }
    })
})

client.on('message', message => {
    for (let embed of message.embeds) {
        // Add reaction emojis to selection (numbers and X to cancel)
        if (embed.title == "Choose a song") {
            message.react("❌")

            for (let i = 1; i < embed.fields.length + 1; i++) {
                message.react(numberToEmoji(i))
            }

            const filter = (reaction, user) => {
                return ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣", "❌"].includes(reaction.emoji.name) && user.id !== message.author.id;
            };
        
            // Waits for a reaction
            message.awaitReactions(filter, { max: 1, time: 30000, errors: ['time'] })
            .then(collected => {
                const reaction = collected.first();

                emoji = reaction.emoji.name

                if (emojiToNumber(emoji) > embed.fields.length) {
                    /**
                     * If a reaction other than 1-[max options] was chosen
                     */
                    message.channel.send(new DiscordJS.MessageEmbed()
                        .setColor(colors["red"])
                        .setTitle("❌ Song choice cancelled")
                        .setDescription("Hey! That's not an option you can do, I think you're trying to break me!")
                    )

                    // Remove all reactions and add the one that was selected
                    message.reactions.removeAll()
                    message.react("❌")

                    searchResults = []
                    currentSearch = null
                    return
                }

                // Remove all reactions and add the one that was selected
                message.reactions.removeAll()
                message.react(emoji)

                if (emoji == "❌") {
                    /**
                     * If the message was cancelled
                     */
                    message.channel.send(new DiscordJS.MessageEmbed()
                        .setColor(colors["red"])
                        .setTitle('Song choice cancelled')
                        .setDescription('The search for "' + currentSearch + '" was stopped')
                    )

                    searchResults = []
                    currentSearch = null
                    return
                }
                
                /**
                 * If a song was selected
                 */
                // Get the correct song id
                songData = searchResults[emojiToNumber(emoji) - 1]

                // Clear the play queue
                searchResults = []
                currentSearch = null
                
                // Get song information (each song in queue should have information for title, artist, album, thumbnail/album url, duration)
                addSongToQueue(songData, message, searchGuildMember)

                return
            })
            // .catch(collected => {
            //     /**
            //      * If a song searched timed out
            //      */
            //     searchResults = []
            //     currentSearch = null

            //     message.channel.send(new DiscordJS.MessageEmbed()
            //         .setColor(colors["red"])
            //         .setTitle('Song choice cancelled')
            //         .setDescription("Song search timed out")
            //     )
            // })
        }
    }
})

// Currently just plays a song, without a queue
async function addSongToQueue(songData, message, member) {
    var textChannel = message.channel
    var voiceChannel = member.voice.channel

    // console.log(message)
    // console.log(member)

    // Return if the user is not in a voice channel
    if (!voiceChannel) {
        message.channel.send(new DiscordJS.MessageEmbed()
            .setColor(colors["red"])
            .setTitle("❌ Song choice cancelled")
            .setDescription("To play music you need to be in a voice channel!")
        )

        return
	}

    await voiceChannel.join().then(connection => {
        console.log(          songData.Media[0].Part[0].key)
        console.log(music_url(songData.Media[0].Part[0].key))
        const dispatcher = connection.play(music_url(songData.Media[0].Part[0].key))


        dispatcher.on("start", () => {
            console.log(songData["title"] + " is now playing!")
        })

        dispatcher.on("finish", () => {
            console.log(songData["title"] + " has finished playing!")
        })
        
        dispatcher.on('error', console.error);
    })
    .catch(err => console.log(err))



    // Send an embedded message to the user to say what is playing
    if (songData["originalTitle"] == undefined) {
        var artist = songData["grandparentTitle"]
    } else {
        var artist = songData["originalTitle"]
    }

    textChannel.send(new DiscordJS.MessageEmbed()
        .setColor(colors["aqua"])
        .setTitle('Added to queue!')
        .addField(songData["title"], artist)
        .setThumbnail(/*'https://i.imgur.com/wSTFkRM.png'*/ songData["thumb"])
    )
    
    

    /*plex.query("/library/metadata/" + songData).then(async function (MediaContainerResult) {
        console.log(MediaContainerResult)
        console.log(MediaContainerResult["MediaContainer"]["Metadata"])

        // Play song
        // var voiceChannel = message.member.voice.channel

        // Play: \\ARCADIA\Media\Music\Artists\Adele\25 (2015)\01 Hello.flac
    })*/
}

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